import os
import shutil
import socket
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

    def is_port_in_use(self, port: int) -> bool:
        """Checks if a TCP port is currently listening on localhost"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.5)
                return s.connect_ex(('127.0.0.1', port)) == 0
        except Exception:
            return False

    def is_wm_running(self) -> bool:
        """Checks if openbox window manager process is running"""
        if not self._is_linux:
            return True
        try:
            res = subprocess.run(["pgrep", "-f", "openbox"], stdout=subprocess.DEVNULL, check=False)
            return res.returncode == 0
        except Exception:
            return False

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

    def _ensure_display_modes(self):
        """Ensures standard 4:3 legacy resolutions (800x600, 640x480, 1024x768) are registered in XrandR for DirectX/DirectDraw games"""
        if not self._is_linux:
            return
        env = os.environ.copy()
        env["DISPLAY"] = settings.display
        modes = [
            ("800x600", "38.25 800 832 912 1024 600 603 607 624 -hsync +vsync"),
            ("640x480", "25.20 640 656 752 800 480 490 492 525 -hsync -vsync"),
            ("1024x768", "65.00 1024 1048 1184 1344 768 771 777 806 -hsync -vsync"),
        ]
        for name, modeline in modes:
            try:
                cmd_new = ["xrandr", "--newmode", name] + modeline.split()
                subprocess.run(cmd_new, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
                subprocess.run(["xrandr", "--addmode", "screen", name], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
            except Exception:
                pass

    def start_streaming_stack(self, resolution: str = "1280x720") -> Dict[str, Any]:
        """
        Starts the headless gaming display stack on AWS Linux if not already active:
        1. Xvfb virtual framebuffer on DISPLAY (e.g. :99)
        2. Openbox ultra-lightweight window manager
        3. x11vnc server (port 5900)
        4. websockify WebSocket proxy for noVNC (port 6080)
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
        else:
            logger.debug(f"Display {settings.display} is already active.")

        # Ensure standard video modes (800x600, etc.) exist on virtual display
        self._ensure_display_modes()

        # 2. Start Openbox window manager if needed
        if not self.is_wm_running() and self._wm_proc is None:
            openbox_path = shutil.which("openbox")
            if openbox_path:
                logger.info("Starting Openbox window manager...")
                env = os.environ.copy()
                env["DISPLAY"] = settings.display
                self._wm_proc = subprocess.Popen([openbox_path], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            logger.debug("Openbox is already running.")

        # 3. Start x11vnc if not already listening on port 5900
        if not self.is_port_in_use(settings.vnc_port) and self._vnc_proc is None:
            x11vnc_path = shutil.which("x11vnc")
            if x11vnc_path:
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
        else:
            logger.debug(f"x11vnc port {settings.vnc_port} is already active.")

        # 4. Start websockify proxy if not already listening on port 6080
        if not self.is_port_in_use(settings.websockify_port) and self._websockify_proc is None:
            websockify_path = shutil.which("websockify")
            if websockify_path:
                logger.info(f"Starting websockify on port {settings.websockify_port} -> 127.0.0.1:{settings.vnc_port}...")
                ws_cmd = [
                    websockify_path,
                    "--web", "/usr/share/novnc",
                    str(settings.websockify_port),
                    f"127.0.0.1:{settings.vnc_port}"
                ]
                self._websockify_proc = subprocess.Popen(ws_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                time.sleep(0.5)
        else:
            logger.debug(f"websockify port {settings.websockify_port} is already active.")

        return {
            "active": True,
            "display": settings.display,
            "vnc_port": settings.vnc_port,
            "websockify_port": settings.websockify_port,
            "resolution": resolution,
            "type": "native_x11"
        }

    def stop_streaming_stack(self):
        """Stops only child processes spawned by this instance"""
        for name, proc in [
            ("websockify", self._websockify_proc),
            ("x11vnc", self._vnc_proc),
            ("openbox", self._wm_proc),
            ("Xvfb", self._xvfb_proc)
        ]:
            if proc and proc.poll() is None:
                logger.info(f"Terminating spawned {name} (PID: {proc.pid})...")
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
