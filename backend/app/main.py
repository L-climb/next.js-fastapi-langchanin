"""
FastAPI 应用入口
AI 新闻自动爬取平台后端
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.llm.exceptions import LLMServiceError
from app.routers import articles, knowledge, scheduler, config
from app.scheduler.tasks import start_scheduler
from app.websocket_manager import ws_manager

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info("正在启动 AI 新闻爬取平台...")

    # 初始化数据库
    await init_db()
    logger.info("数据库初始化完成")

    # 启动定时调度器
    start_scheduler()
    logger.info("定时调度器已启动")

    yield

    # 关闭时
    logger.info("正在关闭应用...")
    from app.scheduler.tasks import scheduler
    scheduler.shutdown(wait=False)
    logger.info("定时调度器已关闭")


# 创建 FastAPI 应用
app = FastAPI(
    title="AI 新闻自动爬取平台",
    description="基于 FastAPI + LangChain + ChromaDB 的 AI 新闻自动爬取、摘要和知识库系统",
    version="1.0.0",
    lifespan=lifespan,
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载路由
app.include_router(articles.router)
app.include_router(knowledge.router)
app.include_router(scheduler.router)
app.include_router(config.router)


@app.exception_handler(LLMServiceError)
async def llm_service_error_handler(request, exc: LLMServiceError):
    """大模型 / Embedding 调用失败时返回统一提示"""
    return JSONResponse(
        status_code=503,
        content={
            "detail": exc.message,
            "error_code": exc.error_code,
            "model_type": exc.model_type,
        },
    )


@app.get("/")
async def root():
    """根路由 - API 信息"""
    return {
        "name": "AI 新闻自动爬取平台 API",
        "version": "1.0.0",
        "description": "自动爬取 AI 领域新闻，生成摘要，构建知识库",
        "docs": "/docs",
        "endpoints": {
            "articles": "/api/articles",
            "knowledge": "/api/knowledge",
            "scheduler": "/api/scheduler",
        },
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok"}


@app.websocket("/ws/crawl-progress")
async def websocket_crawl_progress(websocket: WebSocket):
    """WebSocket 端点 - 实时推送爬取进度"""
    await ws_manager.connect(websocket)
    try:
        while True:
            # 保持连接，接收客户端消息（心跳等）
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
