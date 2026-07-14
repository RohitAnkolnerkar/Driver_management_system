import asyncio
from typing import List

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.jwt import decode_access_token
from app.db import get_db
from app.models.user import User

router = APIRouter(prefix="/ws", tags=["WebSockets"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for connection in dead_connections:
            self.disconnect(connection)


manager = ConnectionManager()


def broadcast_update(message: dict):
    """
    Thread-safe helper to submit a broadcast task to the running asyncio loop,
    or run it in a new loop if none is running.
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast(message))
    except RuntimeError:
        asyncio.run(manager.broadcast(message))


@router.websocket("/dispatch")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    db_gen = get_db()
    db = next(db_gen)
    try:
        # Verify the token
        try:
            payload = decode_access_token(token)
            username: str = payload.get("sub")
            if username is None:
                await websocket.close(code=4003)  # Forbidden
                return

            user = db.query(User).filter(User.username == username).first()
            if (
                user is None
                or not user.is_active
                or user.role not in {"admin", "dispatcher"}
            ):
                await websocket.close(code=4003)  # Forbidden
                return

        except Exception:
            await websocket.close(code=4003)
            return

        # Accept connection
        await manager.connect(websocket)
        try:
            while True:
                # Keep connection open and discard client messages
                await websocket.receive_text()
        except WebSocketDisconnect:
            manager.disconnect(websocket)
        except Exception:
            manager.disconnect(websocket)
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass
