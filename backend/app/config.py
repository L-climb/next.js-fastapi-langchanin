"""
应用配置模块
使用 pydantic-settings 从环境变量和 .env 文件读取配置
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置"""

    # 数据库配置
    DATABASE_URL: str = "sqlite+aiosqlite:///./news.db"

    # 向量数据库配置（FAISS）
    FAISS_PATH: str = "./faiss_data"

    # LLM 配置
    LLM_PROVIDER: str = "openai"  # openai / dashscope / ollama / siliconflow
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = ""  # 可选，用于兼容其他 OpenAI 接口
    LLM_MODEL: str = "gpt-4o-mini"

    # 爬虫配置
    CRAWL_INTERVAL_MINUTES: int = 60

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
