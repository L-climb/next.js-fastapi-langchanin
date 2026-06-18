"""
网页内容提取模块
使用 aiohttp 获取页面，trafilatura 提取正文
"""

import asyncio
import logging

import aiohttp
import trafilatura

logger = logging.getLogger(__name__)


async def extract_content(url: str) -> str:
    """
    从 URL 提取网页正文内容

    Args:
        url: 网页 URL

    Returns:
        提取的干净文本，失败返回空字符串
    """
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url,
                timeout=aiohttp.ClientTimeout(total=30),
                headers={"User-Agent": "AI-News-Crawler/1.0"},
            ) as response:
                if response.status != 200:
                    logger.warning(f"获取页面失败 {url}，状态码: {response.status}")
                    return ""

                html = await response.text()

        # 使用 trafilatura 提取正文
        content = trafilatura.extract(html, include_comments=False, include_tables=True)

        if content:
            logger.info(f"成功提取 {url} 的正文，长度: {len(content)}")
            return content
        else:
            logger.warning(f"无法从 {url} 提取正文")
            return ""

    except asyncio.TimeoutError:
        logger.error(f"获取 {url} 超时")
        return ""
    except Exception as e:
        logger.error(f"提取 {url} 内容出错: {e}")
        return ""
