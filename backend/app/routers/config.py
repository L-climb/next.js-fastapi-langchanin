import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.llm.exceptions import LLMServiceError, validate_llm_config
from app.llm.factory import get_chat_model, get_embedding_model, get_llm_config_from_db
from app.models.config import LLMConfig

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["config"])

# Pydantic model for request and response
class LLMConfigResponse(BaseModel):
    provider: str
    api_key: str | None = None
    base_url: str | None = None
    chat_model: str
    embedding_model: str | None = None

    class Config:
        from_attributes = True

# The ID for the single configuration row
CONFIG_ID = 1

@router.get("/llm", response_model=LLMConfigResponse)
async def get_llm_config(db: AsyncSession = Depends(get_db)):
    """获取当前 LLM 配置"""
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == CONFIG_ID))
    config = result.scalar_one_or_none()

    if not config:
        # If no config exists, create a default one
        default_config = LLMConfig(id=CONFIG_ID)
        db.add(default_config)
        await db.commit()
        await db.refresh(default_config)
        config = default_config
        logger.info("未找到 LLM 配置，已创建默认配置。")

    return config

@router.post("/llm", response_model=LLMConfigResponse)
async def update_llm_config(new_config: LLMConfigResponse, db: AsyncSession = Depends(get_db)):
    """更新 LLM 配置"""
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == CONFIG_ID))
    config = result.scalar_one_or_none()

    if not config:
        config = LLMConfig(id=CONFIG_ID)
        db.add(config)

    # Update fields
    config.provider = new_config.provider
    config.api_key = new_config.api_key
    config.base_url = new_config.base_url
    config.chat_model = new_config.chat_model
    config.embedding_model = new_config.embedding_model

    try:
        await db.commit()
        await db.refresh(config)
        logger.info("LLM 配置已更新。")
        return config
    except Exception as e:
        await db.rollback()
        logger.error(f"更新 LLM 配置失败: {e}")
        raise HTTPException(status_code=500, detail="更新配置时数据库出错")


# ==================== 连通性测试 ====================


class TestResult(BaseModel):
    """单项测试结果"""
    success: bool
    message: str


class TestLLMResponse(BaseModel):
    """LLM 连通性测试响应"""
    chat: TestResult
    embedding: TestResult


@router.post("/llm/test", response_model=TestLLMResponse)
async def test_llm_connectivity():
    """测试当前 LLM 配置的连通性（聊天模型 + Embedding 模型）"""
    # 1. 从数据库加载配置
    try:
        config = await get_llm_config_from_db()
    except Exception as e:
        logger.error(f"测试连通性时无法加载配置: {e}")
        fail = TestResult(success=False, message=f"无法加载配置: {e}")
        return TestLLMResponse(chat=fail, embedding=fail)

    # 2. 测试聊天模型
    chat_result = await _test_chat(config)

    # 3. 测试 Embedding 模型
    embedding_result = await _test_embedding(config)

    return TestLLMResponse(chat=chat_result, embedding=embedding_result)


async def _test_chat(config: LLMConfig) -> TestResult:
    """测试聊天模型连通性"""
    try:
        validate_llm_config(config)
    except LLMServiceError as e:
        return TestResult(success=False, message=f"配置校验失败: {e.message}")

    try:
        llm = get_chat_model(config)
        response = await llm.ainvoke("请回复一个字：好")
        content = getattr(response, "content", str(response))
        logger.info(f"聊天模型测试成功: {content[:50]}")
        return TestResult(success=True, message=f"连接成功，模型已正常响应")
    except LLMServiceError as e:
        return TestResult(success=False, message=e.message)
    except Exception as e:
        err_msg = str(e)
        logger.error(f"聊天模型测试失败: {err_msg}")
        # 提取关键错误信息，避免过长的错误堆栈
        if "api_key" in err_msg.lower() or "401" in err_msg:
            return TestResult(success=False, message="API Key 无效或鉴权失败，请检查密钥")
        if "connect" in err_msg.lower() or "timeout" in err_msg.lower():
            return TestResult(success=False, message="无法连接到模型服务，请检查 Base URL 和网络")
        if "model" in err_msg.lower() and "not found" in err_msg.lower():
            return TestResult(success=False, message=f"模型 '{config.chat_model}' 不存在，请检查模型名称")
        return TestResult(success=False, message=f"调用失败: {err_msg[:200]}")


async def _test_embedding(config: LLMConfig) -> TestResult:
    """测试 Embedding 模型连通性"""
    try:
        validate_llm_config(config, for_embedding=True)
    except LLMServiceError as e:
        return TestResult(success=False, message=f"配置校验失败: {e.message}")

    try:
        embedding = get_embedding_model(config)
        # 尝试异步调用，如果不存在则用线程池包装同步调用
        if hasattr(embedding, "aembed_documents"):
            try:
                vector = await embedding.aembed_documents(["测试文本"])
            except NotImplementedError:
                vector = await asyncio.to_thread(embedding.embed_documents, ["测试文本"])
        else:
            vector = await asyncio.to_thread(embedding.embed_documents, ["测试文本"])
        dim = len(vector[0]) if vector and vector[0] else 0
        logger.info(f"Embedding 模型测试成功，向量维度: {dim}")
        return TestResult(success=True, message=f"连接成功，向量维度: {dim}")
    except LLMServiceError as e:
        return TestResult(success=False, message=e.message)
    except Exception as e:
        err_msg = str(e)
        logger.error(f"Embedding 模型测试失败: {err_msg}")
        if "api_key" in err_msg.lower() or "401" in err_msg:
            return TestResult(success=False, message="API Key 无效或鉴权失败，请检查密钥")
        if "connect" in err_msg.lower() or "timeout" in err_msg.lower():
            return TestResult(success=False, message="无法连接到 Embedding 服务，请检查 Base URL 和网络")
        if "model" in err_msg.lower() and "not found" in err_msg.lower():
            model_name = config.embedding_model or "默认"
            return TestResult(success=False, message=f"Embedding 模型 '{model_name}' 不存在，请检查模型名称")
        return TestResult(success=False, message=f"调用失败: {err_msg[:200]}")
