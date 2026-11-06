from typing import List, Optional, Literal
from pydantic import BaseModel, Field

GameType = Literal["linux", "windows", "browser", "retro"]
ControlProfile = Literal["wasd", "arrows", "action", "mouse", "custom"]
Orientation = Literal["landscape", "portrait", "any"]

class Game(BaseModel):
    id: str = Field(..., description="Unique game identifier slug (e.g., 'supertux-2')")
    name: str = Field(..., description="Human readable title")
    description: str = Field(..., description="Short overview and synopsis")
    thumbnail: str = Field(..., description="URL or relative path to game poster image")
    category: str = Field(default="Arcade", description="Genre e.g. Action, Arcade, Platformer, Retro, Racing, Puzzle")
    game_type: GameType = Field(default="linux", description="Executable runtime engine")
    executable_path: str = Field(..., description="Command or path to binary executable")
    launch_args: List[str] = Field(default_factory=list, description="Command line arguments passed to game")
    size_mb: float = Field(default=50.0, description="Approximate disk footprint in Megabytes")
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
    is_installed: bool = Field(default=True, description="Whether executable exists and is ready")
    status: str = Field(default="ready", description="Ready, installing, or error")
    featured: bool = Field(default=False, description="Whether to display in dashboard hero banner")
    created_at: Optional[str] = None

class GameCreate(BaseModel):
    id: str
    name: str
    description: str
    thumbnail: Optional[str] = "/thumbnails/default.jpg"
    category: str = "Arcade"
    game_type: GameType = "linux"
    executable_path: str
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
    game_type: Optional[GameType] = None
    executable_path: Optional[str] = None
    launch_args: Optional[List[str]] = None
    size_mb: Optional[float] = None
    supported_controls: Optional[List[str]] = None
    recommended_orientation: Optional[Orientation] = None
    default_profile: Optional[ControlProfile] = None
    featured: Optional[bool] = None

