"""
定时任务调度模块
使用 APScheduler 管理定时爬取等任务
"""

import asyncio
import json
import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from app.config import settings
from app.crawler.rss_crawler import crawl_all_sources, crawl_selected_sources
from app.crawler.web_scraper import extract_content
from app.database import async_session
from app.knowledge.vectorstore import add_to_knowledge_base
from app.llm.exceptions import LLMServiceError
from app.llm.summarizer import summarize_article, filter_articles_by_topic
from app.models.article import Article
from app.models.crawl_source import CrawlSource
from app.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def process_single_article(article_data: dict, db_session) -> bool:
    """
    处理单篇文章：提取内容、生成摘要、存入知识库

    Args:
        article_data: 文章基础数据 {title, url, source_name, published}
        db_session: 数据库会话

    Returns:
        是否处理成功
    """
    title = article_data["title"]
    url = article_data["url"]
    source_name = article_data["source_name"]

    try:
        # 1. 提取正文内容
        content = await extract_content(url)
        if not content:
            logger.warning(f"无法提取正文: {title[:30]}...")
            # 存入数据库但标记为 failed
            article = Article(
                title=title,
                url=url,
                source=source_name,
                content="",
                status="failed",
                crawled_at=datetime.utcnow(),
            )
            db_session.add(article)
            return False

        # 2. 存入数据库
        article = Article(
            title=title,
            url=url,
            source=source_name,
            content=content,
            status="crawled",
            crawled_at=datetime.utcnow(),
        )
        db_session.add(article)
        await db_session.flush()  # 获取 article.id

        # 3. 调用 LLM 生成摘要
        result = await summarize_article(title, content)

        if result["summary"]:
            article.summary = result["summary"]
            article.summary_points = json.dumps(result["points"], ensure_ascii=False)
            article.impact = result["impact"]
            article.summarized_at = datetime.utcnow()
            article.status = "summarized"

            # 4. 存入知识库（单独捕获异常，确保摘要数据不会因知识库失败而丢失）
            try:
                await add_to_knowledge_base(
                    article_id=article.id,
                    title=title,
                    summary=result["summary"],
                    points=result["points"],
                    impact=result["impact"],
                )
                article.is_in_knowledge_base = True
            except Exception as kb_error:
                logger.warning(f"知识库存储失败 [{title[:30]}...]: {kb_error}，摘要已保存")
        else:
            article.status = "failed"

        return True

    except LLMServiceError as e:
        logger.error(f"LLM 调用失败 [{title[:30]}...]: {e.message}")
        await ws_manager.send_error(e.message)
        return False
    except Exception as e:
        logger.error(f"处理文章失败 [{title[:30]}...]: {e}")
        return False


async def scheduled_crawl(
    source_ids: list[int] | None = None,
    max_count: int | None = None,
    topic: str | None = None,
):
    """定时爬取任务（支持 WebSocket 进度推送和主题过滤）"""
    logger.info("=" * 50)
    logger.info("开始爬取任务...")

    total_new = 0
    total_summarized = 0

    try:
        # 1. 确定要爬取的源
        async with async_session() as db:
            if source_ids:
                result = await db.execute(
                    select(CrawlSource).where(CrawlSource.id.in_(source_ids))
                )
            else:
                result = await db.execute(select(CrawlSource))
            sources = result.scalars().all()

        if not sources:
            logger.info("没有可用的爬取源")
            await ws_manager.send_complete(0, 0)
            return

        source_dicts = [s.to_dict() for s in sources]

        # 2. 爬取指定源
        articles = await crawl_selected_sources(source_dicts)
        if not articles:
            logger.info("没有获取到新文章")
            await ws_manager.send_complete(0, 0)
            return

        # 3. 过滤已存在的文章
        async with async_session() as db:
            result = await db.execute(select(Article.url))
            existing_urls = {row[0] for row in result.fetchall()}

            new_articles = [a for a in articles if a["url"] not in existing_urls]

            # 按主题过滤
            if topic and topic.strip():
                await ws_manager.send_progress(
                    current=f"正在按主题「{topic}」筛选文章...",
                    processed=0,
                    total=len(new_articles),
                )
                new_articles = await filter_articles_by_topic(new_articles, topic.strip())
                logger.info(f"主题「{topic}」过滤后剩余 {len(new_articles)} 篇")

            if not new_articles:
                logger.info("过滤后没有新文章")
                await ws_manager.send_complete(0, 0)
                return

            # 按源限制爬取数量
            if max_count:
                count_per_source: dict[str, int] = {}
                filtered = []
                for a in new_articles:
                    src = a.get("source_name", "")
                    count_per_source[src] = count_per_source.get(src, 0) + 1
                    if count_per_source[src] <= max_count:
                        filtered.append(a)
                new_articles = filtered

            total = len(new_articles)
            logger.info(f"新增 {total} 篇文章（过滤 {len(articles) - total} 篇已存在/不相关）")

            # 4. 逐篇处理（提取正文、摘要、存入知识库）
            processed = 0
            for article_data in new_articles:
                # 推送进度
                await ws_manager.send_progress(
                    current=article_data["title"],
                    processed=processed,
                    total=total,
                )

                success = await process_single_article(article_data, db)
                processed += 1

                if success:
                    total_new += 1
                    # 查看是否摘要成功
                    result_check = await db.execute(
                        select(Article).where(Article.url == article_data["url"])
                    )
                    art = result_check.scalar_one_or_none()
                    if art and art.status == "summarized":
                        total_summarized += 1
                        await ws_manager.send_summary(art.id, art.title, "summarized")
                    elif art:
                        await ws_manager.send_summary(art.id, art.title, art.status)

                # 每篇文章处理完后立即提交，避免中断时丢失所有数据
                await db.commit()

            logger.info(f"爬取任务完成，成功处理 {total_new}/{total} 篇文章")

    except Exception as e:
        logger.error(f"爬取任务异常: {e}")
        await ws_manager.send_error(str(e))

    # 推送完成消息
    await ws_manager.send_complete(total_new, total_summarized)
    logger.info("=" * 50)


def start_scheduler():
    """
    启动定时调度器（不自动添加爬取任务，用户需手动添加）
    """
    scheduler.start()
    logger.info("定时调度器已启动（未添加默认任务，可通过面板手动添加）")


def get_jobs() -> list[dict]:
    """
    获取当前所有任务列表

    Returns:
        任务信息列表
    """
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "trigger": str(job.trigger),
            "next_run_time": str(job.next_run_time) if job.next_run_time else None,
        })
    return jobs


def add_job(job_id: str, trigger: str, **kwargs):
    """
    添加自定义定时任务

    Args:
        job_id: 任务 ID
        trigger: 触器类型（interval/cron）
        **kwargs: 触发器参数和任务参数
    """
    job_name = kwargs.pop("name", job_id)
    func_path = kwargs.pop("func", "app.scheduler.tasks:scheduled_crawl")

    # 目前只支持 scheduled_crawl 任务
    scheduler.add_job(
        scheduled_crawl,
        trigger=trigger,
        id=job_id,
        name=job_name,
        replace_existing=True,
        max_instances=1,
        **kwargs,
    )
    logger.info(f"已添加任务: {job_id}")


def remove_job(job_id: str):
    """
    删除指定任务

    Args:
        job_id: 任务 ID
    """
    try:
        scheduler.remove_job(job_id)
        logger.info(f"已删除任务: {job_id}")
    except Exception as e:
        logger.error(f"删除任务 {job_id} 失败: {e}")
        raise
