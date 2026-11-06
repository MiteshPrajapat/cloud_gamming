from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field

InstallState = Literal["pending", "extracting", "configuring", "installed", "failed"]

class InstallJob(BaseModel):
    id: str
    game_id: str
    game_name: str
    download_id: str
    status: InstallState = "pending"
    installation_path: str
    executable_path: Optional[str] = None
    detected_executables: List[str] = []
    platform: str = "linux"
    launch_args: List[str] = []
    error_message: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: Optional[str] = None

class InstallConfirmRequest(BaseModel):
    executable_path: str = Field(..., description="Selected binary executable to launch")
    launch_args: Optional[List[str]] = Field(default=[], description="Launch arguments passed to the executable")
    cleanup_archive: bool = Field(default=True, description="Delete original archive after successful installation")

