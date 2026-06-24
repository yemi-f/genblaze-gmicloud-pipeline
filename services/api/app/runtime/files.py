"""File browser endpoints — list/preview/delete against the shared B2 bucket.

Thin layer over app.repo; the tree view and preview modal live in the Next app.
"""

import logging
import mimetypes
import re

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.repo import delete_asset, fetch_manifest_bytes, list_assets, presign_asset_url, upload_reference_image
from app.types import FileEntry

logger = logging.getLogger("api.files")
router = APIRouter()

# Reject empty keys and path-traversal attempts before they hit the backend.
_DANGEROUS_KEY_RE = re.compile(r"(\.\./|/\.\.|\\|%2e%2e|%00|\x00)")

_MAX_CONTENT_BYTES = 5 * 1024 * 1024  # cap for /files/{key}/content (JSON/text viewer)
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # cap for reference-image uploads
_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _validate_key(key: str) -> None:
    if not key or _DANGEROUS_KEY_RE.search(key.lower()):
        raise HTTPException(status_code=400, detail="Invalid file key")


@router.post("/uploads/reference")
async def upload_reference(file: UploadFile = File(...)):
    """Accept a user image, store it in B2 under uploads/, return its key.

    The key is passed as reference_image_key in POST /runs/stream so the
    pipeline can presign it and forward it to the image model as image=<url>.
    """
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported type: {file.content_type!r}. Allowed: jpeg, png, webp, gif")
    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large ({len(data)} bytes). Limit is 10 MB")
    ext = mimetypes.guess_extension(file.content_type) or ".bin"
    # mimetypes maps image/jpeg → .jpeg on some platforms; normalise to .jpg
    if ext == ".jpeg":
        ext = ".jpg"
    try:
        key = upload_reference_image(data, file.content_type, ext)
    except Exception as exc:
        logger.exception("upload_reference_image failed")
        raise HTTPException(status_code=502, detail=f"Storage upload failed: {exc}") from exc
    logger.info("Reference image uploaded: key=%s size=%d", key, len(data))
    return {"key": key}


@router.get("/files", response_model=list[FileEntry])
async def list_files(prefix: str = "", limit: int = 200):
    if limit < 1 or limit > 1000:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 1000")
    try:
        return list_assets(prefix=prefix, max_keys=limit)
    except Exception as exc:
        logger.exception("list_assets failed")
        raise HTTPException(status_code=502, detail=f"Storage list failed: {exc}") from exc


@router.get("/files/{key:path}/preview")
async def preview_file(key: str):
    """Short-lived presigned URL for inline preview (no download counter)."""
    _validate_key(key)
    try:
        return {"url": presign_asset_url(key)}
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/files/{key:path}/content")
async def file_content(key: str):
    """Proxy small file bodies through the API so the JSON viewer works
    regardless of whether the bucket has CORS configured for the web origin.
    Capped at 5 MB — media should use the presigned URL path instead.
    """
    _validate_key(key)
    try:
        data = fetch_manifest_bytes(key)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if len(data) > _MAX_CONTENT_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is {len(data)} bytes; inline preview is capped at {_MAX_CONTENT_BYTES}",
        )
    mime, _ = mimetypes.guess_type(key)
    return Response(content=data, media_type=mime or "application/octet-stream")


@router.delete("/files/{key:path}")
async def delete_file(key: str):
    _validate_key(key)
    try:
        delete_asset(key)
    except Exception as exc:
        logger.exception("delete_asset failed for %s", key)
        raise HTTPException(status_code=500, detail="Failed to delete file") from exc
    logger.info("File deleted: key=%s", key)
    return {"deleted": True, "key": key}
