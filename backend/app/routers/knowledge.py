"""
知识库路由
提供语义搜索和 RAG 问答接口
"""

import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.knowledge.vectorstore import get_knowledge_stats, search_knowledge_base
from app.llm.exceptions import LLMServiceError
from app.llm.summarizer import answer_question

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


# ==================== 请求/响应模型 ====================


class SearchResult(BaseModel):
    """搜索结果项"""
    id: str
    document: str
    metadata: dict = {}
    distance: float = 0


class SearchResponse(BaseModel):
    """搜索响应"""
    query: str
    results: list[SearchResult]


class QueryRequest(BaseModel):
    """RAG 问答请求"""
    question: str


class QueryResponse(BaseModel):
    """RAG 问答响应"""
    question: str
    answer: str
    sources: list[SearchResult]


class KnowledgeStatsResponse(BaseModel):
    """知识库统计响应"""
    total_documents: int
    collection_name: str


# ==================== 路由处理 ====================


@router.get("/search", response_model=SearchResponse)
async def search_knowledge(
    q: str = Query(..., description="搜索查询"),
    limit: int = Query(5, ge=1, le=20, description="返回结果数量"),
):
    """语义搜索知识库"""
    try:
        results = await search_knowledge_base(query=q, n_results=limit)
        return SearchResponse(
            query=q,
            results=[SearchResult(**r) for r in results],
        )
    except LLMServiceError:
        raise
    except Exception as e:
        logger.error(f"知识库搜索失败: {e}")
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")


@router.post("/query", response_model=QueryResponse)
async def query_knowledge(request: QueryRequest):
    """RAG 问答：基于知识库回答问题"""
    try:
        # 1. 从知识库搜索相关内容
        search_results = await search_knowledge_base(query=request.question, n_results=5)

        if not search_results:
            return QueryResponse(
                question=request.question,
                answer="知识库中暂无相关内容，请先爬取一些新闻文章。",
                sources=[],
            )

        # 2. 提取文档内容作为上下文
        context_docs = [r["document"] for r in search_results]

        # 3. 调用 LLM 生成回答
        answer = await answer_question(
            question=request.question,
            context_docs=context_docs,
        )

        return QueryResponse(
            question=request.question,
            answer=answer,
            sources=[SearchResult(**r) for r in search_results],
        )

    except LLMServiceError:
        raise
    except Exception as e:
        logger.error(f"RAG 问答失败: {e}")
        raise HTTPException(status_code=500, detail=f"问答失败: {str(e)}")


@router.get("/stats", response_model=KnowledgeStatsResponse)
async def knowledge_stats():
    """获取知识库统计信息"""
    stats = await get_knowledge_stats()
    return KnowledgeStatsResponse(**stats)
