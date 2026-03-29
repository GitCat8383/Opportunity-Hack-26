from functools import lru_cache
import json

from pydantic import field_validator
from pydantic_settings import BaseSettings


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

    # Email / notifications
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_from_name: str = "CareFlow"
    appointment_reminder_window_days: int = 3

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            trimmed = value.strip()
            if not trimmed:
                return ["http://localhost:3000"]
            if trimmed.startswith("["):
                return json.loads(trimmed)
            return [item.strip() for item in trimmed.split(",") if item.strip()]
        return value

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "enable_decoding": False,
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
