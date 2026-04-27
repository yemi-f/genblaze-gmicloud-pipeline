from pathlib import Path

from pydantic_settings import BaseSettings

# Project root holds the canonical `.env` for the whole monorepo.
# settings.py is at services/api/app/config/settings.py — climb 4 levels.
# Computing this from __file__ keeps env loading independent of CWD,
# so it works whether you run `pnpm dev`, `cd services/api && uvicorn`,
# or pytest from any directory.
_ROOT_ENV = Path(__file__).resolve().parents[4] / ".env"


class Settings(BaseSettings):
    # Backblaze B2 — standard env var names (parent CLAUDE.md §3)
    b2_endpoint: str = ""
    b2_region: str = ""  # e.g. us-west-004; derived from B2_REGION env var
    b2_key_id: str = ""
    b2_application_key: str = ""
    b2_bucket_name: str = ""

    # GMICloud — obtain at https://gmicloud.ai/
    gmi_api_key: str = ""

    # Optional: step cache directory for reproducible runs (same prompt+seed skips GMI calls)
    step_cache_dir: str = "./.cache/genblaze"

    # Optional: OTLP endpoint; if set CompositeTracer adds OTelTracer
    otel_endpoint: str = ""

    # Optional: webhook for async completion notifications
    webhook_url: str = ""
    webhook_header_authorization: str = ""

    api_port: int = 8000
    # Next dev server falls back to :3001 when :3000 is busy; default allows both.
    api_cors_origins: str = "http://localhost:3000,http://localhost:3001"

    model_config = {"env_file": str(_ROOT_ENV), "env_file_encoding": "utf-8"}

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",")]


settings = Settings()
