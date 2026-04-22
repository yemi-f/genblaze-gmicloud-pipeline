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
async def test_get_manifest_not_found(client, monkeypatch):
    """GET /runs/{id}/manifest returns 404 when B2 fetch fails."""
    from app.repo import pipelines as pipes

    def _raise(key):
        raise Exception("not found")

    monkeypatch.setattr(pipes, "fetch_manifest_bytes", _raise)

    response = await client.get("/runs/no-such-run/manifest")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_asset_not_found(client, monkeypatch):
    """GET /assets/{key} returns 404 when presign fails."""
    from app.repo import pipelines as pipes

    def _raise(key, **kwargs):
        raise Exception("not found")

    monkeypatch.setattr(pipes, "presign_asset_url", _raise)

    response = await client.get("/assets/runs/nope/image.jpg", follow_redirects=False)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_post_runs_stream_returns_sse(client, monkeypatch):
    """POST /runs/stream with mocked repo functions returns SSE text/event-stream."""
    from genblaze_core.observability.events import StreamEvent

    # Patch at the repo module level (runtime/runs.py imports from app.repo)
    import app.repo.pipelines as pipes
    import app.runtime.runs as runtime_runs

    class _FakePipeline:
        pass

    def _fake_build(req):
        return _FakePipeline()

    def _fake_stream_run(pipeline):
        """Yield one event; matches the stream_run(pipeline) signature."""
        yield StreamEvent(type="pipeline.started", run_id="fake-run-id")

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
