import os
import shutil
import socket
import ipaddress
import zipfile
import tarfile
import subprocess
from urllib.parse import urlparse
from pathlib import Path
from typing import List, Tuple
from fastapi import HTTPException
from backend.app.config import settings

def validate_safe_filename(filename: str) -> str:
    """Sanitizes filename and prevents directory traversal characters"""
    base = os.path.basename(filename)
    if ".." in base or "/" in base or "\\" in base:
        raise HTTPException(status_code=400, detail="Invalid characters in filename.")
    return base

def validate_download_url(url: str) -> str:
    """
    Strict SSRF Protection:
    - Verifies protocol is http or https (prefers https)
    - Resolves host DNS to IP addresses
    - Blocks localhost, loopbacks, private networks, carrier NAT, link-local, and AWS metadata endpoint (169.254.169.254)
    """
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="Download URL cannot be empty.")

    parsed = urlparse(url.strip())
    if parsed.scheme.lower() not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Invalid URL protocol. Only HTTP and HTTPS are permitted.")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="URL missing valid hostname.")

    # Block well-known metadata hostnames
    if hostname.lower() in ("instance-data", "metadata.google.internal", "169.254.169.254"):
        raise HTTPException(status_code=400, detail="Access to cloud metadata endpoints is strictly forbidden.")

    # DNS Resolution & IP Check
    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        raise HTTPException(status_code=400, detail=f"Failed to resolve host '{hostname}': {str(e)}")

    for entry in addr_info:
        ip_str = entry[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)

            # Block loopback, private, link-local, multicast, reserved
            if ip.is_loopback:
                raise HTTPException(status_code=400, detail=f"Access to loopback address ({ip}) is blocked.")
            if ip.is_private:
                raise HTTPException(status_code=400, detail=f"Access to private internal network address ({ip}) is blocked.")
            if ip.is_link_local:
                raise HTTPException(status_code=400, detail=f"Access to link-local address / AWS metadata ({ip}) is blocked.")
            if ip.is_multicast or ip.is_reserved or ip.is_unspecified:
                raise HTTPException(status_code=400, detail=f"Access to reserved address ({ip}) is blocked.")

            # Extra check specifically for AWS EC2 metadata IP (169.254.169.254 / fd00:ec2::254)
            if str(ip) in ("169.254.169.254", "fd00:ec2::254"):
                raise HTTPException(status_code=400, detail="Access to AWS EC2 instance metadata endpoint is blocked.")
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid IP address resolved: {ip_str}")

    return url.strip()

def check_disk_space_available(required_bytes: int = 0):
    """
    Verifies that the EC2 server has enough free disk space to store the download
    and extraction while preserving the required free buffer (default 2 GB).
    """
    try:
        stat = shutil.disk_usage(str(settings.games_dir))
        free_bytes = stat.free
        buffer_bytes = int(settings.min_disk_free_gb_buffer * (1024 ** 3))

        if free_bytes <= buffer_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"Low disk space on server ({round(free_bytes / (1024**3), 2)} GB free). Must retain at least {settings.min_disk_free_gb_buffer} GB buffer."
            )

        if required_bytes > 0:
            if (free_bytes - required_bytes) < buffer_bytes:
                req_mb = round(required_bytes / (1024**2), 1)
                free_mb = round(free_bytes / (1024**2), 1)
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient disk space for download. File requires {req_mb} MB, but server only has {free_mb} MB available."
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check disk usage: {str(e)}")

def safe_extract_archive_with_limits(
    archive_path: Path,
    target_dir: Path,
    max_decompressed_bytes: int = 12 * (1024 ** 3), # Max 12 GB decompressed (supports GTA San Andreas)
    max_file_count: int = 50000 # Max 50,000 files (ZIP Bomb protection)
) -> List[str]:
    """
    Safely extracts archives (.zip, .tar, .tar.gz, .tar.xz, .7z, .rar) with:
    1. ZipSlip path-traversal protection.
    2. ZIP bomb protection (file count & byte expansion limit).
    3. Symlink escape protection.
    Returns list of extracted relative file paths.
    """
    target_dir = target_dir.resolve()
    target_dir.mkdir(parents=True, exist_ok=True)
    extracted_files: List[str] = []

    total_bytes = 0
    file_count = 0

    suffix = archive_path.name.lower()

    # Detect RAR magic bytes
    is_rar = suffix.endswith(".rar")
    try:
        with open(archive_path, "rb") as mf:
            if mf.read(7).startswith(b"Rar!\x1a\x07"):
                is_rar = True
    except Exception:
        pass

    # 1. 7Z and RAR Archives (Magic bytes or extension)
    if is_rar or suffix.endswith(".7z"):
        seven_zip = shutil.which("7z") or shutil.which("7za")
        unrar_bin = shutil.which("unrar") or shutil.which("unrar-nonfree") or shutil.which("unrar-free")

        if seven_zip:
            cmd = [seven_zip, "x", "-y", f"-o{str(target_dir)}", str(archive_path)]
            res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=False)
            if res.returncode != 0:
                raise HTTPException(status_code=400, detail=f"Failed to extract archive: {res.stderr.decode('utf-8', errors='ignore')}")
        elif unrar_bin and is_rar:
            cmd = [unrar_bin, "x", "-y", "-o+", str(archive_path), str(target_dir) + "/"]
            res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=False)
            if res.returncode != 0:
                raise HTTPException(status_code=400, detail=f"Failed to extract RAR archive: {res.stderr.decode('utf-8', errors='ignore')}")
        else:
            raise HTTPException(status_code=400, detail="Neither 7z nor unrar extraction utility installed on server.")

        for root, _, files in os.walk(target_dir):
            for f in files:
                rel = os.path.relpath(os.path.join(root, f), target_dir)
                extracted_files.append(rel)

    # 2. ZIP Archive Handling
    elif zipfile.is_zipfile(archive_path) or (suffix.endswith(".zip") and zipfile.is_zipfile(archive_path)):
        with zipfile.ZipFile(archive_path, 'r') as zf:
            for member in zf.infolist():
                file_count += 1
                if file_count > max_file_count:
                    raise HTTPException(status_code=400, detail="Archive exceeds maximum allowed file count limit (potential zip bomb).")

                total_bytes += member.file_size
                if total_bytes > max_decompressed_bytes:
                    raise HTTPException(status_code=400, detail="Decompressed size exceeds maximum allowed disk quota limit.")

                # Validate canonical path
                member_path = (target_dir / member.filename).resolve()
                if not str(member_path).startswith(str(target_dir)):
                    raise HTTPException(status_code=400, detail=f"Malicious archive member detected (ZipSlip): {member.filename}")

                # Reject dangerous symlinks
                if (member.external_attr >> 16) & 0o170000 == 0o120000:
                    # symlink
                    continue

                zf.extract(member, target_dir)
                if not member.is_dir():
                    extracted_files.append(str(member_path.relative_to(target_dir)))

    # 3. TAR Archives (.tar, .tar.gz, .tar.bz2, .tar.xz)
    elif tarfile.is_tarfile(archive_path) or any(suffix.endswith(ext) for ext in [".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz2", ".tar.xz", ".txz"]):
        with tarfile.open(archive_path, 'r:*') as tf:
            for member in tf.getmembers():
                file_count += 1
                if file_count > max_file_count:
                    raise HTTPException(status_code=400, detail="Archive exceeds maximum allowed file count limit.")

                total_bytes += member.size
                if total_bytes > max_decompressed_bytes:
                    raise HTTPException(status_code=400, detail="Decompressed size exceeds maximum allowed disk quota limit.")

                member_path = (target_dir / member.name).resolve()
                if not str(member_path).startswith(str(target_dir)):
                    raise HTTPException(status_code=400, detail=f"Malicious archive member detected: {member.name}")

                # If symlink or hardlink, ensure target is within destination
                if member.issym() or member.islnk():
                    link_target = (target_dir / member.linkname).resolve()
                    if not str(link_target).startswith(str(target_dir)):
                        continue # Skip unsafe link

                tf.extract(member, target_dir)
                if member.isfile():
                    extracted_files.append(str(member_path.relative_to(target_dir)))
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported archive format: {archive_path.name}")

    return extracted_files

def safe_extract_archive(archive_path: Path, target_dir: Path):
    """Backward compatibility wrapper"""
    return safe_extract_archive_with_limits(archive_path, target_dir)
