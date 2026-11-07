from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = ""
    auth0_domain: str = ""
    auth0_audience: str = ""
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    def required_database_url(self) -> str:
        url = self.database_url.strip()
        if url.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")):
            return url
        raise RuntimeError("DATABASE_URL must be a Postgres connection string")

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


def load_settings() -> Settings:
    return Settings()
