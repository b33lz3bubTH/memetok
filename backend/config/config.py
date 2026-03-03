from typing import List, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from dotenv import load_dotenv

load_dotenv()

_INSECURE_DEFAULTS = frozenset({
    "change-me",
    "change-super-admin-key",
    "your_default_api_key_here",
})


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "memetok"

    streamlander_base_url: str = "http://localhost:8080"
    streamlander_api_key: str = "your_default_api_key_here"

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

    # --- Production / enterprise settings ---
    environment: Literal["development", "production"] = "development"
    log_format: Literal["text", "json"] = "text"

    # Rate limiting (requests per minute per IP)
    rate_limit_rpm: int = 600
    # Request timeout in seconds
    request_timeout_seconds: int = 120
    # Max JSON request body (MB) — separate from upload max
    max_request_body_mb: int = 10

    # MongoDB connection pool
    mongo_max_pool_size: int = 50
    mongo_min_pool_size: int = 5
    mongo_server_selection_timeout_ms: int = 5000

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

    def validate_production_secrets(self) -> List[str]:
        """Return list of config problems. Raises in production if secrets are defaults."""
        problems: list[str] = []
        if self.super_admin_api_key in _INSECURE_DEFAULTS:
            problems.append("SUPER_ADMIN_API_KEY is still a default value")
        if self.internal_jobs_secret in _INSECURE_DEFAULTS:
            problems.append("INTERNAL_JOBS_SECRET is still a default value")
        if self.streamlander_api_key in _INSECURE_DEFAULTS:
            problems.append("STREAMLANDER_API_KEY is still a default value")
        if self.cors_allow_origins == ["*"]:
            problems.append("CORS_ALLOW_ORIGINS is set to wildcard '*'")
        return problems


settings = Settings()
