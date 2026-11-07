from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE_URL = f"sqlite:///{(BACKEND_DIR / 'pennies.db').as_posix()}"


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

    def resolved_database_url(self) -> str:
        url = self.database_url.strip()
        return url or DEFAULT_DATABASE_URL

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


def load_settings() -> Settings:
    return Settings()
