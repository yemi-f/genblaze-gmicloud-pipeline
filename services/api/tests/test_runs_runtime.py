"""Integration tests for the runs runtime endpoints.

Uses monkeypatching to avoid real GMICloud / B2 calls.
"""

import pytest


@pytest.mark.asyncio
async def test_unknown_run_iterate_returns_404(client):
    """Iterating a run that doesn't exist in session returns 404."""
    response = await client.post(
        "/runs/nonexistent-id/iterate/stream",
        json={"parent_run_id": "nonexistent-id", "prompt": "new prompt"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_unknown_run_approve_returns_404(client):
    """Approving a run that doesn't exist in session returns 404."""
    response = await client.post(
        "/runs/nonexistent-id/approve/stream",
        json={"run_id": "nonexistent-id", "approved_step_id": "step-0"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_run_not_found(client):
    """GET /runs/{id} returns 404 for unknown run."""
    response = await client.get("/runs/no-such-run")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_manifest_not_in_session_returns_404(client):
    """GET /runs/{id}/manifest returns 404 when run isn't in the session store."""
    response = await client.get("/runs/no-such-run/manifest")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_manifest_uses_recorded_manifest_uri(client, monkeypatch):
    """Endpoint must fetch via the sink-recorded manifest_uri, not a guessed key.

    Regression: previously the handler hard-coded ``runs/{run_id}/manifest.json``,
    which never matched the layout produced by ObjectStorageSink under
    ``prefix='runs'`` + ``KeyStrategy.HIERARCHICAL`` (which writes to
    ``runs/runs/[tenant/]{date}/{run_id}/manifest.json``).
    """
    from types import SimpleNamespace

    from app.repo import pipelines as pipes
    from app.runtime import runs as runtime_runs

    durable_uri = "https://s3.us-west-004.backblazeb2.com/test-bucket/runs/runs/2026-04-27/abc/manifest.json"
    fake_result = SimpleNamespace(manifest=SimpleNamespace(manifest_uri=durable_uri))
    runtime_runs._run_store["abc"] = fake_result

    captured: dict[str, str] = {}

    def _fake_fetch(key_or_url: str) -> bytes:
        captured["arg"] = key_or_url
        return b'{"canonical_hash": "deadbeef"}'

    monkeypatch.setattr(pipes, "fetch_manifest_bytes", _fake_fetch)
    monkeypatch.setattr(runtime_runs, "fetch_manifest_bytes", _fake_fetch)
    try:
        response = await client.get("/runs/abc/manifest")
    finally:
        runtime_runs._run_store.pop("abc", None)

    assert response.status_code == 200
    assert response.json() == {"canonical_hash": "deadbeef"}
    assert captured["arg"] == durable_uri


@pytest.mark.asyncio
async def test_get_asset_not_found(client, monkeypatch):
    """GET /assets/{key} returns 404 when presign fails."""
    # Patch the binding actually resolved by the route (imported via
    # `from app.repo import presign_asset_url` at module load time).
    # Patching app.repo.pipelines.presign_asset_url alone is a no-op here.
    from app.runtime import runs as runs_runtime

    def _raise(key, **kwargs):
        raise Exception("not found")

    monkeypatch.setattr(runs_runtime, "presign_asset_url", _raise)

    response = await client.get("/assets/runs/nope/image.jpg", follow_redirects=False)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_post_runs_stream_returns_sse(client, monkeypatch):
    """POST /runs/stream with mocked repo functions returns SSE text/event-stream."""
    # genblaze 0.2.3 made StreamEvent a discriminated union; construct the
    # per-variant class rather than the deprecated StreamEvent(type=...) form.
    from genblaze_core.observability.events import PipelineStartedEvent

    # Patch at the repo module level (runtime/runs.py imports from app.repo)
    import app.repo.pipelines as pipes
    import app.runtime.runs as runtime_runs

    class _FakePipeline:
        pass

    def _fake_build(req):
        return _FakePipeline()

    def _fake_stream_run(pipeline):
        """Yield one event; matches the stream_run(pipeline) signature."""
        yield PipelineStartedEvent(run_id="fake-run-id", total_steps=1)

    monkeypatch.setattr(pipes, "build_image_pipeline", _fake_build)
    monkeypatch.setattr(runtime_runs, "stream_run", _fake_stream_run)
    monkeypatch.setattr(runtime_runs, "build_image_pipeline", _fake_build)

    response = await client.post(
        "/runs/stream",
        json={"prompt": "a mountain at dawn"},
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert b"data:" in response.content
