from typing import Optional, Literal
from pydantic import BaseModel

InputType = Literal[
    "keydown",
    "keyup",
    "keypress",
    "mousemove",
    "mousedown",
    "mouseup",
    "mousescroll",
    "joystick",
    "dpad",
    "gamepad_button",
    "reset_keys",
    "ping",
    "pong"
]

class InputPayload(BaseModel):
    type: InputType
    key: Optional[str] = None
    button: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    delta_x: Optional[float] = None
    delta_y: Optional[float] = None
    intensity: Optional[float] = None
    direction: Optional[str] = None
    client_time: Optional[float] = None

