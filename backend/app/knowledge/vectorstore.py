"""
知识库模块
使用 FAISS 向量数据库存储和检索文章知识（替代 ChromaDB）
"""

import asyncio
import json
import logging
import math
import os
import traceback

from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS

from app.config import settings
from app.llm.factory import get_embedding_model, get_llm_config_from_db
from app.llm.exceptions import LLMServiceError

logger = logging.getLogger(__name__)

# FAISS 数据存储路径（从配置读取）
FAISS_DATA_PATH = settings.FAISS_PATH


async def _get_embedding_function():
    """从数据库获取 LLM 配置并创建 Embedding 模型"""
    llm_config = await get_llm_config_from_db()
    return get_embedding_model(llm_config)


async def _load_or_create_store():
    """加载已有 FAISS 索引或创建新的空索引

    Returns:
        FAISS 向量库实例（至少包含空索引）
    """
    embedding_function = await _get_embedding_function()

    index_path = os.path.join(FAISS_DATA_PATH, "index.faiss")
    if os.path.exists(index_path):
        try:
            store = FAISS.load_local(
                FAISS_DATA_PATH,
                embedding_function,
                allow_dangerous_deserialization=True,
            )
            logger.info(f"已加载 FAISS 索引（文档数: {store.index.ntotal}）")
            return store
        except Exception as e:
            logger.warning(f"加载 FAISS 索引失败，将创建新索引: {e}")

    # 创建空索引（使用一条虚拟文档初始化，然后删除）
    store = FAISS.from_texts(
        ["__init_placeholder__"],
        embedding_function,
        metadatas=[{"article_id": -1, "title": "__init__"}],
        ids=["__init__"],
    )
    store.delete(["__init__"])
    # 立即保存空索引到磁盘
    os.makedirs(FAISS_DATA_PATH, exist_ok=True)
    store.save_local(FAISS_DATA_PATH)
    logger.info("已创建新的 FAISS 索引")
    return store


async def add_to_knowledge_base(
    article_id: int,
    title: str,
    summary: str,
    points: list,
    impact: str,
):
    """
    将文章摘要信息存入知识库

    Raises:
        LLMServiceError: 当 Embedding 或 FAISS 操作失败时
    """
    try:
        store = await _load_or_create_store()

        points_text = "、".join(points) if isinstance(points, list) else str(points)
        document_text = f"{title}\n{summary}\n要点：{points_text}\n影响：{impact}"

        doc_id = f"article_{article_id}"
        metadata = {
            "article_id": article_id,
            "title": title,
        }

        # Upsert：先删除旧版本（如果存在），再添加新版本
        try:
            store.delete([doc_id])
            logger.debug(f"已删除旧版本文档: {doc_id}")
        except Exception:
            # 文档不存在时 delete 会报错，忽略即可
            pass

        # 在线程池中执行同步的 add_texts 操作
        logger.info(f"正在为文章 {article_id} 生成 Embedding 并写入 FAISS...")
        await asyncio.to_thread(
            store.add_texts,
            [document_text],
            metadatas=[metadata],
            ids=[doc_id],
        )

        # 保存到磁盘
        await asyncio.to_thread(store.save_local, FAISS_DATA_PATH)

        logger.info(f"文章 {article_id} 已存入知识库（当前共 {store.index.ntotal} 篇）")

    except LLMServiceError:
        raise
    except Exception as e:
        error_detail = traceback.format_exc()
        logger.error(f"存入知识库失败 [文章 {article_id}]: {e}\n{error_detail}")
        raise LLMServiceError(
            message=f"知识库写入失败: {str(e)}",
            model_type="embedding",
            error_code="KB_WRITE_FAILED",
        ) from e


async def delete_from_knowledge_base(article_id: int):
    """
    从知识库中删除指定文章的向量文档

    Args:
        article_id: 文章 ID
    """
    try:
        index_path = os.path.join(FAISS_DATA_PATH, "index.faiss")
        if not os.path.exists(index_path):
            return

        embedding_function = await _get_embedding_function()
        store = await asyncio.to_thread(
            lambda: FAISS.load_local(
                FAISS_DATA_PATH,
                embedding_function,
                allow_dangerous_deserialization=True,
            )
        )

        doc_id = f"article_{article_id}"
        try:
            store.delete([doc_id])
            await asyncio.to_thread(store.save_local, FAISS_DATA_PATH)
            logger.info(f"已从知识库删除文章 {article_id}")
        except Exception:
            # 文档不存在时 delete 会报错，忽略即可
            logger.debug(f"文章 {article_id} 不在知识库中，跳过删除")

    except Exception as e:
        logger.error(f"从知识库删除文章 {article_id} 失败: {e}")


async def clear_knowledge_base():
    """
    清空知识库中的所有文档
    """
    try:
        index_path = os.path.join(FAISS_DATA_PATH, "index.faiss")
        if not os.path.exists(index_path):
            return

        embedding_function = await _get_embedding_function()
        store = await asyncio.to_thread(
            lambda: FAISS.load_local(
                FAISS_DATA_PATH,
                embedding_function,
                allow_dangerous_deserialization=True,
            )
        )

        total = store.index.ntotal
        if total == 0:
            return

        # 收集所有 doc_id 并批量删除
        all_doc_ids = []
        for idx in range(total):
            try:
                doc_id = store.index_to_docstore_id[idx]
                all_doc_ids.append(doc_id)
            except Exception:
                continue

        if all_doc_ids:
            store.delete(all_doc_ids)
            await asyncio.to_thread(store.save_local, FAISS_DATA_PATH)
            logger.info(f"已清空知识库（删除 {len(all_doc_ids)} 篇文档）")

    except Exception as e:
        logger.error(f"清空知识库失败: {e}")


async def search_knowledge_base(query: str, n_results: int = 5) -> list[dict]:
    """
    语义搜索知识库

    Args:
        query: 搜索查询文本
        n_results: 返回结果数量

    Returns:
        搜索结果列表 [{id, document, metadata, distance}]
    """
    try:
        embedding_function = await _get_embedding_function()

        index_path = os.path.join(FAISS_DATA_PATH, "index.faiss")
        if not os.path.exists(index_path):
            return []

        store = FAISS.load_local(
            FAISS_DATA_PATH,
            embedding_function,
            allow_dangerous_deserialization=True,
        )

        total = store.index.ntotal
        if total == 0:
            return []

        # 在线程池中执行同步搜索
        docs_with_scores = await asyncio.to_thread(
            store.similarity_search_with_score,
            query,
            k=min(n_results, total),
        )

        documents = []
        for doc, score in docs_with_scores:
            d = {
                "id": doc.metadata.get("article_id", ""),
                "document": doc.page_content,
                "metadata": doc.metadata,
                "distance": float(score),
            }
            documents.append(d)

        return documents

    except LLMServiceError:
        raise
    except Exception as e:
        logger.error(f"知识库搜索失败: {traceback.format_exc()}")
        raise LLMServiceError(
            message=f"知识库搜索失败: {str(e)}",
            model_type="embedding",
            error_code="KB_SEARCH_FAILED",
        ) from e


async def get_knowledge_stats() -> dict:
    """
    获取知识库统计信息
    """
    try:
        index_path = os.path.join(FAISS_DATA_PATH, "index.faiss")
        if not os.path.exists(index_path):
            return {
                "total_documents": 0,
                "collection_name": "ai_news",
            }

        embedding_function = await _get_embedding_function()
        store = FAISS.load_local(
            FAISS_DATA_PATH,
            embedding_function,
            allow_dangerous_deserialization=True,
        )

        return {
            "total_documents": store.index.ntotal,
            "collection_name": "ai_news",
        }

    except Exception as e:
        logger.error(f"获取知识库统计失败: {e}")
        return {
            "total_documents": 0,
            "collection_name": "ai_news",
            "error": str(e),
        }


def _parse_document_chunks(document_text: str) -> list[dict]:
    """
    将知识库文档文本解析为结构化切块

    文档格式: "{title}\n{summary}\n要点：{points}\n影响：{impact}"
    """
    chunks = []
    lines = document_text.strip().split("\n")

    if not lines:
        return [{"chunk_type": "未知", "content": document_text}]

    # 第一段是标题
    chunks.append({
        "chunk_type": "标题",
        "content": lines[0],
    })

    # 解析后续内容
    summary_parts = []
    points_text = ""
    impact_text = ""
    current_section = "summary"

    for line in lines[1:]:
        stripped = line.strip()
        if stripped.startswith("要点：") or stripped.startswith("要点:"):
            current_section = "points"
            points_text = stripped.split("：", 1)[-1] if "：" in stripped else stripped.split(":", 1)[-1]
        elif stripped.startswith("影响：") or stripped.startswith("影响:"):
            current_section = "impact"
            impact_text = stripped.split("：", 1)[-1] if "：" in stripped else stripped.split(":", 1)[-1]
        elif current_section == "summary":
            summary_parts.append(stripped)
        elif current_section == "points":
            points_text += "\n" + stripped
        elif current_section == "impact":
            impact_text += "\n" + stripped

    if summary_parts:
        chunks.append({
            "chunk_type": "摘要",
            "content": "\n".join(summary_parts),
        })

    if points_text:
        # 将 "、" 分隔的要点拆分为独立条目
        point_items = [p.strip() for p in points_text.split("、") if p.strip()]
        if len(point_items) > 1:
            for i, point in enumerate(point_items, 1):
                chunks.append({
                    "chunk_type": f"要点 {i}",
                    "content": point,
                })
        else:
            chunks.append({
                "chunk_type": "要点",
                "content": points_text,
            })

    if impact_text:
        chunks.append({
            "chunk_type": "影响分析",
            "content": impact_text,
        })

    return chunks


async def list_knowledge_documents(
    page: int = 1, size: int = 20
) -> dict:
    """
    分页列出知识库中的所有文档

    Returns:
        {items: [{article_id, title, doc_id}], total, page, size, pages}
    """
    try:
        index_path = os.path.join(FAISS_DATA_PATH, "index.faiss")
        if not os.path.exists(index_path):
            return {"items": [], "total": 0, "page": page, "size": size, "pages": 0}

        embedding_function = await _get_embedding_function()
        store = await asyncio.to_thread(
            lambda: FAISS.load_local(
                FAISS_DATA_PATH,
                embedding_function,
                allow_dangerous_deserialization=True,
            )
        )

        total = store.index.ntotal
        if total == 0:
            return {"items": [], "total": 0, "page": page, "size": size, "pages": 0}

        # 通过 docstore 获取所有文档信息
        all_docs = []
        for idx in range(total):
            try:
                doc_id = store.index_to_docstore_id[idx]
                doc = store.docstore.search(doc_id)
                if isinstance(doc, Document):
                    article_id = doc.metadata.get("article_id")
                    title = doc.metadata.get("title", "未知")
                    all_docs.append({
                        "article_id": article_id,
                        "title": title,
                        "doc_id": doc_id,
                    })
            except Exception as e:
                logger.warning(f"读取文档 {idx} 失败: {e}")
                continue

        # 分页
        pages = math.ceil(len(all_docs) / size)
        start = (page - 1) * size
        end = start + size
        items = all_docs[start:end]

        return {
            "items": items,
            "total": len(all_docs),
            "page": page,
            "size": size,
            "pages": pages,
        }

    except Exception as e:
        logger.error(f"列出知识库文档失败: {traceback.format_exc()}")
        raise


async def get_knowledge_document(article_id: int) -> dict:
    """
    获取知识库中指定文章的详细信息，包含解析后的切块

    Returns:
        {article_id, title, doc_id, document, chunks: [{chunk_type, content}]}
    """
    try:
        index_path = os.path.join(FAISS_DATA_PATH, "index.faiss")
        if not os.path.exists(index_path):
            return None

        embedding_function = await _get_embedding_function()
        store = await asyncio.to_thread(
            lambda: FAISS.load_local(
                FAISS_DATA_PATH,
                embedding_function,
                allow_dangerous_deserialization=True,
            )
        )

        doc_id = f"article_{article_id}"
        try:
            doc = store.docstore.search(doc_id)
        except Exception:
            logger.info(f"文档 {doc_id} 在 FAISS docstore 中不存在")
            return None

        if not isinstance(doc, Document):
            return None

        document_text = doc.page_content
        chunks = _parse_document_chunks(document_text)

        return {
            "article_id": doc.metadata.get("article_id"),
            "title": doc.metadata.get("title", "未知"),
            "doc_id": doc_id,
            "document": document_text,
            "chunks": chunks,
        }

    except Exception as e:
        logger.error(f"获取知识库文档详情失败 [article_id={article_id}]: {traceback.format_exc()}")
        raise
