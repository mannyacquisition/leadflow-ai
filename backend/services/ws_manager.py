"""
UserConnectionManager — per-user WebSocket pool for real-time mutation events.
Push ACTION_* events to the frontend whenever Monara mutates data.
"""
import json
from typing import Dict, Set
from fastapi import WebSocket


class UserConnectionManager:
    def __init__(self):
        self._conns: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self._conns.setdefault(user_id, set()).add(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self._conns:
            self._conns[user_id].discard(ws)
            if not self._conns[user_id]:
                del self._conns[user_id]

    async def send_to_user(self, user_id: str, event: dict):
        """Push a mutation event to all open tabs for this user."""
        pool = self._conns.get(user_id, set())
        dead: Set[WebSocket] = set()
        for ws in list(pool):
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                dead.add(ws)
        for ws in dead:
            pool.discard(ws)


# Singleton — imported by monara_engine and routes/monara.py
ws_manager = UserConnectionManager()
