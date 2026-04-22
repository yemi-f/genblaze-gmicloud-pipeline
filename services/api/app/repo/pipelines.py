"""Pipeline factory and storage accessors.

All genblaze_* imports are confined to this module. Storage is fully
delegated to genblaze-s3; no boto3 import exists anywhere in this sample.
"""

from functools import lru_cache

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
from app.types.runs import ApproveRequest, IterateRequest, RunRequest


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
        tracers.append(OTelTracer(endpoint=settings.otel_endpoint))
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
    """Single-step image generation (Seedream-5.0-Lite or caller-chosen model)."""
    return (
        Pipeline("genblaze-gmicloud-pipeline", max_concurrency=1)
        .cache(_cache()).tracer(_tracer())
        .step(
            GMICloudImageProvider(api_key=settings.gmi_api_key),
            model=req.image_model, modality=Modality.IMAGE,
            prompt=req.prompt, seed=req.seed, aspect_ratio=req.aspect_ratio,
        )
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
        # Image-as-reference: prior image supplied as visual context
        prior_prompt = (prev_result.run.steps[0].prompt if prev_result.run.steps else None) or ""
        return p.step(
            GMICloudImageProvider(api_key=settings.gmi_api_key),
            model=req.image_model, modality=Modality.IMAGE,
            prompt=req.prompt or prior_prompt,
            seed=req.seed, input_from=0,
        )
    return p.step(  # plain regenerate (text-only)
        GMICloudImageProvider(api_key=settings.gmi_api_key),
        model=req.image_model, modality=Modality.IMAGE,
        prompt=req.prompt, seed=req.seed,
    )


def build_video_fanout(
    req: ApproveRequest, approved_result, *, parent_id: str | None = None
) -> Pipeline:
    """Three sibling video steps, all reading input_from=0 (the approved image)."""
    # Derive prompt/seed from the approved image step; aspect_ratio from metadata
    image_step = approved_result.run.steps[0] if approved_result.run.steps else None
    image_prompt = (image_step.prompt if image_step else None) or ""
    image_seed = image_step.seed if image_step else None
    aspect_ratio = approved_result.run.metadata.get("aspect_ratio", "16:9")

    p = (
        Pipeline("genblaze-gmicloud-pipeline", max_concurrency=3)
        .tracer(_tracer())
        .from_result(approved_result)
    )
    for model in req.video_models:
        p = p.step(
            GMICloudVideoProvider(api_key=settings.gmi_api_key),
            model=model, modality=Modality.VIDEO,
            prompt=image_prompt, seed=image_seed,
            duration_sec=req.duration_sec, aspect_ratio=aspect_ratio,
            input_from=0,
        )
    return p


def stream_run(pipeline: Pipeline):
    """Yield StreamEvents; runtime converts to SSE lines. Webhook appended when configured."""
    sinks = [_sink()]
    if (wh := _webhook()):
        sinks.append(wh)
    return pipeline.stream(sink=sinks if len(sinks) > 1 else sinks[0], timeout=600)


# --- Storage accessors (presigning + manifest serving for the runtime layer) ---

def presign_asset_url(key: str, *, expires_in: int = 600) -> str:
    return _backend().get_url(key, expires_in=expires_in)


def fetch_manifest_bytes(key: str) -> bytes:
    return _backend().get(key)


def probe_storage() -> bool:
    """Health check — True if backend can reach the bucket."""
    try:
        _backend().exists("__genblaze_health_probe__")
        return True
    except Exception:
        return False
