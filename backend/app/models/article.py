"""
Article 数据库模型
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Article(Base):
    """新闻文章模型"""

    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), unique=True, nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)  # 来源名称
    content: Mapped[str] = mapped_column(Text, nullable=False)  # 原始正文
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)  # LLM 生成的摘要
    summary_points: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON 格式的要点列表
    impact: Mapped[str | None] = mapped_column(Text, nullable=True)  # 影响分析
    crawled_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), default=datetime.utcnow
    )
    summarized_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="crawled")  # crawled / summarized / failed
    is_in_knowledge_base: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")

    def __repr__(self) -> str:
        return f"<Article(id={self.id}, title='{self.title[:30]}...', status='{self.status}')>"
