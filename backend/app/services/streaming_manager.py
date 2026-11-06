import os
import shutil
import subprocess
import time
import logging
from typing import Dict, Any, Optional
from backend.app.config import settings

logger = logging.getLogger("cloudgaming.streaming")

class StreamingManager:
    def __init__(self):
        self._xvfb_proc: Optional[subprocess.Popen] = None
        self._wm_proc: Optional[subprocess.Popen] = None
        self._vnc_proc: Optional[subprocess.Popen] = None
        self._websockify_proc: Optional[subprocess.Popen] = None
        self._is_linux = (os.name != "nt")

    def is_display_active(self) -> bool:
        """Checks if virtual display is up and accessible"""
        if not self._is_linux:
            return True
        try:
            res = subprocess.run(
                ["xdpyinfo", "-display", settings.display],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False
            )
            return res.returncode == 0
        except Exception:
            return False

    def start_streaming_stack(self, resolution: str = "1280x720") -> Dict[str, Any]:
        """
        Starts the headless gaming display stack on AWS Linux:
        1. Xvfb virtual framebuffer on DISPLAY (e.g. :99)
        2. Openbox ultra-lightweight window manager
        3. x11vnc server
        4. websockify WebSocket proxy for noVNC
        """
        if not self._is_linux:
            logger.info("Local non-Linux development detected: streaming stack mock active.")
            return {
                "active": True,
                "display": settings.display,
                "vnc_port": settings.vnc_port,
                "websockify_port": settings.websockify_port,
                "resolution": resolution,
                "type": "mock_or_dev"
            }

        # 1. Start Xvfb if not already running
        if not self.is_display_active():
            xvfb_path = shutil.which("Xvfb")
            if xvfb_path:
                logger.info(f"Starting Xvfb on display {settings.display} with {resolution}x{settings.default_screen_depth}...")
                xvfb_cmd = [
                    xvfb_path,
                    settings.display,
                    "-screen", "0", f"{resolution}x{settings.default_screen_depth}",
                    "-ac",
                    "+extension", "GLX",
                    "+extension", "RENDER",
                    "-noreset"
                ]
                self._xvfb_proc = subprocess.Popen(xvfb_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                time.sleep(1.0)
            else:
                logger.warning("Xvfb binary not found. Please install xvfb on Ubuntu: apt-get install -y xvfb")

        # 2. Start Openbox window manager if needed
        openbox_path = shutil.which("openbox")
        if openbox_path and self._wm_proc is None:
            logger.info("Starting Openbox window manager...")
            env = os.environ.copy()
            env["DISPLAY"] = settings.display
            self._wm_proc = subprocess.Popen([openbox_path], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # 3. Start x11vnc if needed
        x11vnc_path = shutil.which("x11vnc")
        if x11vnc_path and self._vnc_proc is None:
            logger.info(f"Starting x11vnc on port {settings.vnc_port}...")
            vnc_cmd = [
                x11vnc_path,
                "-display", settings.display,
                "-forever",
                "-shared",
                "-rfbport", str(settings.vnc_port),
                "-nopw",
                "-repeat",
                "-noxdamage",
                "-wait", "50",
                "-defer", "50"
            ]
            self._vnc_proc = subprocess.Popen(vnc_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(0.5)

        # 4. Start websockify proxy if needed
        websockify_path = shutil.which("websockify")
        if websockify_path and self._websockify_proc is None:
            logger.info(f"Starting websockify on port {settings.websockify_port} -> 127.0.0.1:{settings.vnc_port}...")
            ws_cmd = [
                websockify_path,
                str(settings.websockify_port),
                f"127.0.0.1:{settings.vnc_port}"
            ]
            self._websockify_proc = subprocess.Popen(ws_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(0.5)

        return {
            "active": True,
            "display": settings.display,
            "vnc_port": settings.vnc_port,
            "websockify_port": settings.websockify_port,
            "resolution": resolution,
            "type": "native_x11"
        }

    def stop_streaming_stack(self):
        """Stops the streaming stack components if owned by this process"""
        for name, proc in [
            ("websockify", self._websockify_proc),
            ("x11vnc", self._vnc_proc),
            ("openbox", self._wm_proc),
            ("Xvfb", self._xvfb_proc)
        ]:
            if proc and proc.poll() is None:
                logger.info(f"Terminating {name} (PID: {proc.pid})...")
                proc.terminate()
                try:
                    proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    proc.kill()

        self._websockify_proc = None
        self._vnc_proc = None
        self._wm_proc = None
        self._xvfb_proc = None

streaming_manager = StreamingManager()

