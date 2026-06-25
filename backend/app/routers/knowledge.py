"""
知识库路由
提供语义搜索、RAG 问答、文档列表和详情接口
"""

import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.knowledge.vectorstore import (
    get_knowledge_stats,
    search_knowledge_base,
    list_knowledge_documents,
    get_knowledge_document,
)
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


class DocumentChunk(BaseModel):
    """文档切块"""
    chunk_type: str
    content: str


class DocumentListItem(BaseModel):
    """文档列表项"""
    article_id: int | None = None
    title: str
    doc_id: str


class DocumentListResponse(BaseModel):
    """文档列表响应"""
    items: list[DocumentListItem]
    total: int
    page: int
    size: int
    pages: int


class DocumentDetailResponse(BaseModel):
    """文档详情响应"""
    article_id: int | None = None
    title: str
    doc_id: str
    document: str
    chunks: list[DocumentChunk]


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


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
):
    """分页列出知识库中的所有文档"""
    try:
        result = await list_knowledge_documents(page=page, size=size)
        return DocumentListResponse(**result)
    except LLMServiceError:
        raise
    except Exception as e:
        logger.error(f"获取知识库文档列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取文档列表失败: {str(e)}")


@router.get("/documents/{article_id}", response_model=DocumentDetailResponse)
async def get_document(article_id: int):
    """获取知识库中指定文章的详细信息（含切块）"""
    try:
        result = await get_knowledge_document(article_id=article_id)
        if result is None:
            raise HTTPException(status_code=404, detail="文档不存在")
        return DocumentDetailResponse(**result)
    except HTTPException:
        raise
    except LLMServiceError:
        raise
    except Exception as e:
        logger.error(f"获取知识库文档详情失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取文档详情失败: {str(e)}")
