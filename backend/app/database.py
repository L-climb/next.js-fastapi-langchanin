"""
数据库模块
使用 SQLAlchemy 2.0 异步引擎
"""

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# 创建异步引擎，增加 connect_args 设置 busy_timeout
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"timeout": 30},  # SQLite busy_timeout = 30 秒
)


# 启用 WAL 模式（提升并发读写性能）
@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")  # 30 秒
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


# 创建异步会话工厂
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """声明式基类"""
    pass


async def get_db():
    """异步数据库会话依赖注入"""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """初始化数据库，创建所有表"""
    # 导入模型以确保它们被注册
    from app.models.article import Article  # noqa: F401
    from app.models.config import LLMConfig  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # 兼容已有数据库：补全缺失列
        result = await conn.execute(text("PRAGMA table_info(articles)"))
        columns = {row[1] for row in result.fetchall()}
        if "is_in_knowledge_base" not in columns:
            await conn.execute(
                text(
                    "ALTER TABLE articles ADD COLUMN is_in_knowledge_base BOOLEAN NOT NULL DEFAULT 0"
                )
            )
