import asyncio
import logging
from typing import Set
from fastapi import WebSocket

logger = logging.getLogger("cloudgaming.downloads.ws")

class DownloadBroadcaster:
    def __init__(self):
        self._active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self._active_connections.add(websocket)
        logger.debug(f"Admin WebSocket client connected (Total: {len(self._active_connections)})")

    def disconnect(self, websocket: WebSocket):
        self._active_connections.discard(websocket)
        logger.debug(f"Admin WebSocket client disconnected (Total: {len(self._active_connections)})")

    async def broadcast(self, data: dict):
        if not self._active_connections:
            return
        dead = []
        for ws in self._active_connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._active_connections.discard(ws)

download_broadcaster = DownloadBroadcaster()
