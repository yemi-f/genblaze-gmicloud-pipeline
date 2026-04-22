"""FastAPI handlers for the generative pipeline runs.

Three SSE-streaming POST endpoints kick off each pipeline stage.
Two GET endpoints serve snapshots and manifests.
One GET redirects asset keys to presigned URLs.

Response bodies use Genblaze's own Pydantic models (Run, Step, Asset) — no
custom DTOs are needed since FastAPI serializes them directly.
"""

import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse, Response, StreamingResponse

from app.repo import (
    build_image_pipeline,
    build_iteration_pipeline,
    build_video_fanout,
    fetch_manifest_bytes,
    presign_asset_url,
    stream_run,
)
from app.types.runs import ApproveRequest, IterateRequest, RunRequest

logger = logging.getLogger("api.runs")
router = APIRouter()

# In-memory store: run_id → PipelineResult. Sufficient for a session-scoped demo.
# The manifest in B2 is the durable record; anyone with the run_id can re-derive
# state from runs/{run_id}/manifest.json.
_run_store: dict[str, Any] = {}  # Any = PipelineResult (no direct genblaze import)


def _sse_stream(pipeline):
    """Yield SSE data lines; store PipelineResult on the terminal event.

    The first 'pipeline.started' event's run_id becomes the store key.
    Returns a generator; the actual run_id is captured as the side-effect.
    """
    run_id: str | None = None
    for event in stream_run(pipeline):
        ev_dict = event.to_dict()
        yield f"data: {json.dumps(ev_dict)}\n\n"
        # Capture run_id from first event
        if run_id is None and event.run_id:
            run_id = event.run_id
        # Store result on completion
        if event.type == "pipeline.completed" and event.result is not None and run_id:
            _run_store[run_id] = event.result


@router.post("/runs/stream")
async def start_run(req: RunRequest):
    """Generate an image from a prompt. Streams StreamEvents as SSE."""
    pipeline = build_image_pipeline(req)
    return StreamingResponse(
        _sse_stream(pipeline),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


@router.post("/runs/{parent_id}/iterate/stream")
async def iterate_run(parent_id: str, req: IterateRequest):
    """Fork from a prior run (text regen or image-as-reference). Streams SSE."""
    parent = _run_store.get(parent_id)
    if parent is None:
        raise HTTPException(status_code=404, detail=f"Run {parent_id!r} not found in session")
    # Pass parent_id explicitly — do not mutate the request model
    pipeline = build_iteration_pipeline(req, parent, parent_id=parent_id)
    return StreamingResponse(
        _sse_stream(pipeline),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


@router.post("/runs/{parent_id}/approve/stream")
async def approve_run(parent_id: str, req: ApproveRequest):
    """Fan out to three video models concurrently from the approved image. Streams SSE."""
    parent = _run_store.get(parent_id)
    if parent is None:
        raise HTTPException(status_code=404, detail=f"Run {parent_id!r} not found in session")
    # Pass parent_id explicitly — do not mutate the request model
    pipeline = build_video_fanout(req, parent, parent_id=parent_id)
    return StreamingResponse(
        _sse_stream(pipeline),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Return the Genblaze Run model for a cached session run."""
    result = _run_store.get(run_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id!r} not in session")
    return result.run


@router.get("/runs/{run_id}/manifest")
async def get_manifest(run_id: str):
    """Serve the manifest JSON from B2 (the durable record of the run)."""
    manifest_key = f"runs/{run_id}/manifest.json"
    try:
        data = fetch_manifest_bytes(manifest_key)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(content=data, media_type="application/json")


@router.get("/assets/{key:path}")
async def get_asset(key: str):
    """Redirect to a short-lived presigned URL for the given B2 asset key."""
    try:
        url = presign_asset_url(key)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return RedirectResponse(url=url, status_code=302)
