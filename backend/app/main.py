import os
import asyncio
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.config import settings
from backend.app.api.games import router as games_router
from backend.app.api.sessions import router as sessions_router
from backend.app.api.server import router as server_router
from backend.app.api.websocket import router as ws_router
from backend.app.api.admin_installer import router as admin_router
from backend.app.services.session_manager import session_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("cloudgaming.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Optimized for AWS EC2 C7i Large (4 vCPU / 8 GB RAM, Software LLVMpipe rendering)")
    
    # Ensure game storage paths exist
    settings.games_dir.mkdir(parents=True, exist_ok=True)
    settings.downloads_dir.mkdir(parents=True, exist_ok=True)
    settings.installed_dir.mkdir(parents=True, exist_ok=True)
    settings.temp_dir.mkdir(parents=True, exist_ok=True)
    
    # Start idle session monitor background task
    cleanup_task = asyncio.create_task(session_manager.check_idle_sessions())
    
    yield
    
    # Shutdown actions
    logger.info("Shutting down cloud gaming platform...")
    cleanup_task.cancel()
    # Stop any active sessions cleanly
    curr = session_manager.get_current_session()
    if curr:
        await session_manager.stop_session(curr.session_id)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="High-performance lightweight personal cloud gaming server for AWS EC2 C7i.",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(games_router)
app.include_router(sessions_router)
app.include_router(server_router)
app.include_router(ws_router)
app.include_router(admin_router)

# Serve built frontend assets if present
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/")
    async def root():
        return {
            "platform": settings.app_name,
            "version": settings.app_version,
            "infrastructure": {
                "instance": "AWS EC2 C7i Large",
                "cpus": 4,
                "ram": "8 GB",
                "rendering": "CPU Software (LLVMpipe)",
                "max_concurrent_sessions": settings.max_concurrent_sessions
            },
            "docs_url": "/docs"
        }
