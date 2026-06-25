"""
RSS 源管理路由
提供爬取源的增删查接口
"""

import logging
from pydantic import BaseModel, field_validator

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.crawl_source import CrawlSource

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sources", tags=["sources"])


# ==================== 请求/响应模型 ====================


class SourceCreate(BaseModel):
    """新增自定义源"""
    name: str
    url: str
    category: str = "ai"

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("名称不能为空")
        return v

    @field_validator("url")
    @classmethod
    def url_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("URL 不能为空")
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL 必须以 http:// 或 https:// 开头")
        return v


class SourceResponse(BaseModel):
    """源列表响应"""
    id: int
    name: str
    url: str
    category: str
    is_preset: bool

    class Config:
        from_attributes = True


# ==================== 路由处理 ====================


@router.get("", response_model=list[SourceResponse])
async def list_sources(db: AsyncSession = Depends(get_db)):
    """获取所有 RSS 源列表（预设 + 自定义）"""
    result = await db.execute(
        select(CrawlSource).order_by(CrawlSource.is_preset.desc(), CrawlSource.id.asc())
    )
    sources = result.scalars().all()
    return sources


@router.post("", response_model=SourceResponse)
async def create_source(source: SourceCreate, db: AsyncSession = Depends(get_db)):
    """新增自定义 RSS 源"""
    # 检查 URL 是否已存在
    existing = await db.execute(
        select(CrawlSource).where(CrawlSource.url == source.url)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该 RSS 源已存在")

    new_source = CrawlSource(
        name=source.name,
        url=source.url,
        category=source.category,
        is_preset=False,
    )
    db.add(new_source)
    await db.commit()
    await db.refresh(new_source)
    logger.info(f"新增自定义源: {new_source.name} ({new_source.url})")
    return new_source


@router.delete("/{source_id}")
async def delete_source(source_id: int, db: AsyncSession = Depends(get_db)):
    """删除自定义 RSS 源（预设源不可删除）"""
    result = await db.execute(
        select(CrawlSource).where(CrawlSource.id == source_id)
    )
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="源不存在")

    if source.is_preset:
        raise HTTPException(status_code=400, detail="预设源不可删除")

    await db.delete(source)
    await db.commit()
    logger.info(f"已删除自定义源: {source.name}")
    return {"message": "已删除"}
