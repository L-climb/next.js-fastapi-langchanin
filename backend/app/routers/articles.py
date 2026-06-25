"""
新闻文章路由
提供文章的增删改查和手动爬取接口
"""

import asyncio
import json
import logging
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.knowledge.vectorstore import add_to_knowledge_base
from app.llm.exceptions import LLMServiceError
from app.llm.summarizer import summarize_article
from app.models.article import Article
from app.scheduler.tasks import scheduled_crawl

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/articles", tags=["articles"])


# ==================== 响应模型 ====================


class ArticleResponse(BaseModel):
    """文章响应模型"""

    id: int
    title: str
    url: str
    source: str
    content: str | None = None
    summary: str | None = None
    summary_points: str | None = None
    impact: str | None = None
    crawled_at: datetime | None = None
    summarized_at: datetime | None = None
    status: str
    is_in_knowledge_base: bool = False

    class Config:
        from_attributes = True


class ArticleListResponse(BaseModel):
    """文章列表响应"""

    total: int
    page: int
    size: int
    pages: int
    items: list[ArticleResponse]


class ArticleStatsResponse(BaseModel):
    """文章统计响应"""

    total: int
    summarized: int
    crawled: int
    failed: int


# ==================== 路由处理 ====================


@router.post("/{article_id}/knowledge")
async def add_article_to_knowledge_base_endpoint(
    article_id: int, db: AsyncSession = Depends(get_db)
):
    """将指定文章添加到知识库"""
    # 1. 获取文章
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")

    if not article.summary:
        # 尝试自动生成摘要
        if not article.content:
            raise HTTPException(status_code=400, detail="文章摘要和正文均为空，无法添加到知识库")

        try:
            summary_result = await summarize_article(article.title, article.content)
        except LLMServiceError:
            raise
        except Exception as e:
            logger.error(f"自动生成摘要失败: {e}")
            raise HTTPException(status_code=500, detail=f"自动生成摘要失败: {str(e)}")

        if not summary_result.get("summary"):
            raise HTTPException(status_code=400, detail="文章摘要为空，无法添加到知识库")

        article.summary = summary_result["summary"]
        article.summary_points = json.dumps(summary_result["points"], ensure_ascii=False)
        article.impact = summary_result["impact"]
        article.summarized_at = datetime.utcnow()
        article.status = "summarized"

        # 先提交摘要数据，确保即使后续知识库写入失败，摘要也不会丢失
        db.add(article)
        await db.commit()

    # 2. 添加到知识库
    try:
        await add_to_knowledge_base(
            article_id=article.id,
            title=article.title,
            summary=article.summary,
            points=json.loads(article.summary_points) if article.summary_points else [],
            impact=article.impact or "",
        )
    except LLMServiceError:
        raise
    except Exception as e:
        logger.error(f"添加文章到知识库失败: {e}")
        raise HTTPException(status_code=500, detail=f"添加文章到知识库失败: {str(e)}")

    # 3. 更新文章状态
    article.is_in_knowledge_base = True
    db.add(article)
    await db.commit()

    return {"message": "文章已成功添加到知识库"}


@router.get("/stats", response_model=ArticleStatsResponse)
async def get_article_stats(db: AsyncSession = Depends(get_db)):
    """获取文章统计信息"""
    # 总数
    total_result = await db.execute(select(func.count(Article.id)))
    total = total_result.scalar() or 0

    # 已摘要
    summarized_result = await db.execute(
        select(func.count(Article.id)).where(Article.status == "summarized")
    )
    summarized = summarized_result.scalar() or 0

    # 已爬取待处理
    crawled_result = await db.execute(
        select(func.count(Article.id)).where(Article.status == "crawled")
    )
    crawled = crawled_result.scalar() or 0

    # 失败
    failed_result = await db.execute(
        select(func.count(Article.id)).where(Article.status == "failed")
    )
    failed = failed_result.scalar() or 0

    return ArticleStatsResponse(
        total=total,
        summarized=summarized,
        crawled=crawled,
        failed=failed,
    )


@router.delete("/{article_id}")
async def delete_article(article_id: int, db: AsyncSession = Depends(get_db)):
    """删除指定文章（仅从数据库删除，不影响知识库）"""
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")

    # 从数据库删除（知识库内容保持不变）
    await db.delete(article)
    await db.commit()

    return {"message": f"文章「{article.title}」已删除"}


@router.delete("")
async def delete_all_articles(db: AsyncSession = Depends(get_db)):
    """清空所有文章（仅从数据库删除，不影响知识库）"""
    # 先统计数量
    count_result = await db.execute(select(func.count(Article.id)))
    total = count_result.scalar() or 0

    if total == 0:
        return {"message": "数据库中没有文章", "deleted": 0}

    # 删除所有文章（知识库内容保持不变）
    await db.execute(sql_delete(Article))
    await db.commit()

    logger.info(f"已清空所有文章（共 {total} 篇）")
    return {"message": f"已清空所有文章（共 {total} 篇）", "deleted": total}


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(article_id: int, db: AsyncSession = Depends(get_db)):
    """获取文章详情"""
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")

    return article


@router.get("", response_model=ArticleListResponse)
async def list_articles(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: str = Query("", description="搜索关键词"),
    status: str = Query("", description="状态筛选"),
    db: AsyncSession = Depends(get_db),
):
    """分页获取文章列表"""
    # 构建查询
    query = select(Article)

    # 搜索过滤
    if search:
        query = query.where(
            Article.title.contains(search) | Article.content.contains(search)
        )

    # 状态过滤
    if status:
        query = query.where(Article.status == status)

    # 获取总数
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # 分页
    query = query.order_by(Article.crawled_at.desc())
    query = query.offset((page - 1) * size).limit(size)

    result = await db.execute(query)
    articles = result.scalars().all()

    import math
    return ArticleListResponse(
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if size > 0 else 0,
        items=articles,
    )


class CrawlRequest(BaseModel):
    """爬取请求参数"""
    source_ids: list[int] | None = None
    max_count: int | None = None
    topic: str | None = None


@router.post("/crawl")
async def trigger_crawl(
    background_tasks: BackgroundTasks,
    body: CrawlRequest | None = None,
):
    """手动触发爬取任务（后台运行，通过 WebSocket 推送进度）"""
    try:
        source_ids = body.source_ids if body else None
        max_count = body.max_count if body else None
        topic = body.topic if body else None
        background_tasks.add_task(
            scheduled_crawl,
            source_ids=source_ids,
            max_count=max_count,
            topic=topic,
        )
        topic_desc = f"，主题筛选：{topic}" if topic else ""
        return {"message": f"爬取任务已启动{topic_desc}，WebSocket 连接 ws://localhost:8000/ws/crawl-progress 获取实时进度"}
    except Exception as e:
        logger.error(f"启动爬取任务失败: {e}")
        raise HTTPException(status_code=500, detail=f"启动爬取任务失败: {str(e)}")
