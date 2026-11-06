from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field

SessionStatus = Literal["initializing", "running", "stopping", "terminated", "failed"]

class LaunchRequest(BaseModel):
    resolution: Optional[str] = "1280x720"
    framerate: Optional[int] = 30
    control_profile: Optional[str] = "wasd"

class GamingSession(BaseModel):
    session_id: str
    game_id: str
    game_name: str
    status: SessionStatus = "initializing"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    stream_url: str = ""
    ws_url: str = ""
    resolution: str = "1280x720"
    framerate: int = 30
    cpu_usage_percent: float = 0.0
    ram_usage_mb: float = 0.0
    duration_seconds: int = 0
    client_ip: Optional[str] = None
    error_message: Optional[str] = None

