import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
GAMES_DIR = Path(os.getenv("GAMES_DIR", str(BASE_DIR / "games")))
GAMES_DATA_FILE = Path(os.getenv("GAMES_DATA_FILE", str(BASE_DIR / "backend" / "games_data.json")))

class Settings(BaseModel):
    app_name: str = "Personal Cloud Gaming Platform"
    app_version: str = "1.0.0"
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Server ports & display
    api_host: str = os.getenv("API_HOST", "0.0.0.0")
    api_port: int = int(os.getenv("API_PORT", "8000"))
    display: str = os.getenv("DISPLAY", ":99")
    vnc_port: int = int(os.getenv("VNC_PORT", "5900"))
    websockify_port: int = int(os.getenv("WEBSOCKIFY_PORT", "6080"))
    
    # Cloud Gaming Resource Management (Tailored for AWS C7i Large 4 vCPU / 8 GB RAM)
    max_concurrent_sessions: int = int(os.getenv("MAX_CONCURRENT_SESSIONS", "1"))
    session_idle_timeout_seconds: int = int(os.getenv("SESSION_IDLE_TIMEOUT_SECONDS", "1800")) # 30 mins
    max_cpu_percent_threshold: float = float(os.getenv("MAX_CPU_PERCENT", "98.0"))
    max_ram_percent_threshold: float = float(os.getenv("MAX_RAM_PERCENT", "98.0"))
    
    # Default Display Resolution for CPU rendering efficiency
    default_screen_width: int = int(os.getenv("SCREEN_WIDTH", "1280"))
    default_screen_height: int = int(os.getenv("SCREEN_HEIGHT", "720"))
    default_screen_depth: int = int(os.getenv("SCREEN_DEPTH", "24"))
    default_framerate: int = int(os.getenv("FRAMERATE", "30")) # 30 FPS optimal for CPU llvmpipe
    
    # Software Rendering Env Variables (Crucial for AWS EC2 instance without dedicated GPU)
    software_rendering_env: dict = {
        "DISPLAY": os.getenv("DISPLAY", ":99"),
        "LIBGL_ALWAYS_SOFTWARE": "1",
        "GALLIUM_DRIVER": "llvmpipe",
        "MESA_GL_VERSION_OVERRIDE": "3.3",
        "MESA_GLSL_VERSION_OVERRIDE": "330",
        "SDL_VIDEODRIVER": "x11",
        "PULSE_SERVER": "127.0.0.1:4713"
    }
    
    # Paths
    games_dir: Path = GAMES_DIR
    games_data_file: Path = GAMES_DATA_FILE
    
    # Security
    cors_origins: list[str] = ["*"]
    upload_max_size_mb: int = 300 # Max 300MB game archive uploads

settings = Settings()

