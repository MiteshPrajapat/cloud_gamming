import time
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.app.services.input_manager import input_manager
from backend.app.services.session_manager import session_manager
from backend.app.services.download_broadcaster import download_broadcaster

logger = logging.getLogger("cloudgaming.ws")
router = APIRouter(tags=["WebSocket Input"])

@router.websocket("/ws/admin/downloads")
async def websocket_admin_downloads(websocket: WebSocket):
    await download_broadcaster.connect(websocket)
    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        download_broadcaster.disconnect(websocket)
    except Exception:
        download_broadcaster.disconnect(websocket)

@router.websocket("/ws/session/{session_id}")
async def websocket_session_input(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info(f"WebSocket client connected for session {session_id}")
    session_manager.touch_session(session_id)

    # Track last joystick direction per connection to calculate differential releases
    current_joystick_dir = "CENTER"

    try:
        while True:
            raw_text = await websocket.receive_text()
            session_manager.touch_session(session_id)
            
            try:
                data = json.loads(raw_text)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")

            # 1. Ping / Pong for live latency / RTT indicator in UI
            if msg_type == "ping":
                client_time = data.get("client_time")
                await websocket.send_json({
                    "type": "pong",
                    "client_time": client_time,
                    "server_time": time.time()
                })
                continue

            # 2. Key events (Desktop / on-screen keyboard)
            elif msg_type == "keydown":
                key = data.get("key")
                if key:
                    input_manager.handle_keydown(session_id, key)

            elif msg_type == "keyup":
                key = data.get("key")
                if key:
                    input_manager.handle_keyup(session_id, key)

            # 3. Virtual Gamepad Action Buttons (A, B, X, Y, START, etc.)
            elif msg_type == "gamepad_button":
                btn = data.get("button")
                state = data.get("state", "down")
                if btn:
                    input_manager.handle_virtual_button(session_id, btn, state)

            # 4. Virtual Joystick
            elif msg_type == "joystick":
                direction = data.get("direction", "CENTER")
                input_manager.handle_joystick_direction(session_id, direction, current_joystick_dir)
                current_joystick_dir = direction

            # 5. D-Pad buttons
            elif msg_type == "dpad":
                direction = data.get("direction") # UP, DOWN, LEFT, RIGHT
                state = data.get("state", "down")
                if direction:
                    input_manager.handle_virtual_button(session_id, direction, state)

            # 6. Mouse Input (Desktop cursor lock)
            elif msg_type == "mousemove":
                x = data.get("x", 0.0)
                y = data.get("y", 0.0)
                input_manager.handle_mousemove(session_id, x, y)

            elif msg_type == "mousedown":
                btn = data.get("button", "left")
                input_manager.handle_mouse_click(session_id, btn, "down")

            elif msg_type == "mouseup":
                btn = data.get("button", "left")
                input_manager.handle_mouse_click(session_id, btn, "up")

            elif msg_type == "mousescroll":
                dy = data.get("delta_y", 0)
                input_manager.handle_mouse_scroll(session_id, dy)

            # 7. Switch Control Profile on the fly
            elif msg_type == "profile":
                profile_name = data.get("name")
                if profile_name:
                    input_manager.set_session_profile(session_id, profile_name)

            # 8. Force reset keys
            elif msg_type == "reset_keys":
                input_manager.release_all_keys(session_id)

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for session {session_id}")
    except Exception as e:
        logger.warning(f"WebSocket exception for session {session_id}: {e}")
    finally:
        # CRITICAL: Prevent stuck keys on browser close or connection drop
        input_manager.release_all_keys(session_id)

