import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
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
