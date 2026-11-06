from typing import List, Optional, Literal
from pydantic import BaseModel, Field

GamePlatform = Literal["linux", "windows", "html5", "retro"]
ControlProfile = Literal["wasd", "arrows", "action", "mouse", "custom"]
Orientation = Literal["landscape", "portrait", "any"]
InstallationStatus = Literal["not_installed", "downloading", "extracting", "installed", "failed"]
DownloadStatus = Literal["idle", "downloading", "completed", "failed", "cancelled"]
ArchiveType = Literal["zip", "tar.gz", "tar.xz", "tar", "7z", "direct_executable", "installer", "unknown"]

class Game(BaseModel):
    id: str = Field(..., description="Unique game identifier slug (e.g., 'supertux-2')")
    name: str = Field(..., description="Human readable title")
    description: str = Field(default="", description="Short overview and synopsis")
    thumbnail: str = Field(default="/thumbnails/default.jpg", description="URL or relative path to game poster image")
    category: str = Field(default="Arcade", description="Genre e.g. Action, Arcade, Platformer, Retro, Racing, Puzzle")
    
    # Engine / Platform mappings
    game_type: GamePlatform = Field(default="linux", description="Runtime engine (linux, windows, html5, retro)")
    platform: Optional[GamePlatform] = Field(default="linux", description="Game platform alias")
    archive_type: Optional[str] = Field(default="zip", description="ZIP, TAR.GZ, TAR.XZ, TAR, 7Z, Direct Executable, Installer")
    
    # Paths & Execution
    executable_path: str = Field(default="", description="Command or path to binary executable")
    installed_path: Optional[str] = Field(default=None, description="Local folder path where game is installed")
    download_url: Optional[str] = Field(default=None, description="Source URL where game was downloaded from")
    launch_args: List[str] = Field(default_factory=list, description="Command line arguments passed to game")
    
    # Sizing & Progress Status
    size_mb: float = Field(default=50.0, description="Approximate disk footprint in Megabytes")
    game_size: Optional[float] = Field(default=50.0, description="Alias for size_mb")
    installation_status: InstallationStatus = Field(default="installed", description="Current installation progress status")
    download_status: DownloadStatus = Field(default="completed", description="Current download status")
    is_installed: bool = Field(default=True, description="Whether executable exists and is ready to play")
    status: str = Field(default="ready", description="Ready, installing, downloading, or error")
    
    # Controls & UI Metadata
    supported_controls: List[str] = Field(
        default=["keyboard", "touch_dpad", "touch_joystick", "gamepad"],
        description="Supported input methods"
    )
    recommended_orientation: Orientation = Field(
        default="landscape",
        description="Recommended orientation for mobile players"
    )
    default_profile: ControlProfile = Field(
        default="wasd",
        description="Default virtual mobile controller button mapping"
    )
    featured: bool = Field(default=False, description="Whether to display in dashboard hero banner")
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class GameCreate(BaseModel):
    id: str
    name: str
    description: str = ""
    thumbnail: Optional[str] = "/thumbnails/default.jpg"
    category: str = "Arcade"
    game_type: GamePlatform = "linux"
    platform: Optional[GamePlatform] = "linux"
    archive_type: Optional[str] = "zip"
    executable_path: str = ""
    installed_path: Optional[str] = None
    download_url: Optional[str] = None
    launch_args: List[str] = []
    size_mb: float = 50.0
    supported_controls: List[str] = ["keyboard", "touch_dpad", "touch_joystick", "gamepad"]
    recommended_orientation: Orientation = "landscape"
    default_profile: ControlProfile = "wasd"
    featured: bool = False

class GameUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    thumbnail: Optional[str] = None
    category: Optional[str] = None
    game_type: Optional[GamePlatform] = None
    platform: Optional[GamePlatform] = None
    archive_type: Optional[str] = None
    executable_path: Optional[str] = None
    installed_path: Optional[str] = None
    download_url: Optional[str] = None
    launch_args: Optional[List[str]] = None
    size_mb: Optional[float] = None
    game_size: Optional[float] = None
    installation_status: Optional[InstallationStatus] = None
    download_status: Optional[DownloadStatus] = None
    is_installed: Optional[bool] = None
    status: Optional[str] = None
    supported_controls: Optional[List[str]] = None
    recommended_orientation: Optional[Orientation] = None
    default_profile: Optional[ControlProfile] = None
    featured: Optional[bool] = None
