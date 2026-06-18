from sqlalchemy import Column, Integer, String
from app.database import Base

class LLMConfig(Base):
    __tablename__ = "llm_config"

    id = Column(Integer, primary_key=True)
    provider = Column(String, default="openai")
    api_key = Column(String, nullable=True)
    base_url = Column(String, nullable=True)
    chat_model = Column(String, default="gpt-4o-mini")
    embedding_model = Column(String, nullable=True)
