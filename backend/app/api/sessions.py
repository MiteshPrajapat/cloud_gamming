from fastapi import APIRouter, HTTPException, Request
from backend.app.models.session import GamingSession, LaunchRequest
from backend.app.models.input import InputPayload
from backend.app.services.session_manager import session_manager
from backend.app.services.input_manager import input_manager
from backend.app.api.games import load_games_from_disk

router = APIRouter(prefix="/api", tags=["Sessions"])

@router.post("/games/{game_id}/launch", response_model=GamingSession)
async def launch_game(game_id: str, req: LaunchRequest, request: Request):
    games = load_games_from_disk()
    game = next((g for g in games if g.id == game_id), None)
    if not game:
        raise HTTPException(status_code=404, detail=f"Game '{game_id}' not found.")

    host_header = request.headers.get("host", "localhost")
    host_ip = host_header.split(":")[0]

    try:
        session = await session_manager.create_session(game, req, host_ip=host_ip, host_header=host_header)
        return session
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Launch failed: {str(e)}")

@router.post("/sessions/{session_id}/stop")
async def stop_session(session_id: str):
    success = await session_manager.stop_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return {"message": f"Session '{session_id}' stopped.", "session_id": session_id}

@router.get("/sessions/active", response_model=GamingSession)
async def get_active_session():
    current = session_manager.get_current_session()
    if not current:
        raise HTTPException(status_code=404, detail="No active gaming session.")
    return current

@router.get("/sessions/{session_id}", response_model=GamingSession)
async def get_session(session_id: str):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return session

@router.post("/sessions/{session_id}/input")
async def post_input(session_id: str, payload: InputPayload):
    """Fallback REST input injection endpoint"""
    session = session_manager.get_session(session_id)
    if not session or session.status != "running":
        raise HTTPException(status_code=400, detail="Session is not running.")

    session_manager.touch_session(session_id)

    if payload.type == "keydown" and payload.key:
        input_manager.handle_keydown(session_id, payload.key)
    elif payload.type == "keyup" and payload.key:
        input_manager.handle_keyup(session_id, payload.key)
    elif payload.type == "gamepad_button" and payload.button:
        # payload.key contains 'down' or 'up'
        input_manager.handle_virtual_button(session_id, payload.button, payload.key or "down")
    elif payload.type == "joystick" and payload.direction:
        input_manager.handle_joystick_direction(session_id, payload.direction)
    elif payload.type == "reset_keys":
        input_manager.release_all_keys(session_id)

    return {"status": "ok"}

