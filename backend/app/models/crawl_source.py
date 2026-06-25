"""
CrawlSource 数据模型
存储 RSS 爬取源（预设 + 用户自定义）
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CrawlSource(Base):
    """RSS 爬取源模型"""

    __tablename__ = "crawl_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False, unique=True)
    category: Mapped[str] = mapped_column(String(50), default="ai")
    is_preset: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), default=datetime.utcnow
    )

    def __repr__(self) -> str:
        return f"<CrawlSource(id={self.id}, name='{self.name}', preset={self.is_preset})>"

    def to_dict(self) -> dict:
        """转为与 sources.py 兼容的字典格式"""
        return {
            "name": self.name,
            "rss": self.url,
            "source_name": self.name,
            "category": self.category,
        }
