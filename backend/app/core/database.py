from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()


def _build_engine_kwargs() -> dict:
    url = make_url(settings.database_url)
    host = url.host or ""
    port = url.port
    database_url_lower = settings.database_url.lower()

    engine_kwargs: dict = {
        "echo": settings.debug,
        "pool_pre_ping": True,
    }
    connect_args: dict = {}

    # Supabase connections should use SSL in deployed environments.
    if "supabase" in host or "supabase" in database_url_lower:
        connect_args["ssl"] = "require"

    # Supabase transaction pooler works best without SQLAlchemy pooling.
    if "pooler.supabase.com" in host or port == 6543:
        engine_kwargs["poolclass"] = NullPool
    else:
        engine_kwargs["pool_size"] = 5
        engine_kwargs["max_overflow"] = 10

    if connect_args:
        engine_kwargs["connect_args"] = connect_args

    return engine_kwargs


engine = create_async_engine(
    settings.database_url,
    **_build_engine_kwargs(),
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
