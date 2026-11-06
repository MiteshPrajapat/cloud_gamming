import os
import shutil
import subprocess
import logging
from typing import Dict, Set, Optional, List
from collections import defaultdict
from backend.app.config import settings

logger = logging.getLogger("cloudgaming.input")

# Mapping from browser Key values to X11 keysyms accepted by xdotool
BROWSER_TO_X11_KEYMAP: Dict[str, str] = {
    # Letters & Numbers
    "a": "a", "b": "b", "c": "c", "d": "d", "e": "e", "f": "f", "g": "g",
    "h": "h", "i": "i", "j": "j", "k": "k", "l": "l", "m": "m", "n": "n",
    "o": "o", "p": "p", "q": "q", "r": "r", "s": "s", "t": "t", "u": "u",
    "v": "v", "w": "w", "x": "x", "y": "y", "z": "z",
    "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6",
    "7": "7", "8": "8", "9": "9",
    
    # Arrows
    "ArrowUp": "Up",
    "ArrowDown": "Down",
    "ArrowLeft": "Left",
    "ArrowRight": "Right",
    "Up": "Up",
    "Down": "Down",
    "Left": "Left",
    "Right": "Right",
    
    # Common Controls
    "Enter": "Return",
    "Return": "Return",
    " ": "space",
    "Space": "space",
    "space": "space",
    "Escape": "Escape",
    "Esc": "Escape",
    "Tab": "Tab",
    "Backspace": "BackSpace",
    "Shift": "Shift_L",
    "ShiftLeft": "Shift_L",
    "ShiftRight": "Shift_R",
    "Control": "Control_L",
    "ControlLeft": "Control_L",
    "ControlRight": "Control_R",
    "Alt": "Alt_L",
    "AltLeft": "Alt_L",
    "AltRight": "Alt_R",
    
    # Function keys
    "F1": "F1", "F2": "F2", "F3": "F3", "F4": "F4", "F5": "F5", "F6": "F6",
    "F7": "F7", "F8": "F8", "F9": "F9", "F10": "F10", "F11": "F11", "F12": "F12"
}

# Mobile Virtual Profiles mapping buttons to key names
PROFILE_MAPPINGS = {
    "wasd": {
        "UP": "w", "DOWN": "s", "LEFT": "a", "RIGHT": "d",
        "A": "space",      # Jump / Primary action
        "B": "Shift_L",    # Run / Dash
        "X": "e",          # Interact / Use
        "Y": "q",          # Secondary
        "L1": "Control_L", # Crouch
        "R1": "r",         # Reload / Extra
        "START": "Return",
        "SELECT": "Tab",
        "PAUSE": "Escape"
    },
    "arrows": {
        "UP": "Up", "DOWN": "Down", "LEFT": "Left", "RIGHT": "Right",
        "A": "z",          # Action 1 (Retro style)
        "B": "x",          # Action 2
        "X": "c",          # Action 3
        "Y": "v",          # Action 4
        "L1": "space",
        "R1": "Shift_L",
        "START": "Return",
        "SELECT": "Escape",
        "PAUSE": "Escape"
    },
    "action": {
        "UP": "Up", "DOWN": "Down", "LEFT": "Left", "RIGHT": "Right",
        "A": "space",
        "B": "Return",
        "X": "z",
        "Y": "x",
        "L1": "a",
        "R1": "s",
        "START": "Return",
        "SELECT": "Tab",
        "PAUSE": "Escape"
    }
}

class InputManager:
    def __init__(self):
        self._active_keys: Dict[str, Set[str]] = defaultdict(set)
        self._session_profiles: Dict[str, str] = {}
        self._custom_mappings: Dict[str, Dict[str, str]] = {}
        self._has_xdotool = (shutil.which("xdotool") is not None)
        if not self._has_xdotool:
            logger.info("xdotool not found on PATH. Will use fallback logging/mock mode if not on Ubuntu X11.")

    def set_session_profile(self, session_id: str, profile: str, custom_mapping: Optional[Dict[str, str]] = None):
        if profile in PROFILE_MAPPINGS or profile == "custom":
            self._session_profiles[session_id] = profile
        if custom_mapping:
            self._custom_mappings[session_id] = custom_mapping

    def get_session_profile_mapping(self, session_id: str) -> Dict[str, str]:
        profile = self._session_profiles.get(session_id, "wasd")
        if profile == "custom" and session_id in self._custom_mappings:
            return self._custom_mappings[session_id]
        return PROFILE_MAPPINGS.get(profile, PROFILE_MAPPINGS["wasd"])

    def get_session_profile(self, session_id: str) -> str:
        return self._session_profiles.get(session_id, "wasd")

    def _execute_xdotool(self, args: List[str]):
        """Executes xdotool against the configured virtual display :99"""
        if not self._has_xdotool or os.name == "nt":
            # Running on local dev (e.g. Windows) or environment without xdotool
            return
        
        env = os.environ.copy()
        env["DISPLAY"] = settings.display
        cmd = ["xdotool"] + args
        try:
            subprocess.run(cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        except Exception as e:
            logger.debug(f"Failed to run xdotool command {cmd}: {e}")

    def handle_keydown(self, session_id: str, key: str):
        """Processes keydown event and tracks active keys to prevent stuck keys"""
        x11_key = BROWSER_TO_X11_KEYMAP.get(key, key)
        if x11_key:
            self._active_keys[session_id].add(x11_key)
            self._execute_xdotool(["keydown", "--clearmodifiers", x11_key])

    def handle_keyup(self, session_id: str, key: str):
        """Processes keyup event and removes key from active set"""
        x11_key = BROWSER_TO_X11_KEYMAP.get(key, key)
        if x11_key:
            self._active_keys[session_id].discard(x11_key)
            self._execute_xdotool(["keyup", x11_key])

    def handle_virtual_button(self, session_id: str, button: str, state: str):
        """
        Handles virtual gamepad buttons (A, B, X, Y, START, etc.)
        state: 'down' or 'up'
        """
        profile = self.get_session_profile(session_id)
        mapping = PROFILE_MAPPINGS.get(profile, PROFILE_MAPPINGS["wasd"])
        mapped_key = mapping.get(button.upper(), mapping.get(button))
        
        if mapped_key:
            if state == "down":
                self.handle_keydown(session_id, mapped_key)
            else:
                self.handle_keyup(session_id, mapped_key)

    def handle_joystick_direction(self, session_id: str, direction: str, previous_direction: Optional[str] = None):
        """
        Handles virtual joystick movement.
        Releases keys associated with previous direction and presses keys for new direction.
        Directions: CENTER, UP, DOWN, LEFT, RIGHT, UP_LEFT, UP_RIGHT, DOWN_LEFT, DOWN_RIGHT
        """
        profile = self.get_session_profile(session_id)
        mapping = PROFILE_MAPPINGS.get(profile, PROFILE_MAPPINGS["wasd"])

        def get_keys_for_dir(d: Optional[str]) -> Set[str]:
            if not d or d == "CENTER":
                return set()
            keys = set()
            if "UP" in d:
                keys.add(mapping.get("UP", "w"))
            if "DOWN" in d:
                keys.add(mapping.get("DOWN", "s"))
            if "LEFT" in d:
                keys.add(mapping.get("LEFT", "a"))
            if "RIGHT" in d:
                keys.add(mapping.get("RIGHT", "d"))
            return keys

        prev_keys = get_keys_for_dir(previous_direction)
        new_keys = get_keys_for_dir(direction)

        # Release keys that are no longer pressed
        to_release = prev_keys - new_keys
        for k in to_release:
            self.handle_keyup(session_id, k)

        # Press newly activated keys
        to_press = new_keys - prev_keys
        for k in to_press:
            self.handle_keydown(session_id, k)

    def handle_mousemove(self, session_id: str, x: float, y: float, screen_width: int = 1280, screen_height: int = 720):
        """Moves cursor to normalized (0..1) or pixel coordinates"""
        # If coordinates are 0..1 normalized
        if 0.0 <= x <= 1.0 and 0.0 <= y <= 1.0:
            target_x = int(x * screen_width)
            target_y = int(y * screen_height)
        else:
            target_x = int(x)
            target_y = int(y)
        self._execute_xdotool(["mousemove", str(target_x), str(target_y)])

    def handle_mouse_click(self, session_id: str, button: str, action: str):
        """
        action: 'down', 'up', 'click'
        button: 'left' (1), 'middle' (2), 'right' (3)
        """
        btn_num = "1"
        if button == "middle":
            btn_num = "2"
        elif button == "right":
            btn_num = "3"

        if action == "down":
            self._execute_xdotool(["mousedown", btn_num])
        elif action == "up":
            self._execute_xdotool(["mouseup", btn_num])
        else:
            self._execute_xdotool(["click", btn_num])

    def handle_mouse_scroll(self, session_id: str, delta_y: float):
        """Wheel scroll: button 4 is wheel up, button 5 is wheel down"""
        btn = "4" if delta_y < 0 else "5"
        self._execute_xdotool(["click", btn])

    def release_all_keys(self, session_id: str):
        """
        CRITICAL: Guarantees no stuck keys when a user disconnects,
        closes tab, or exits the gaming session.
        """
        active = list(self._active_keys.get(session_id, []))
        if active:
            logger.info(f"Releasing {len(active)} stuck keys for session {session_id}: {active}")
            for key in active:
                self._execute_xdotool(["keyup", key])
            self._active_keys[session_id].clear()

input_manager = InputManager()

