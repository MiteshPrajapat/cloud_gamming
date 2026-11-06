from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field

DownloadState = Literal["pending", "downloading", "completed", "failed", "cancelled"]

class DownloadCreateRequest(BaseModel):
    name: str = Field(..., description="Human-readable title of the game")
    download_url: str = Field(..., description="Direct HTTP or HTTPS URL to download game archive")
    description: Optional[str] = ""
    thumbnail: Optional[str] = "/thumbnails/default.jpg"
    platform: Literal["linux", "windows", "html5"] = "linux"
    category: str = "Arcade"
    archive_type: Optional[str] = "zip" # zip, tar.gz, tar.xz, tar, 7z, direct_executable, installer
    executable_path: Optional[str] = "" # Can be left blank for automatic detection
    launch_args: List[str] = []
    supported_controls: List[str] = ["keyboard", "touch_dpad", "touch_joystick", "gamepad"]
    checksum: Optional[str] = None # Optional SHA256 or MD5 checksum
    checksum_type: Optional[str] = "sha256"
    auto_install: bool = True # Automatically extract and configure after download finishes

class DownloadJob(BaseModel):
    id: str = Field(..., description="Unique download job identifier (e.g. 'dl_...')")
    game_id: str
    game_name: str
    source_url: str
    destination_path: str
    status: DownloadState = "pending"
    progress: float = 0.0 # 0.0 to 100.0%
    downloaded_bytes: int = 0
    total_bytes: Optional[int] = None
    downloaded_mb: float = 0.0
    total_mb: Optional[float] = None
    download_speed_mbps: float = 0.0
    eta_seconds: Optional[int] = None
    checksum: Optional[str] = None
    checksum_type: Optional[str] = "sha256"
    platform: str = "linux"
    archive_type: Optional[str] = None
    auto_install: bool = True
    executable_path: Optional[str] = None
    launch_args: List[str] = []
    error_message: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: Optional[str] = None

