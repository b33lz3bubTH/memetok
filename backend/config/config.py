from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "memetok"

    streamlander_base_url: str = "http://localhost:8080"

    auth_disabled: bool = True
    clerk_issuer: str = ""
    clerk_jwks_url: str = ""

    internal_jobs_secret: str = "change-me"

    super_admin_api_key: str = "change-super-admin-key"
    upload_max_files: int = 8
    upload_max_file_size_mb: int = 250
    upload_ingest_concurrency: int = 8
    pipeline_workers: int = 2

    cors_allow_origins: List[str] = ["*"]

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _parse_cors_allow_origins(cls, v):
        if v is None:
            return ["*"]
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            raw = v.strip()
            if raw == "":
                return ["*"]
            if raw == "*":
                return ["*"]
            # allow comma-separated in .env
            return [s.strip() for s in raw.split(",") if s.strip()]
        return v


settings = Settings()
