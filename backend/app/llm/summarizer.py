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
