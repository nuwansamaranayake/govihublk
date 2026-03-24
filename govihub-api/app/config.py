"""GoviHub Configuration — Pydantic Settings loaded from environment."""

from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://govihub:password@postgres:5432/govihub"
    DATABASE_URL_SYNC: str = ""
    DB_PASS: str = "password"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Auth (Google OAuth)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # LLM (OpenRouter)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "anthropic/claude-sonnet-4-20250514"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # External APIs
    OPENWEATHER_API_KEY: str = ""

    # Object Storage (Cloudflare R2)
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "govihub"
    R2_PUBLIC_URL: str = "https://media.govihublk.com"

    # FCM (Firebase Cloud Messaging)
    FCM_CREDENTIALS_PATH: str = "/app/fcm-credentials.json"

    # SMS (Twilio)
    SMS_PROVIDER: str = "twilio"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    # App
    APP_NAME: str = "GoviHub"
    APP_ENV: str = "production"
    APP_DEBUG: bool = False
    APP_URL: str = "https://govihublk.com"
    ALLOWED_ORIGINS: str = "https://govihublk.com,https://govihub.lk"

    # MCP
    MCP_ADMIN_SECRET: str = "change-me"

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse comma-separated origins into a list."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def sync_database_url(self) -> str:
        """Synchronous database URL for Alembic."""
        if self.DATABASE_URL_SYNC:
            return self.DATABASE_URL_SYNC
        return self.DATABASE_URL.replace("+asyncpg", "")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
