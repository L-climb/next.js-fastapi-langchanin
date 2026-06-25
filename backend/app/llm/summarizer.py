"""
LLM 摘要生成模块
使用 LangChain 调用 LLM 生成新闻摘要
"""

import json
import logging

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate

from app.llm.factory import get_llm_config_from_db, get_chat_model
from app.llm.exceptions import LLMServiceError, wrap_llm_error

logger = logging.getLogger(__name__)


# 定义摘要提示词
SUMMARY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """你是一个专业的 AI 新闻分析师。请对以下新闻文章进行分析，返回严格的 JSON 格式结果。

要求：
1. summary: 100-200字的中文摘要，概括文章核心内容
2. points: 3-5个关键要点，每个要点一句话
3. impact: 对 AI 行业的影响分析，50-100字

请严格按照以下 JSON 格式返回，不要包含其他文字：
{{"summary": "...", "points": ["...", "..."], "impact": "..."}}"""),
    ("human", "标题: {title}\n\n正文内容:\n{content}"),
])


async def summarize_article(title: str, content: str) -> dict:
    """
    使用 LLM 生成文章摘要

    Args:
        title: 文章标题
        content: 文章正文内容

    Returns:
        {"summary": str, "points": list, "impact": str}
    """
    try:
        # 动态获取配置和模型
        config = await get_llm_config_from_db()
        llm = get_chat_model(config)
        
        parser = JsonOutputParser()

        # 截断过长的内容，避免超出 token 限制
        max_content_length = 8000
        if len(content) > max_content_length:
            content = content[:max_content_length] + "..."

        # 构建链
        chain = SUMMARY_PROMPT | llm | parser

        # 调用 LLM
        result = await chain.ainvoke({"title": title, "content": content})

        # 确保返回格式正确
        summary = result.get("summary", "")
        points = result.get("points", [])
        impact = result.get("impact", "")

        if not isinstance(points, list):
            points = [str(points)]

        logger.info(f"成功生成摘要: {title[:30]}...")
        return {
            "summary": str(summary),
            "points": points,
            "impact": str(impact),
        }

    except LLMServiceError:
        raise
    except Exception as e:
        logger.error(f"生成摘要失败 [{title[:30]}...]: {e}")
        raise wrap_llm_error(e, model_type="chat") from e


async def answer_question(question: str, context_docs: list[str]) -> str:
    """
    RAG 问答：基于检索到的文档回答问题

    Args:
        question: 用户问题
        context_docs: 检索到的相关文档内容列表

    Returns:
        LLM 生成的回答
    """
    try:
        # 动态获取配置和模型
        config = await get_llm_config_from_db()
        llm = get_chat_model(config)

        context = "\n\n---\n\n".join(context_docs) if context_docs else "暂无相关资料"

        prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一个 AI 新闻知识助手。根据以下参考资料回答用户的问题。
如果参考资料中没有相关信息，请如实说明。请用中文回答。

参考资料：
{context}"""),
            ("human", "{question}"),
        ])

        chain = prompt | llm
        result = await chain.ainvoke({"context": context, "question": question})

        return result.content

    except LLMServiceError:
        raise
    except Exception as e:
        logger.error(f"RAG 问答失败: {e}")
        raise wrap_llm_error(e, model_type="chat") from e


# ==================== 主题过滤 ====================

TOPIC_FILTER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """你是一个文章主题分类专家。请判断以下每篇文章的标题是否与用户指定的主题相关。

规则：
1. 只根据标题判断相关性，不要编造内容
2. 主题相关包括：直接提到主题关键词、属于该主题的子领域、与主题有密切关联
3. 返回严格的 JSON 格式，不要包含其他文字

请严格按照以下 JSON 格式返回：
{{"results": [{{"index": 0, "relevant": true}}, {{"index": 1, "relevant": false}}]}}"""),
    ("human", "目标主题：{topic}\n\n以下是文章标题列表：\n{titles}\n\n请逐一判断每篇文章是否与「{topic}」主题相关，返回 JSON 结果。"),
])


async def filter_articles_by_topic(articles: list[dict], topic: str) -> list[dict]:
    """
    使用 LLM 批量判断文章是否与指定主题相关

    Args:
        articles: 文章列表 [{title, url, source_name, ...}]
        topic: 目标主题（如 "AI"、"篮球"）

    Returns:
        过滤后的相关文章列表
    """
    if not topic or not topic.strip():
        return articles

    if not articles:
        return []

    topic = topic.strip()
    logger.info(f"正在按主题「{topic}」过滤 {len(articles)} 篇文章...")

    try:
        config = await get_llm_config_from_db()
        llm = get_chat_model(config)
        parser = JsonOutputParser()

        # 分批处理，每批最多 50 篇，避免 token 超限
        batch_size = 50
        relevant_articles = []

        for batch_start in range(0, len(articles), batch_size):
            batch = articles[batch_start:batch_start + batch_size]
            titles_text = "\n".join(
                f"{i}. {a['title']}" for i, a in enumerate(batch)
            )

            chain = TOPIC_FILTER_PROMPT | llm | parser
            result = await chain.ainvoke({"topic": topic, "titles": titles_text})

            results_list = result.get("results", [])
            for item in results_list:
                idx = item.get("index", -1)
                if item.get("relevant", False) and 0 <= idx < len(batch):
                    relevant_articles.append(batch[idx])

        logger.info(
            f"主题过滤完成：{len(relevant_articles)}/{len(articles)} 篇与「{topic}」相关"
        )
        return relevant_articles

    except LLMServiceError:
        raise
    except Exception as e:
        # LLM 过滤失败时降级为关键词匹配
        logger.warning(f"LLM 主题过滤失败，降级为关键词匹配: {e}")
        return _keyword_filter(articles, topic)


def _keyword_filter(articles: list[dict], topic: str) -> list[dict]:
    """
    关键词匹配降级方案：标题中包含主题关键词即视为相关
    """
    topic_lower = topic.lower()
    # 拆分多个关键词（支持中英文逗号、空格分隔）
    import re
    keywords = [kw.strip().lower() for kw in re.split(r"[,，\s]+", topic_lower) if kw.strip()]
    if not keywords:
        return articles

    filtered = []
    for article in articles:
        title_lower = article["title"].lower()
        if any(kw in title_lower for kw in keywords):
            filtered.append(article)

    logger.info(f"关键词过滤结果：{len(filtered)}/{len(articles)} 篇匹配")
    return filtered
