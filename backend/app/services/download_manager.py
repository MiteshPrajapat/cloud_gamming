import os
import re
import time
import json
import uuid
import asyncio
import hashlib
import aiohttp
import aiofiles
import logging
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime
from typing import Dict, Optional, List

from backend.app.config import settings
from backend.app.models.download import DownloadJob, DownloadCreateRequest
from backend.app.core.security import validate_download_url, check_disk_space_available
from backend.app.services.installer_engine import installer_engine
from backend.app.services.download_broadcaster import download_broadcaster

logger = logging.getLogger("cloudgaming.downloader")

class DownloadManager:
    def __init__(self):
        self._downloads: Dict[str, DownloadJob] = {}
        self._cancel_events: Dict[str, asyncio.Event] = {}
        self._active_tasks: Dict[str, asyncio.Task] = {}
        self._load_persisted_downloads()

    def _load_persisted_downloads(self):
        """Loads download job history from disk"""
        if settings.downloads_data_file.exists():
            try:
                with open(settings.downloads_data_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        job = DownloadJob(**item)
                        # Reset in-flight states from prior crash/restart
                        if job.status in ("downloading", "pending"):
                            job.status = "failed"
                            job.error_message = "Server restarted during download."
                        self._downloads[job.id] = job
            except Exception as e:
                logger.warning(f"Could not load persisted downloads: {e}")

    def _save_persisted_downloads(self):
        """Persists download job history to disk"""
        try:
            with open(settings.downloads_data_file, "w", encoding="utf-8") as f:
                json.dump([j.dict() for j in self._downloads.values()], f, indent=2)
        except Exception as e:
            logger.warning(f"Could not save persisted downloads: {e}")

    def list_downloads(self, status: Optional[str] = None) -> List[DownloadJob]:
        jobs = list(self._downloads.values())
        if status and status.lower() != "all":
            jobs = [j for j in jobs if j.status.lower() == status.lower()]
        # Sort newest first
        jobs.sort(key=lambda j: j.created_at, reverse=True)
        return jobs

    def get_download(self, download_id: str) -> Optional[DownloadJob]:
        return self._downloads.get(download_id)

    async def create_download(self, req: DownloadCreateRequest) -> DownloadJob:
        """
        Validates URL (SSRF defense), checks available disk space,
        and launches asynchronous background streaming download directly to EC2.
        """
        # 1. SSRF and Protocol Validation
        safe_url = validate_download_url(req.download_url)

        # 2. Disk Space Buffer Verification
        check_disk_space_available()

        # Generate unique IDs
        base_slug = req.name.lower().replace(" ", "-").replace("_", "-")
        clean_slug = "".join(c for c in base_slug if c.isalnum() or c == "-") or "custom-game"
        game_id = f"{clean_slug}-{uuid.uuid4().hex[:6]}"
        download_id = f"dl_{uuid.uuid4().hex[:10]}"

        # Deduce filename from URL or game name
        parsed = urlparse(safe_url)
        url_filename = os.path.basename(parsed.path) or f"{game_id}.zip"
        if "." not in url_filename:
            url_filename += ".zip"

        dest_file = settings.downloads_dir / f"{game_id}_{url_filename}"

        job = DownloadJob(
            id=download_id,
            game_id=game_id,
            game_name=req.name,
            source_url=safe_url,
            destination_path=str(dest_file),
            status="pending",
            platform=req.platform,
            archive_type=req.archive_type,
            auto_install=req.auto_install,
            executable_path=req.executable_path,
            launch_args=req.launch_args,
            checksum=req.checksum,
            checksum_type=req.checksum_type
        )

        self._downloads[download_id] = job
        self._cancel_events[download_id] = asyncio.Event()
        self._save_persisted_downloads()

        # Pre-register entry in games catalog
        self._register_pending_game(req, game_id)

        # Launch background download task
        task = asyncio.create_task(self._download_worker(job, dest_file))
        self._active_tasks[download_id] = task

        logger.info(f"Initialized download job {download_id} for game '{req.name}' -> {dest_file}")
        return job

    async def cancel_download(self, download_id: str) -> bool:
        """Cancels an in-progress download job and cleans up partial files"""
        job = self._downloads.get(download_id)
        if not job or job.status not in ("downloading", "pending"):
            return False

        if download_id in self._cancel_events:
            self._cancel_events[download_id].set()

        job.status = "cancelled"
        job.error_message = "Download cancelled by user."
        job.updated_at = datetime.utcnow().isoformat()
        self._save_persisted_downloads()

        # Clean up partial download file
        part_file = Path(f"{job.destination_path}.part")
        if part_file.exists():
            try:
                part_file.unlink()
            except Exception:
                pass

        await download_broadcaster.broadcast({
            "type": "download_progress",
            "download_id": download_id,
            "status": "cancelled",
            "progress": job.progress,
            "message": "Download cancelled by user."
        })

        return True

    async def delete_download(self, download_id: str) -> bool:
        """Removes download job record and associated archive"""
        job = self._downloads.get(download_id)
        if not job:
            return False

        if job.status == "downloading":
            await self.cancel_download(download_id)

        dest = Path(job.destination_path)
        if dest.exists():
            dest.unlink(missing_ok=True)
        part = Path(f"{job.destination_path}.part")
        if part.exists():
            part.unlink(missing_ok=True)

        del self._downloads[download_id]
        self._save_persisted_downloads()
        return True

    async def _resolve_stream_url(self, url: str) -> str:
        """Resolves file hoster landing pages (MegaDB, Google Drive confirmation) to direct CDN streaming URLs"""
        parsed = urlparse(url)

        # 1. Google Drive Virus Warning Confirmation
        if ("drive.google.com" in parsed.netloc or "drive.usercontent.google.com" in parsed.netloc) and "confirm=t" not in url:
            try:
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                timeout = aiohttp.ClientTimeout(total=20, connect=10)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.get(url, headers=headers) as resp:
                        if resp.status == 200:
                            text = await resp.text()
                            uuid_match = re.search(r'name=["\']uuid["\']\s+value=["\']([^"\']+)["\']', text)
                            if uuid_match:
                                uuid_val = uuid_match.group(1)
                                confirm_url = f"{url}&confirm=t&uuid={uuid_val}"
                                logger.info(f"Resolved Google Drive confirmation URL: {confirm_url}")
                                return confirm_url
            except Exception as e:
                logger.warning(f"Could not auto-resolve Google Drive URL: {e}")

        # 2. MegaDB Countdown Resolver
        if "megadb.net" in parsed.netloc and "?" not in parsed.query and "error" not in parsed.path:
            try:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": "https://steamrip.com/"
                }
                timeout = aiohttp.ClientTimeout(total=45, connect=15)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.get(url, headers=headers) as resp:
                        text = await resp.text()
                        match = re.search(r"var finalDownloadUrl = '([^']+)'", text)
                        if match:
                            final_page = match.group(1)
                            # Wait the 11 second server countdown
                            await asyncio.sleep(11)
                            headers["Referer"] = url
                            async with session.get(final_page, headers=headers, allow_redirects=False) as resp2:
                                if resp2.status in (301, 302, 303, 307):
                                    loc = resp2.headers.get("Location")
                                    if loc:
                                        logger.info(f"Resolved MegaDB landing page to direct CDN: {loc}")
                                        return loc
            except Exception as e:
                logger.warning(f"Could not auto-resolve MegaDB URL: {e}")
        return url

    async def _download_worker(self, job: DownloadJob, final_dest: Path):
        """Asynchronous streaming download worker with progress calculation & hash verification"""
        cancel_event = self._cancel_events.get(job.id, asyncio.Event())
        part_file = Path(f"{str(final_dest)}.part")
        job.status = "downloading"
        job.updated_at = datetime.utcnow().isoformat()
        self._save_persisted_downloads()

        hasher = hashlib.sha256() if job.checksum_type == "sha256" else hashlib.md5()
        chunk_size = 128 * 1024 # 128 KB stream chunk

        start_time = time.time()
        last_broadcast_time = start_time
        downloaded_bytes = 0

        timeout = aiohttp.ClientTimeout(total=7200, connect=60)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "*/*"
        }
        if "megadb" in job.source_url.lower():
            headers["Referer"] = "https://megadb.net/"

        try:
            # 0. Automatically resolve hoster landing pages if applicable
            current_url = await self._resolve_stream_url(job.source_url)
            if "megadb" in current_url.lower():
                headers["Referer"] = "https://megadb.net/"

            async with aiohttp.ClientSession(timeout=timeout) as session:
                for _ in range(5): # max 5 redirects
                    validate_download_url(current_url)
                    async with session.get(current_url, headers=headers, allow_redirects=False) as resp:
                        if resp.status in (301, 302, 303, 307, 308):
                            redirect_url = resp.headers.get("Location")
                            if not redirect_url:
                                raise RuntimeError("Redirect without Location header.")
                            current_url = str(urlparse(current_url)._replace(path=redirect_url) if redirect_url.startswith("/") else redirect_url)
                            continue

                        if resp.status != 200:
                            raise RuntimeError(f"Server responded with HTTP {resp.status} ({resp.reason})")

                        # Verify Content-Length
                        content_length = resp.headers.get("Content-Length")
                        if content_length:
                            total_bytes = int(content_length)
                            job.total_bytes = total_bytes
                            job.total_mb = round(total_bytes / (1024 ** 2), 2)
                            
                            # Max file limit check (e.g. 5 GB)
                            if total_bytes > settings.max_download_size_mb * (1024 ** 2):
                                raise RuntimeError(f"File size exceeds maximum limit of {settings.max_download_size_mb} MB.")

                            # Disk space check
                            check_disk_space_available(total_bytes)

                        # Update filename and destination extension from Content-Disposition if present
                        cd_header = resp.headers.get("Content-Disposition")
                        if cd_header and "filename=" in cd_header:
                            extracted_name = cd_header.split("filename=")[-1].strip('\"\' ')
                            if extracted_name and "." in extracted_name:
                                actual_ext = Path(extracted_name).suffix
                                if actual_ext and not final_dest.name.endswith(actual_ext):
                                    final_dest = final_dest.with_suffix(actual_ext)
                                    job.destination_path = str(final_dest)
                                    part_file = Path(f"{str(final_dest)}.part")

                        # Stream to disk
                        async with aiofiles.open(part_file, "wb") as out_f:
                            while True:
                                if cancel_event.is_set():
                                    if part_file.exists():
                                        part_file.unlink(missing_ok=True)
                                    return

                                chunk = await resp.content.read(chunk_size)
                                if not chunk:
                                    break

                                await out_f.write(chunk)
                                downloaded_bytes += len(chunk)
                                if job.checksum:
                                    hasher.update(chunk)

                                # Periodic progress computation
                                now = time.time()
                                if now - last_broadcast_time >= 0.4:
                                    elapsed = now - start_time
                                    speed = (downloaded_bytes / (1024 ** 2)) / max(elapsed, 0.001) # MB/s
                                    
                                    job.downloaded_bytes = downloaded_bytes
                                    job.downloaded_mb = round(downloaded_bytes / (1024 ** 2), 2)
                                    job.download_speed_mbps = round(speed, 2)

                                    if job.total_bytes and job.total_bytes > 0:
                                        job.progress = round((downloaded_bytes / job.total_bytes) * 100, 1)
                                        rem_bytes = max(job.total_bytes - downloaded_bytes, 0)
                                        job.eta_seconds = int(rem_bytes / max(speed * 1024 * 1024, 1))
                                    else:
                                        # Unknown total length
                                        job.progress = min(round((downloaded_bytes / (100 * 1024 * 1024)) * 50, 1), 99.0)

                                    last_broadcast_time = now
                                    await download_broadcaster.broadcast({
                                        "type": "download_progress",
                                        "download_id": job.id,
                                        "game_id": job.game_id,
                                        "status": "downloading",
                                        "progress": job.progress,
                                        "downloaded_mb": job.downloaded_mb,
                                        "total_mb": job.total_mb,
                                        "speed_mbps": job.download_speed_mbps,
                                        "eta_seconds": job.eta_seconds
                                    })
                        break # Finished successful download stream

            # 3. Checksum verification if provided
            if job.checksum:
                computed_hash = hasher.hexdigest().lower()
                if computed_hash != job.checksum.lower().strip():
                    raise RuntimeError(f"Checksum mismatch! Expected {job.checksum}, got {computed_hash}")

            # 4. Finalize file
            if part_file.exists():
                if final_dest.exists():
                    final_dest.unlink()
                part_file.rename(final_dest)

            job.status = "completed"
            job.progress = 100.0
            job.downloaded_bytes = downloaded_bytes
            job.downloaded_mb = round(downloaded_bytes / (1024 ** 2), 2)
            job.updated_at = datetime.utcnow().isoformat()
            self._save_persisted_downloads()

            await download_broadcaster.broadcast({
                "type": "download_progress",
                "download_id": job.id,
                "game_id": job.game_id,
                "status": "completed",
                "progress": 100.0,
                "downloaded_mb": job.downloaded_mb,
                "message": "Download completed successfully."
            })
            logger.info(f"Download {job.id} completed ({job.downloaded_mb} MB).")

            # 5. Automatically initiate extraction & installation if configured
            if job.auto_install:
                logger.info(f"Triggering auto-install for download {job.id}...")
                await installer_engine.run_installation(
                    game_id=job.game_id,
                    game_name=job.game_name,
                    download_id=job.id,
                    archive_path=final_dest,
                    platform=job.platform,
                    predefined_exec=job.executable_path,
                    launch_args=job.launch_args,
                    cleanup_archive=settings.auto_cleanup_archive
                )

        except Exception as e:
            logger.error(f"Download {job.id} failed: {e}")
            job.status = "failed"
            job.error_message = str(e)
            job.updated_at = datetime.utcnow().isoformat()
            self._save_persisted_downloads()

            if part_file.exists():
                part_file.unlink(missing_ok=True)

            await download_broadcaster.broadcast({
                "type": "download_progress",
                "download_id": job.id,
                "game_id": job.game_id,
                "status": "failed",
                "error": str(e)
            })

    def _register_pending_game(self, req: DownloadCreateRequest, game_id: str):
        """Creates initial entry in games_data.json marked as downloading"""
        games = []
        if settings.games_data_file.exists():
            try:
                with open(settings.games_data_file, "r", encoding="utf-8") as f:
                    games = json.load(f)
            except Exception:
                games = []

        now_str = datetime.utcnow().isoformat()
        entry = {
            "id": game_id,
            "name": req.name,
            "description": req.description or f"{req.name} - Downloading on AWS EC2...",
            "thumbnail": req.thumbnail or "/thumbnails/default.jpg",
            "category": req.category,
            "game_type": req.platform,
            "platform": req.platform,
            "archive_type": req.archive_type,
            "download_url": req.download_url,
            "executable_path": req.executable_path or "",
            "launch_args": req.launch_args,
            "size_mb": 0.0,
            "game_size": 0.0,
            "supported_controls": req.supported_controls,
            "recommended_orientation": "landscape",
            "default_profile": "wasd",
            "is_installed": False,
            "installation_status": "downloading",
            "download_status": "downloading",
            "status": "downloading",
            "featured": False,
            "created_at": now_str,
            "updated_at": now_str
        }
        games.insert(0, entry)

        with open(settings.games_data_file, "w", encoding="utf-8") as f:
            json.dump(games, f, indent=2)

download_manager = DownloadManager()

