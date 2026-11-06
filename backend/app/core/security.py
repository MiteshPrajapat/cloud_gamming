import os
import zipfile
import tarfile
from pathlib import Path
from fastapi import HTTPException

def validate_safe_filename(filename: str) -> str:
    """Sanitizes filename and prevents directory traversal characters"""
    base = os.path.basename(filename)
    if ".." in base or "/" in base or "\\" in base:
        raise HTTPException(status_code=400, detail="Invalid characters in filename.")
    return base

def safe_extract_archive(archive_path: Path, target_dir: Path):
    """
    Safely extracts zip or tar archives while strictly preventing ZipSlip / path traversal attacks.
    """
    target_dir = target_dir.resolve()
    target_dir.mkdir(parents=True, exist_ok=True)

    if zipfile.is_zipfile(archive_path):
        with zipfile.ZipFile(archive_path, 'r') as zf:
            for member in zf.infolist():
                # Check for absolute paths or path traversal
                member_path = (target_dir / member.filename).resolve()
                if not str(member_path).startswith(str(target_dir)):
                    raise HTTPException(status_code=400, detail=f"Malicious archive member detected: {member.filename}")
            zf.extractall(target_dir)
    elif tarfile.is_tarfile(archive_path):
        with tarfile.open(archive_path, 'r:*') as tf:
            for member in tf.getmembers():
                member_path = (target_dir / member.name).resolve()
                if not str(member_path).startswith(str(target_dir)):
                    raise HTTPException(status_code=400, detail=f"Malicious archive member detected: {member.name}")
            tf.extractall(target_dir)
    else:
        raise HTTPException(status_code=400, detail="Unsupported archive format. Must be .zip, .tar.gz, or .tar.bz2")

