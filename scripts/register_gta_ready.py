import os
import json
from pathlib import Path

GAME_DIR = Path("/home/ubuntu/cloud_gamming/games/installed/grand-theft-auto-san-andreas-bb2df4")
EXEC_PATH = GAME_DIR / "gta_sa.exe"
ARCHIVE_PATH = GAME_DIR / "grand-theft-auto-san-andreas-bb2df4_download.exe"

# 1. Clean up downloaded archive to save space
if ARCHIVE_PATH.exists():
    ARCHIVE_PATH.unlink()
    print("Cleaned up downloaded SFX archive.")

# 2. Grant executable permissions
if EXEC_PATH.exists():
    os.chmod(EXEC_PATH, 0o755)
    print("Granted chmod +x to gta_sa.exe.")

# 3. Update games_data.json
GAMES_JSON = Path("/home/ubuntu/cloud_gamming/backend/games_data.json")
with open(GAMES_JSON, "r", encoding="utf-8") as f:
    games = json.load(f)

# Remove any old incomplete or pending entries for san-andreas
games = [g for g in games if "san-andreas" not in g.get("id", "")]

# Add ready GTA San Andreas entry at top of games
gta_entry = {
    "id": "gta-san-andreas",
    "name": "Grand Theft Auto: San Andreas",
    "description": "Legendary open-world action-adventure game set in early 90s San Andreas. Follow CJ as he takes back the streets of Los Santos with full PC controls.",
    "thumbnail": "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80",
    "category": "Action",
    "game_type": "windows",
    "platform": "windows",
    "executable_path": str(EXEC_PATH),
    "installed_path": str(GAME_DIR),
    "launch_args": [],
    "size_mb": 4123.0,
    "game_size": 4123.0,
    "supported_controls": ["keyboard", "mouse", "touch_joystick", "gamepad"],
    "recommended_orientation": "landscape",
    "default_profile": "wasd",
    "is_installed": True,
    "installation_status": "installed",
    "download_status": "completed",
    "status": "ready",
    "featured": True,
    "created_at": "2026-11-06T14:14:00Z",
    "updated_at": "2026-11-06T14:14:00Z"
}

games.insert(0, gta_entry)

with open(GAMES_JSON, "w", encoding="utf-8") as f:
    json.dump(games, f, indent=2)

print("Grand Theft Auto: San Andreas successfully registered as READY in Game Library!")
