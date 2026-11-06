from fastapi import APIRouter
from backend.app.services.system_monitor import system_monitor
from backend.app.services.session_manager import session_manager

router = APIRouter(prefix="/api/server", tags=["Server"])

@router.get("/status")
async def get_server_status():
    active_count = session_manager.get_active_session_count()
    return system_monitor.get_system_status(active_sessions_count=active_count)

