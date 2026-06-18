"""
WebSocket 连接管理器
管理所有 WebSocket 客户端连接，用于实时推送爬取进度
"""

import asyncio
import json
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket 连接管理器"""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """接受新的 WebSocket 连接"""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket 已连接，当前连接数: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """断开 WebSocket 连接"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket 已断开，当前连接数: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """向所有连接的客户端广播消息"""
        if not self.active_connections:
            return
        data = json.dumps(message, ensure_ascii=False)
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(data)
            except Exception:
                disconnected.append(connection)
        # 清理断开的连接
        for conn in disconnected:
            if conn in self.active_connections:
                self.active_connections.remove(conn)

    async def send_progress(self, current: str, processed: int, total: int, status: str = "crawling"):
        """发送爬取进度消息"""
        await self.broadcast({
            "type": "progress",
            "data": {
                "current": current,
                "processed": processed,
                "total": total,
                "status": status,
            }
        })

    async def send_summary(self, article_id: int, title: str, status: str):
        """发送文章摘要完成消息"""
        await self.broadcast({
            "type": "summary",
            "data": {
                "article_id": article_id,
                "title": title,
                "status": status,
            }
        })

    async def send_complete(self, total_new: int, total_summarized: int):
        """发送爬取完成消息"""
        await self.broadcast({
            "type": "complete",
            "data": {
                "total_new": total_new,
                "total_summarized": total_summarized,
            }
        })

    async def send_error(self, message: str):
        """发送错误消息"""
        await self.broadcast({
            "type": "error",
            "data": {"message": message}
        })


# 全局连接管理器实例
ws_manager = ConnectionManager()
