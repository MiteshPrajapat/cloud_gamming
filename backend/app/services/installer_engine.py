import os
import stat
import json
import shutil
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any

from backend.app.config import settings
from backend.app.models.install import InstallJob
from backend.app.core.security import safe_extract_archive_with_limits
from backend.app.services.download_broadcaster import download_broadcaster

logger = logging.getLogger("cloudgaming.installer")

def detect_archive_format(file_path: Path) -> str:
    """Detects format from filename and file magic bytes"""
    name = file_path.name.lower()
    if name.endswith(".zip"):
        return "zip"
    if name.endswith((".tar.gz", ".tgz")):
        return "tar.gz"
    if name.endswith((".tar.xz", ".txz")):
        return "tar.xz"
    if name.endswith(".tar"):
        return "tar"
    if name.endswith(".7z"):
        return "7z"
    if name.endswith((".sh", ".bin", ".x86_64", ".x86", ".exe")):
        return "direct_executable"

    # Check magic bytes
    try:
        with open(file_path, "rb") as f:
            magic = f.read(6)
            if magic.startswith(b"PK\x03\x04"):
                return "zip"
            if magic.startswith(b"\x1f\x8b"):
                return "tar.gz"
            if magic.startswith(b"7z\xbc\xaf\x27\x1c"):
                return "7z"
            if magic.startswith(b"\xfd7zXZ\x00"):
                return "tar.xz"
            if magic.startswith(b"\x7fELF") or magic.startswith(b"MZ"):
                return "direct_executable"
    except Exception:
        pass

    return "zip" # default fallback

def scan_candidate_executables(target_dir: Path, platform: str = "linux") -> List[str]:
    """
    Scans the extracted game directory for runnable candidate executables.
    """
    candidates = []
    platform = platform.lower()

    # Extensions to exclude
    IGNORED_EXTS = {
        ".txt", ".md", ".json", ".xml", ".png", ".jpg", ".jpeg", ".gif", ".ico",
        ".wav", ".ogg", ".mp3", ".flac", ".cfg", ".ini", ".conf", ".so", ".dll",
        ".zip", ".tar", ".gz", ".xz", ".7z", ".pyc", ".log", ".pdf", ".desktop"
    }

    for root, _, files in os.walk(target_dir):
        for f in files:
            full_path = Path(root) / f
            rel_path = str(full_path.relative_to(target_dir)).replace("\\", "/")
            ext = full_path.suffix.lower()

            if ext in IGNORED_EXTS:
                continue

            if platform == "html5":
                if f.lower() == "index.html":
                    candidates.append(rel_path)
            elif platform == "windows":
                if f.lower().endswith(".exe") and not f.lower().startswith("uninstall"):
                    candidates.append(rel_path)
            else: # Linux
                # Check for executable bit, known binary extension, or ELF header
                has_ext = f.lower().endswith((".sh", ".x86_64", ".x86", ".bin"))
                
                is_elf = False
                is_shebang = False
                try:
                    with open(full_path, "rb") as test_f:
                        header = test_f.read(4)
                        if header == b"\x7fELF":
                            is_elf = True
                        elif header.startswith(b"#!"):
                            is_shebang = True
                except Exception:
                    pass

                is_exec = os.access(full_path, os.X_OK) and (is_elf or is_shebang or has_ext or "." not in f)

                if (is_exec or has_ext or is_elf or is_shebang) and not f.lower().startswith("uninstall"):
                    # Grant chmod +x to candidate
                    try:
                        os.chmod(full_path, os.stat(full_path).st_mode | stat.S_IEXEC)
                    except Exception:
                        pass
                    candidates.append(rel_path)

    # Sort candidates by relevance (prefer binaries matching parent or common names)
    candidates.sort(key=lambda x: (
        0 if any(k in x.lower() for k in ["start", "run", "launch", "game", "play"]) else 1,
        len(x)
    ))
    return candidates

class InstallerEngine:
    def __init__(self):
        self._jobs: Dict[str, InstallJob] = {}

    def get_job(self, job_id: str) -> Optional[InstallJob]:
        return self._jobs.get(job_id)

    def get_job_by_game_id(self, game_id: str) -> Optional[InstallJob]:
        for j in self._jobs.values():
            if j.game_id == game_id:
                return j
        return None

    async def run_installation(
        self,
        game_id: str,
        game_name: str,
        download_id: str,
        archive_path: Path,
        platform: str = "linux",
        predefined_exec: Optional[str] = None,
        launch_args: Optional[List[str]] = None,
        cleanup_archive: bool = True
    ) -> InstallJob:
        """
        Executes the extraction, file verification, executable detection,
        and registration of the game into the game library.
        """
        job_id = f"inst_{download_id.replace('dl_', '')}"
        install_dir = settings.installed_dir / game_id
        
        job = InstallJob(
            id=job_id,
            game_id=game_id,
            game_name=game_name,
            download_id=download_id,
            status="extracting",
            installation_path=str(install_dir),
            platform=platform,
            launch_args=launch_args or []
        )
        self._jobs[job_id] = job

        await download_broadcaster.broadcast({
            "type": "install_progress",
            "install_id": job_id,
            "download_id": download_id,
            "game_id": game_id,
            "status": "extracting",
            "progress": 25,
            "message": "Extracting game archive..."
        })

        try:
            install_dir.mkdir(parents=True, exist_ok=True)
            archive_format = detect_archive_format(archive_path)

            if archive_format == "direct_executable":
                # Copy binary directly
                dest_file = install_dir / archive_path.name
                shutil.copy2(archive_path, dest_file)
                try:
                    os.chmod(dest_file, os.stat(dest_file).st_mode | stat.S_IEXEC)
                except Exception:
                    pass
                extracted_files = [archive_path.name]
            else:
                # Extract archive
                extracted_files = safe_extract_archive_with_limits(archive_path, install_dir)

            job.status = "configuring"
            await download_broadcaster.broadcast({
                "type": "install_progress",
                "install_id": job_id,
                "download_id": download_id,
                "game_id": game_id,
                "status": "configuring",
                "progress": 70,
                "message": "Scanning and configuring game executables..."
            })

            # Detect executable candidates
            candidates = scan_candidate_executables(install_dir, platform=platform)
            job.detected_executables = candidates

            chosen_exec = predefined_exec
            if not chosen_exec:
                if candidates:
                    chosen_exec = candidates[0]
                else:
                    # If direct single file or fallback
                    chosen_exec = archive_path.name

            job.executable_path = chosen_exec

            # Compute installed size
            total_size_bytes = 0
            for root, _, files in os.walk(install_dir):
                for f in files:
                    try:
                        total_size_bytes += os.path.getsize(os.path.join(root, f))
                    except Exception:
                        pass
            size_mb = round(total_size_bytes / (1024 ** 2), 1)

            # Update or register game in games_data.json
            self._update_game_catalog(
                game_id=game_id,
                name=game_name,
                executable_rel_path=chosen_exec,
                install_dir=install_dir,
                size_mb=size_mb,
                platform=platform,
                launch_args=launch_args or []
            )

            job.status = "installed"
            job.updated_at = datetime.utcnow().isoformat()

            # Clean up archive if configured
            if cleanup_archive and archive_path.exists():
                try:
                    archive_path.unlink()
                    logger.info(f"Cleaned up downloaded archive {archive_path}")
                except Exception as e:
                    logger.warning(f"Could not delete archive {archive_path}: {e}")

            await download_broadcaster.broadcast({
                "type": "install_progress",
                "install_id": job_id,
                "download_id": download_id,
                "game_id": game_id,
                "status": "installed",
                "progress": 100,
                "executable_path": chosen_exec,
                "message": f"Successfully installed {game_name}!"
            })

            return job
        except Exception as e:
            job.status = "failed"
            job.error_message = str(e)
            job.updated_at = datetime.utcnow().isoformat()
            logger.error(f"Installation failed for game '{game_name}': {e}")
            await download_broadcaster.broadcast({
                "type": "install_progress",
                "install_id": job_id,
                "download_id": download_id,
                "game_id": game_id,
                "status": "failed",
                "error": str(e)
            })
            raise e

    def _update_game_catalog(
        self,
        game_id: str,
        name: str,
        executable_rel_path: str,
        install_dir: Path,
        size_mb: float,
        platform: str,
        launch_args: List[str]
    ):
        """Adds or updates game in games_data.json"""
        games = []
        if settings.games_data_file.exists():
            try:
                with open(settings.games_data_file, "r", encoding="utf-8") as f:
                    games = json.load(f)
            except Exception:
                games = []

        # Executable full path
        full_exec_path = str(install_dir / executable_rel_path)

        target_idx = None
        for idx, g in enumerate(games):
            if g.get("id") == game_id:
                target_idx = idx
                break

        now_str = datetime.utcnow().isoformat()

        if target_idx is not None:
            games[target_idx].update({
                "executable_path": full_exec_path,
                "installed_path": str(install_dir),
                "is_installed": True,
                "installation_status": "installed",
                "download_status": "completed",
                "status": "ready",
                "size_mb": size_mb,
                "game_size": size_mb,
                "platform": platform,
                "game_type": "windows" if platform == "windows" else ("browser" if platform == "html5" else "linux"),
                "updated_at": now_str
            })
            if launch_args:
                games[target_idx]["launch_args"] = launch_args
        else:
            new_entry = {
                "id": game_id,
                "name": name,
                "description": f"{name} - Installed via Cloud Gaming Auto-Installer.",
                "thumbnail": "/thumbnails/default.jpg",
                "category": "Action",
                "game_type": "windows" if platform == "windows" else ("browser" if platform == "html5" else "linux"),
                "platform": platform,
                "executable_path": full_exec_path,
                "installed_path": str(install_dir),
                "launch_args": launch_args or [],
                "size_mb": size_mb,
                "game_size": size_mb,
                "supported_controls": ["keyboard", "touch_dpad", "touch_joystick", "gamepad"],
                "recommended_orientation": "landscape",
                "default_profile": "wasd",
                "is_installed": True,
                "installation_status": "installed",
                "download_status": "completed",
                "status": "ready",
                "featured": False,
                "created_at": now_str,
                "updated_at": now_str
            }
            games.append(new_entry)

        with open(settings.games_data_file, "w", encoding="utf-8") as f:
            json.dump(games, f, indent=2)

installer_engine = InstallerEngine()
