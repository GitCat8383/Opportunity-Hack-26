from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "Nonprofit Case Management API"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # Database (direct connection for SQLAlchemy)
    database_url: str  # postgresql+asyncpg://...

    # AI Keys
    gemini_api_key: str

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
