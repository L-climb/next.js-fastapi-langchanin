"""
知识库模块
使用 ChromaDB 向量数据库存储和检索文章知识
"""

import json
import logging

import chromadb
from app.llm.factory import get_embedding_model, get_llm_config_from_db
from app.llm.exceptions import LLMServiceError, wrap_llm_error

logger = logging.getLogger(__name__)

# 全局 ChromaDB 客户端（惰性初始化）
_client = None
_chromadb_available = True

def _get_client():
    """获取或创建 ChromaDB 客户端"""
    global _client, _chromadb_available
    if not _chromadb_available:
        return None
    if _client is None:
        try:
            # 注意：这里的路径需要从配置中读取，但为了简化，我们暂时硬编码
            # 在一个完整的实现中，这里应该也从数据库配置中读取
            _client = chromadb.PersistentClient(path="./chroma_data")
        except Exception as e:
            logger.warning(f"ChromaDB 初始化失败，知识库功能不可用: {e}")
            _chromadb_available = False
            return None
    return _client

async def get_collection():
    """获取或创建 ChromaDB 集合，并动态设置 embedding 函数"""
    if not _chromadb_available:
        return None

    client = _get_client()
    if client is None:
        return None

    # 动态获取 LLM 配置和 embedding 模型
    llm_config = await get_llm_config_from_db()
    embedding_function = get_embedding_model(llm_config)

    # LangChain 的 Chroma 集成会自动处理 embedding function
    # 但在这里我们直接使用 chromadb，需要手动处理
    # 为了简化，我们假设 LangChain 的 Chroma 包装器在别处使用
    # 这里我们只获取集合
    collection = client.get_or_create_collection(
        name="ai_news",
        # embedding_function=embedding_function # 原生chromadb需要这样，但我们通过langchain包装器
    )
    return collection, embedding_function

async def add_to_knowledge_base(
    article_id: int,
    title: str,
    summary: str,
    points: list,
    impact: str,
):
    """
    将文章摘要信息存入知识库
    """
    try:
        collection, embedding_function = await get_collection()
        if collection is None:
            logger.debug("ChromaDB 不可用，跳过存入知识库")
            return

        points_text = "、".join(points) if isinstance(points, list) else str(points)
        document = f"{title}\n{summary}\n要点：{points_text}\n影响：{impact}"

        metadata = {
            "article_id": article_id,
            "title": title,
        }

        # 使用获取到的 embedding function 生成向量
        embedding = embedding_function.embed_documents([document])[0]

        collection.upsert(
            ids=[f"article_{article_id}"],
            embeddings=[embedding],
            documents=[document],
            metadatas=[metadata],
        )

        logger.info(f"文章 {article_id} 已存入知识库")

    except LLMServiceError:
        raise
    except Exception as e:
        logger.error(f"存入知识库失败 [文章 {article_id}]: {e}")
        raise wrap_llm_error(e, model_type="embedding") from e

async def search_knowledge_base(query: str, n_results: int = 5) -> list[dict]:
    """
    语义搜索知识库
    """
    try:
        collection, embedding_function = await get_collection()
        if collection is None:
            return []

        if collection.count() == 0:
            return []

        # 使用获取到的 embedding function 生成查询向量
        query_embedding = embedding_function.embed_query(query)

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(n_results, collection.count()),
        )

        documents = []
        if results and results["ids"] and len(results["ids"]) > 0:
            for i in range(len(results["ids"][0])):
                doc = {
                    "id": results["ids"][0][i],
                    "document": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else 0,
                }
                documents.append(doc)

        return documents

    except LLMServiceError:
        raise
    except Exception as e:
        logger.error(f"知识库搜索失败: {e}")
        raise wrap_llm_error(e, model_type="embedding") from e

async def get_knowledge_stats() -> dict:
    """
    获取知识库统计信息
    """
    try:
        collection, _ = await get_collection()
        if collection is None:
            return {
                "total_documents": 0,
                "collection_name": "ai_news",
                "error": "ChromaDB 不可用",
            }
        return {
            "total_documents": collection.count(),
            "collection_name": "ai_news",
        }
    except Exception as e:
        logger.error(f"获取知识库统计失败: {e}")
        return {
            "total_documents": 0,
            "collection_name": "ai_news",
            "error": str(e),
        }
