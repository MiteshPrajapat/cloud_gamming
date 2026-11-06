import shutil
import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks

from backend.app.config import settings
from backend.app.models.download import DownloadJob, DownloadCreateRequest
from backend.app.models.install import InstallJob, InstallConfirmRequest
from backend.app.services.download_manager import download_manager
from backend.app.services.installer_engine import installer_engine, scan_candidate_executables

logger = logging.getLogger("cloudgaming.api.admin")
router = APIRouter(prefix="/api/admin", tags=["Admin Game Installer"])

def get_disk_storage_info() -> dict:
    """Returns disk metrics for the game storage partition on AWS EC2"""
    try:
        stat = shutil.disk_usage(str(settings.games_dir))
        total_gb = round(stat.total / (1024 ** 3), 2)
        used_gb = round(stat.used / (1024 ** 3), 2)
        free_gb = round(stat.free / (1024 ** 3), 2)
        percent_used = round((stat.used / stat.total) * 100, 1) if stat.total > 0 else 0
        is_low_space = free_gb <= settings.min_disk_free_gb_buffer

        return {
            "total_gb": total_gb,
            "used_gb": used_gb,
            "free_gb": free_gb,
            "percent_used": percent_used,
            "buffer_gb": settings.min_disk_free_gb_buffer,
            "is_low_space": is_low_space,
            "storage_path": str(settings.games_dir)
        }
    except Exception as e:
        logger.error(f"Failed to read disk metrics: {e}")
        return {
            "total_gb": 0.0,
            "used_gb": 0.0,
            "free_gb": 0.0,
            "percent_used": 0.0,
            "buffer_gb": settings.min_disk_free_gb_buffer,
            "is_low_space": False,
            "error": str(e)
        }

@router.get("/storage")
async def get_storage_status():
    """Returns EC2 persistent storage metrics, usage percentage, and buffer thresholds"""
    return get_disk_storage_info()

@router.post("/games/download", response_model=DownloadJob, status_code=202)
async def create_download_job(payload: DownloadCreateRequest):
    """
    Validates URL (blocking SSRF / EC2 metadata), checks disk space,
    and initiates asynchronous streaming download directly onto AWS EC2.
    """
    try:
        job = await download_manager.create_download(payload)
        return job
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Download creation failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/games/downloads", response_model=List[DownloadJob])
async def list_download_jobs(status: Optional[str] = Query(None, description="Filter by status (pending, downloading, completed, failed, cancelled)")):
    """Lists all active and past download jobs with real-time stats"""
    return download_manager.list_downloads(status)

@router.get("/games/download/{download_id}", response_model=DownloadJob)
async def get_download_job(download_id: str):
    """Retrieves current progress and status of a specific download job"""
    job = download_manager.get_download(download_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Download job '{download_id}' not found.")
    return job

@router.post("/games/download/{download_id}/cancel")
async def cancel_download_job(download_id: str):
    """Cancels an in-progress download job and immediately purges partial files"""
    success = await download_manager.cancel_download(download_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot cancel job (job not found or not in downloading state).")
    return {"status": "cancelled", "download_id": download_id}

@router.delete("/games/download/{download_id}")
async def delete_download_job(download_id: str):
    """Deletes download job record and any cached archive files on disk"""
    success = await download_manager.delete_download(download_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Download job '{download_id}' not found.")
    return {"status": "deleted", "download_id": download_id}

@router.post("/games/install/{download_id}", response_model=InstallJob)
async def trigger_installation(download_id: str, payload: Optional[InstallConfirmRequest] = None):
    """
    Manually triggers or re-runs archive extraction and executable discovery for a completed download.
    """
    download_job = download_manager.get_download(download_id)
    if not download_job:
        raise HTTPException(status_code=404, detail="Associated download job not found.")

    archive_path = Path(download_job.destination_path)
    if not archive_path.exists():
        raise HTTPException(status_code=400, detail=f"Archive file '{archive_path.name}' no longer exists on server.")

    exec_path = payload.executable_path if payload and payload.executable_path else download_job.executable_path
    launch_args = payload.launch_args if payload and payload.launch_args is not None else download_job.launch_args
    cleanup = payload.cleanup_archive if payload and payload.cleanup_archive is not None else settings.auto_cleanup_archive

    try:
        install_job = await installer_engine.run_installation(
            game_id=download_job.game_id,
            game_name=download_job.game_name,
            download_id=download_job.id,
            archive_path=archive_path,
            platform=download_job.platform,
            predefined_exec=exec_path,
            launch_args=launch_args,
            cleanup_archive=cleanup
        )
        return install_job
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Installation failed: {str(e)}")

@router.get("/games/install/{job_id}", response_model=InstallJob)
async def get_install_job_status(job_id: str):
    """Retrieves progress and candidate executable list for an installation job"""
    job = installer_engine.get_job(job_id)
    if not job:
        # Fallback check by game_id
        job = installer_engine.get_job_by_game_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Install job not found.")
    return job

@router.get("/games/detect-executables/{game_id}")
async def list_candidate_executables(game_id: str, platform: str = "linux"):
    """Scans an installed game directory and returns all detected runnable executables"""
    target_dir = settings.installed_dir / game_id
    if not target_dir.exists():
        raise HTTPException(status_code=404, detail=f"Game directory for '{game_id}' not found.")
    
    candidates = scan_candidate_executables(target_dir, platform=platform)
    return {"game_id": game_id, "candidates": candidates}

