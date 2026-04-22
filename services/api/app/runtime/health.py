from fastapi import APIRouter

from app.config import settings
from app.repo import probe_storage

router = APIRouter()


@router.get("/health")
async def health():
    """Health check: verifies B2 connectivity and GMI key presence."""
    b2_ok = probe_storage()
    return {
        "status": "healthy" if b2_ok else "degraded",
        "b2_connected": b2_ok,
        "gmi_key_present": bool(settings.gmi_api_key),
    }
