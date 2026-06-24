"""Pipeline factory and storage accessors.

All genblaze_* imports are confined to this module. Storage is fully
delegated to genblaze-s3; no boto3 import exists anywhere in this sample.
"""

import mimetypes
import os
import uuid
from datetime import datetime
from functools import lru_cache
from urllib.parse import urlparse

from genblaze_core import (
    CompositeTracer,
    KeyStrategy,
    LoggingTracer,
    Modality,
    ObjectStorageSink,
    OTelTracer,
    Pipeline,
    StepCache,
    WebhookConfig,
    WebhookSink,
)
from genblaze_gmicloud import GMICloudImageProvider, GMICloudVideoProvider
from genblaze_s3 import S3StorageBackend

from app.config import settings
from app.repo._gmi_registry import video_registry as _video_registry
from app.types.files import FileEntry
from app.types.runs import ApproveRequest, IterateRequest, RunRequest


def _humanize_bytes(size: int) -> str:
    n = float(size)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(n) < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"


def _split_key(key: str) -> tuple[str, str]:
    parts = key.rsplit("/", 1)
    return (parts[0] + "/", parts[1]) if len(parts) == 2 else ("", parts[0])


@lru_cache(maxsize=1)
def _backend() -> S3StorageBackend:
    """Singleton backend — shared across uploads, presigning, and manifest reads."""
    return S3StorageBackend.for_backblaze(
        settings.b2_bucket_name,
        region=settings.b2_region,
        key_id=settings.b2_key_id,
        app_key=settings.b2_application_key,  # explicit — bypasses library's B2_APP_KEY fallback
        auto_lifecycle=True,
    )


def _sink() -> ObjectStorageSink:
    return ObjectStorageSink(_backend(), prefix="runs", key_strategy=KeyStrategy.HIERARCHICAL)


def _tracer() -> CompositeTracer:
    """JSON logging always on; OTel added when OTEL_ENDPOINT is set."""
    tracers = [LoggingTracer()]
    if settings.otel_endpoint:
        os.environ.setdefault("OTEL_EXPORTER_OTLP_ENDPOINT", settings.otel_endpoint)
        tracers.append(OTelTracer())
    return CompositeTracer(tracers)


def _cache() -> StepCache:
    return StepCache(settings.step_cache_dir)


def _webhook() -> WebhookSink | None:
    """Optional completion webhook, gated by WEBHOOK_URL env var."""
    if not settings.webhook_url:
        return None
    headers = {"Authorization": settings.webhook_header_authorization} if settings.webhook_header_authorization else {}
    return WebhookSink(WebhookConfig(url=settings.webhook_url, headers=headers))


# --- Pipeline builders ---

def build_image_pipeline(req: RunRequest) -> Pipeline:
    """Single-step image generation (seedream-5.0-lite or caller-chosen model)."""
    step_kwargs: dict = {
        "model": req.image_model,
        "modality": Modality.IMAGE,
        "prompt": req.prompt,
        "seed": req.seed,
        "aspect_ratio": req.aspect_ratio,
    }
    if req.reference_image_key:
        step_kwargs["image"] = presign_asset_url(req.reference_image_key)
    return (
        Pipeline("genblaze-gmicloud-pipeline", max_concurrency=1)
        .cache(_cache()).tracer(_tracer())
        .step(GMICloudImageProvider(api_key=settings.gmi_api_key), **step_kwargs)
    )


def build_iteration_pipeline(
    req: IterateRequest, prev_result, *, parent_id: str | None = None
) -> Pipeline:
    """Fork a previous run: text-only regen or image-as-reference.

    parent_id passed explicitly so callers never mutate the request model.
    """
    p = (
        Pipeline("genblaze-gmicloud-pipeline", max_concurrency=1)
        .cache(_cache()).tracer(_tracer())
        .from_result(prev_result)
    )
    if req.reference_asset_key:
        # Image-as-reference: presign the prior image so GMICloud can fetch it.
        # Cross-pipeline asset handoff goes through the `image=` param (not
        # input_from, which only indexes steps within the current pipeline).
        prior_prompt = (prev_result.run.steps[0].prompt if prev_result.run.steps else None) or ""
        return p.step(
            GMICloudImageProvider(api_key=settings.gmi_api_key),
            model=req.image_model, modality=Modality.IMAGE,
            prompt=req.prompt or prior_prompt,
            seed=req.seed,
            image=presign_asset_url(req.reference_asset_key),
        )
    return p.step(  # plain regenerate (text-only)
        GMICloudImageProvider(api_key=settings.gmi_api_key),
        model=req.image_model, modality=Modality.IMAGE,
        prompt=req.prompt, seed=req.seed,
    )


def build_video_fanout(
    req: ApproveRequest, approved_result, *, parent_id: str | None = None
) -> Pipeline:
    """Three sibling video steps; each receives the approved image as a
    presigned reference via image=<url>. from_result() now only records
    lineage (sets parent_run_id) — it no longer hydrates prior steps, so
    cross-pipeline asset handoff must go through params."""
    image_step = approved_result.run.steps[0] if approved_result.run.steps else None
    image_asset = image_step.assets[0] if (image_step and image_step.assets) else None
    if image_asset is None:
        raise ValueError("approved_result has no image asset to fan out from")

    image_prompt = (image_step.prompt if image_step else None) or ""
    image_seed = image_step.seed if image_step else None
    aspect_ratio = approved_result.run.metadata.get("aspect_ratio", "16:9")
    image_ref = presign_asset_url(image_asset.url)

    p = (
        Pipeline("genblaze-gmicloud-pipeline", max_concurrency=3)
        .tracer(_tracer())
        .from_result(approved_result)
    )
    for model in req.video_models:
        p = p.step(
            GMICloudVideoProvider(api_key=settings.gmi_api_key, models=_video_registry()),
            model=model, modality=Modality.VIDEO,
            prompt=image_prompt, seed=image_seed,
            duration=req.duration_sec, aspect_ratio=aspect_ratio,
            image=image_ref,
        )
    return p


def stream_run(pipeline: Pipeline):
    """Yield StreamEvents; runtime converts to SSE lines. Webhook appended when configured."""
    sinks = [_sink()]
    if (wh := _webhook()):
        sinks.append(wh)
    return pipeline.stream(sink=sinks if len(sinks) > 1 else sinks[0], timeout=600)


# --- Storage accessors (presigning + manifest serving for the runtime layer) ---

def _resolve_key(key_or_url: str) -> str:
    """Normalize a bare key or a durable B2 S3 URL to an object key.

    @genblaze/spec Asset.url and Manifest.manifest_uri are durable URLs (no
    SigV4) written by ObjectStorageSink; neither model carries a separate
    storage-key field, so callers parse it here.
    """
    if key_or_url.startswith("http"):
        path = urlparse(key_or_url).path.lstrip("/")
        # Strip `<bucket>/` prefix — the remainder is the object key.
        _, _, key = path.partition("/")
        return key
    return key_or_url


def presign_asset_url(key_or_url: str, *, expires_in: int = 600) -> str:
    """Return a short-lived presigned URL for a B2 asset."""
    return _backend().get_url(_resolve_key(key_or_url), expires_in=expires_in)


def fetch_manifest_bytes(key_or_url: str) -> bytes:
    """Fetch raw manifest bytes from B2.

    Accepts a bare key or a durable URL (Manifest.manifest_uri) — the actual
    storage path depends on the sink's prefix + KeyStrategy, so callers
    should pass manifest_uri rather than reconstructing keys themselves.
    """
    return _backend().get(_resolve_key(key_or_url))


def list_assets(prefix: str = "", max_keys: int = 1000) -> list[FileEntry]:
    """Enumerate bucket contents for the file browser.

    genblaze-s3 exposes no list primitive yet; reach through the backend's
    internal boto3 client to stay within the repo layer rather than adding
    a direct boto3 import elsewhere.
    """
    client = _backend()._client
    resp = client.list_objects_v2(
        Bucket=settings.b2_bucket_name, Prefix=prefix, MaxKeys=max_keys,
    )
    entries: list[FileEntry] = []
    for obj in resp.get("Contents", []):
        key = obj["Key"]
        folder, filename = _split_key(key)
        mime, _ = mimetypes.guess_type(key)
        entries.append(FileEntry(
            key=key, filename=filename, folder=folder,
            size_bytes=obj["Size"], size_human=_humanize_bytes(obj["Size"]),
            content_type=mime or "application/octet-stream",
            uploaded_at=obj["LastModified"] if isinstance(obj["LastModified"], datetime) else datetime.fromisoformat(str(obj["LastModified"])),
        ))
    entries.sort(key=lambda f: f.uploaded_at, reverse=True)
    return entries


def upload_reference_image(data: bytes, content_type: str, extension: str) -> str:
    """Store a user-uploaded style-reference image in B2. Returns the object key."""
    key = f"uploads/{uuid.uuid4()}{extension}"
    _backend().put(key, data, content_type=content_type)
    return key


def delete_asset(key: str) -> None:
    _backend().delete(key)


def probe_storage() -> bool:
    """Health check — True if backend can reach the bucket."""
    try:
        _backend().exists("__genblaze_health_probe__")
        return True
    except Exception:
        return False
