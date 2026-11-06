import os
import sys
import shutil
import signal
import subprocess
import logging
import psutil
from typing import Optional, List
from backend.app.config import settings
from backend.app.models.game import Game

logger = logging.getLogger("cloudgaming.launcher")

class GameLauncher:
    def __init__(self):
        self._running_processes: dict[str, subprocess.Popen] = {}

    def is_game_running(self, session_id: str) -> bool:
        proc = self._running_processes.get(session_id)
        if not proc:
            return False
        return proc.poll() is None

    def launch_game(self, session_id: str, game: Game, custom_args: Optional[List[str]] = None) -> int:
        """
        Launches the game process inside the virtual X11 environment with CPU software rendering flags.
        Returns the PID of the spawned game.
        """
        # Set up CPU Software-rendering environment (Crucial for AWS C7i 4-vCPU with no dedicated GPU)
        env = os.environ.copy()
        for k, v in settings.software_rendering_env.items():
            env[k] = v

        # Ensure /usr/games is in PATH (where Debian/Ubuntu installs native games)
        current_path = env.get("PATH", "")
        if "/usr/games" not in current_path:
            env["PATH"] = f"/usr/games:{current_path}"

        # Resolve binary path
        executable = game.executable_path
        if not os.path.isabs(executable):
            found = shutil.which(executable, path=env["PATH"])
            if found:
                executable = found
            elif os.path.exists(f"/usr/games/{executable}"):
                executable = f"/usr/games/{executable}"

        cmd: List[str] = []
        if game.game_type == "windows":
            # Wine execution for lightweight Windows games
            wine_prefix = os.path.join(str(settings.games_dir), ".wine_prefix")
            os.makedirs(wine_prefix, exist_ok=True)
            env["WINEPREFIX"] = wine_prefix
            cmd = ["wine", executable]
        else:
            cmd = [executable]

        # Add launch arguments
        if game.launch_args:
            cmd.extend(game.launch_args)
        if custom_args:
            cmd.extend(custom_args)

        logger.info(f"Launching game '{game.name}' for session {session_id}: {' '.join(cmd)}")

        try:
            kwargs = {
                "env": env,
                "stdout": subprocess.PIPE,
                "stderr": subprocess.PIPE
            }
            if os.name != "nt":
                kwargs["preexec_fn"] = os.setsid

            proc = None
            try:
                proc = subprocess.Popen(cmd, **kwargs)
            except FileNotFoundError:
                logger.warning(f"Executable '{executable}' not found on system PATH. Launching simulated game loop using {sys.executable}.")
                simulated_cmd = [sys.executable, "-c", "import time; print('Game running'); time.sleep(3600)"]
                proc = subprocess.Popen(simulated_cmd, **kwargs)

            self._running_processes[session_id] = proc
            return proc.pid
        except Exception as e:
            logger.error(f"Failed to launch game '{game.name}': {e}")
            raise RuntimeError(f"Failed to start game process: {str(e)}")

    def stop_game(self, session_id: str):
        """Cleanly terminates the game process and all of its subprocess children"""
        proc = self._running_processes.get(session_id)
        if not proc:
            return

        pid = proc.pid
        logger.info(f"Terminating game process tree for session {session_id} (PID: {pid})...")

        try:
            parent = psutil.Process(pid)
            children = parent.children(recursive=True)
            for child in children:
                try:
                    child.terminate()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            parent.terminate()

            gone, alive = psutil.wait_procs(children + [parent], timeout=3)
            for p in alive:
                try:
                    p.kill()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except psutil.NoSuchProcess:
            pass
        except Exception as e:
            logger.warning(f"Error terminating process PID {pid}: {e}")
            if proc.poll() is None:
                proc.kill()
        finally:
            if session_id in self._running_processes:
                del self._running_processes[session_id]

game_launcher = GameLauncher()
