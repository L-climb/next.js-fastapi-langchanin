import logging
from sqlalchemy.future import select
from app.database import async_session
from app.models.config import LLMConfig
from app.llm.exceptions import validate_llm_config
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

logger = logging.getLogger(__name__)

CONFIG_ID = 1

async def get_llm_config_from_db():
    """从数据库异步获取 LLM 配置"""
    async with async_session() as session:
        result = await session.execute(select(LLMConfig).where(LLMConfig.id == CONFIG_ID))
        config = result.scalar_one_or_none()
        if not config:
            logger.warning("数据库中未找到 LLM 配置，将使用默认设置创建。")
            config = LLMConfig(id=CONFIG_ID)
            session.add(config)
            await session.commit()
            await session.refresh(config)
        return config

def get_chat_model(config: LLMConfig):
    """根据配置返回对应的 ChatModel 实例"""
    validate_llm_config(config)
    if config.provider in ["openai", "dashscope", "siliconflow", "ollama"]:
        kwargs = {
            "model": config.chat_model,
            "api_key": config.api_key or "ollama", # ollama不需要key
        }
        if config.base_url:
            kwargs["base_url"] = config.base_url
        return ChatOpenAI(**kwargs)
    else:
        raise ValueError(f"不支持的 LLM 提供商: {config.provider}")

def get_embedding_model(config: LLMConfig):
    """根据配置返回对应的 Embedding 实例"""
    validate_llm_config(config, for_embedding=True)
    if config.provider in ["openai", "dashscope", "siliconflow", "ollama"]:
        kwargs = {
            "api_key": config.api_key or "ollama",
        }
        if config.embedding_model:
            kwargs["model"] = config.embedding_model
        if config.base_url:
            kwargs["base_url"] = config.base_url
        return OpenAIEmbeddings(**kwargs)
    else:
        raise ValueError(f"不支持的 LLM 提供商: {config.provider}")
