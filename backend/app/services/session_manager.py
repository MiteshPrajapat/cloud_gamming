import uuid
import time
import asyncio
import logging
from datetime import datetime
from typing import Dict, Optional
import psutil

from backend.app.config import settings
from backend.app.models.game import Game
from backend.app.models.session import GamingSession, LaunchRequest
from backend.app.services.system_monitor import system_monitor
from backend.app.services.streaming_manager import streaming_manager
from backend.app.services.game_launcher import game_launcher
from backend.app.services.input_manager import input_manager

logger = logging.getLogger("cloudgaming.session")

class SessionManager:
    def __init__(self):
        self._active_sessions: Dict[str, GamingSession] = {}
        self._session_last_activity: Dict[str, float] = {}
        self._cleanup_task: Optional[asyncio.Task] = None

    def get_active_session_count(self) -> int:
        return len([s for s in self._active_sessions.values() if s.status in ("initializing", "running")])

    def get_session(self, session_id: str) -> Optional[GamingSession]:
        session = self._active_sessions.get(session_id)
        if session and session.started_at:
            session.duration_seconds = int((datetime.utcnow() - session.started_at).total_seconds())
        return session

    def get_current_session(self) -> Optional[GamingSession]:
        for s in self._active_sessions.values():
            if s.status in ("initializing", "running"):
                return self.get_session(s.session_id)
        return None

    def touch_session(self, session_id: str):
        """Updates last activity timestamp to prevent idle timeout"""
        self._session_last_activity[session_id] = time.time()

    async def create_session(self, game: Game, req: LaunchRequest, host_ip: str = "localhost") -> GamingSession:
        """
        Validates resources and launches a cloud gaming session.
        Enforces 1 concurrent session limit for AWS C7i 4-vCPU/8GB RAM.
        """
        # 1. Check system resources
        sys_status = system_monitor.get_system_status()
        if sys_status["cpu"]["percent"] >= settings.max_cpu_percent_threshold:
            raise RuntimeError(f"Server CPU too high ({sys_status['cpu']['percent']}%). Unable to launch.")
        if sys_status["ram"]["percent"] >= settings.max_ram_percent_threshold:
            raise RuntimeError(f"Server RAM too high ({sys_status['ram']['percent']}%). Unable to launch.")

        # 2. Check active sessions limit
        running_count = self.get_active_session_count()
        if running_count >= settings.max_concurrent_sessions:
            # Terminate any stale running session if old
            current = self.get_current_session()
            if current:
                logger.warning(f"Reaching max sessions ({settings.max_concurrent_sessions}). Automatically closing older session {current.session_id} to prioritize new game.")
                await self.stop_session(current.session_id)

        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow()

        # Build dynamic streaming URLs
        stream_url = f"http://{host_ip}:{settings.websockify_port}/vnc.html?autoconnect=true&resize=scale"
        ws_url = f"ws://{host_ip}:{settings.api_port}/ws/session/{session_id}"

        session = GamingSession(
            session_id=session_id,
            game_id=game.id,
            game_name=game.name,
            status="initializing",
            created_at=now,
            started_at=now,
            stream_url=stream_url,
            ws_url=ws_url,
            resolution=req.resolution or "1280x720",
            framerate=req.framerate or 30
        )
        self._active_sessions[session_id] = session
        self._session_last_activity[session_id] = time.time()

        try:
            # 3. Start Headless Streaming Stack
            streaming_manager.start_streaming_stack(resolution=session.resolution)

            # 4. Set Control Profile
            profile = req.control_profile or game.default_profile
            input_manager.set_session_profile(session_id, profile)

            # 5. Launch the game executable with software-rendering flags
            pid = game_launcher.launch_game(session_id, game)
            session.status = "running"
            logger.info(f"Session {session_id} successfully launched for game '{game.name}' (PID: {pid})")

            return session
        except Exception as e:
            session.status = "failed"
            session.error_message = str(e)
            logger.error(f"Failed to start session {session_id}: {e}")
            await self.stop_session(session_id)
            raise e

    async def stop_session(self, session_id: str) -> bool:
        """
        Stops the game, releases stuck keys, closes streams, and releases AWS EC2 resources.
        """
        session = self._active_sessions.get(session_id)
        if not session:
            return False

        logger.info(f"Stopping gaming session {session_id}...")
        session.status = "stopping"

        # 1. Release all held keys to prevent stuck keys
        input_manager.release_all_keys(session_id)

        # 2. Terminate game process tree
        game_launcher.stop_game(session_id)

        session.status = "terminated"
        if session_id in self._session_last_activity:
            del self._session_last_activity[session_id]

        logger.info(f"Session {session_id} cleanly terminated.")
        return True

    async def check_idle_sessions(self):
        """Background loop to terminate idle sessions"""
        while True:
            try:
                await asyncio.sleep(60)
                now = time.time()
                timeout = settings.session_idle_timeout_seconds
                for session_id, last_act in list(self._session_last_activity.items()):
                    if now - last_act > timeout:
                        logger.warning(f"Session {session_id} exceeded idle timeout of {timeout}s. Cleaning up.")
                        await self.stop_session(session_id)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in check_idle_sessions loop: {e}")

session_manager = SessionManager()

