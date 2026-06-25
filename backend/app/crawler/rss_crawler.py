"""
RSS 爬虫模块
使用 aiohttp 异步请求，feedparser 解析 RSS
"""

import asyncio
import logging
from datetime import datetime

import aiohttp
import feedparser

from app.crawler.sources import NEWS_SOURCES

logger = logging.getLogger(__name__)


async def crawl_source(source: dict) -> list[dict]:
    """
    爬取单个 RSS 源

    Args:
        source: 新闻源配置字典，包含 name, rss, category

    Returns:
        解析后的文章列表 [{title, url, source_name, published}]
    """
    articles = []
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                source["rss"],
                timeout=aiohttp.ClientTimeout(total=60),
                headers={"User-Agent": "AI-News-Crawler/1.0"},
            ) as response:
                if response.status != 200:
                    logger.warning(
                        f"请求 {source['name']} 失败，状态码: {response.status}"
                    )
                    return []

                content = await response.text()

        # 使用 feedparser 解析 RSS 内容
        feed = feedparser.parse(content)

        for entry in feed.entries:
            article = {
                "title": entry.get("title", "").strip(),
                "url": entry.get("link", "").strip(),
                "source_name": source["name"],
                "published": None,
            }

            # 解析发布时间
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                try:
                    article["published"] = datetime(*entry.published_parsed[:6])
                except (TypeError, ValueError):
                    article["published"] = None

            # 只保留有标题和链接的文章
            if article["title"] and article["url"]:
                articles.append(article)

        logger.info(f"从 {source['name']} 获取到 {len(articles)} 篇文章")

    except asyncio.TimeoutError:
        logger.error(f"爬取 {source['name']} 超时")
    except Exception as e:
        logger.error(f"爬取 {source['name']} 出错: {e}")

    return articles


async def crawl_all_sources() -> list[dict]:
    """
    并发爬取所有新闻源

    Returns:
        所有源的文章汇总列表
    """
    return await crawl_selected_sources(NEWS_SOURCES)


async def crawl_selected_sources(sources: list[dict]) -> list[dict]:
    """
    并发爬取指定的新闻源列表

    Args:
        sources: 源列表，每个源包含 {name, rss, category} 或 {name, rss, source_name}

    Returns:
        所有源的文章汇总列表
    """
    logger.info(f"开始爬取 {len(sources)} 个新闻源...")

    # 使用 asyncio.gather 并发爬取所有源
    tasks = [crawl_source(source) for source in sources]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_articles = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"爬取 {sources[i]['name']} 异常: {result}")
        elif isinstance(result, list):
            all_articles.extend(result)

    logger.info(f"总共获取到 {len(all_articles)} 篇文章")
    return all_articles
