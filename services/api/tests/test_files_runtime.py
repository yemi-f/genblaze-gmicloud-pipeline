"""Integration tests for the file browser endpoints.

Monkeypatches the repo layer so no real B2 call is made.
"""

from datetime import UTC, datetime

import pytest


@pytest.mark.asyncio
async def test_list_files_returns_entries(client, monkeypatch):
    from app.repo import pipelines as pipes
    from app.runtime import files as runtime_files
    from app.types import FileEntry

    sample = [
        FileEntry(
            key="runs/abc/manifest.json", filename="manifest.json",
            folder="runs/abc/", size_bytes=1024, size_human="1.0 KB",
            content_type="application/json", uploaded_at=datetime.now(UTC),
        ),
    ]

    monkeypatch.setattr(pipes, "list_assets", lambda prefix="", max_keys=1000: sample)
    monkeypatch.setattr(runtime_files, "list_assets", lambda prefix="", max_keys=1000: sample)

    response = await client.get("/files")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["key"] == "runs/abc/manifest.json"


@pytest.mark.asyncio
async def test_list_files_rejects_invalid_limit(client):
    response = await client.get("/files?limit=0")
    assert response.status_code == 400
    response = await client.get("/files?limit=1001")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_preview_rejects_path_traversal(client):
    response = await client.get("/files/..%2Fetc%2Fpasswd/preview")
    # Path-traversal patterns get rejected before any storage call
    assert response.status_code in (400, 404)


@pytest.mark.asyncio
async def test_delete_file_success(client, monkeypatch):
    from app.repo import pipelines as pipes
    from app.runtime import files as runtime_files

    calls: list[str] = []
    monkeypatch.setattr(pipes, "delete_asset", lambda key: calls.append(key))
    monkeypatch.setattr(runtime_files, "delete_asset", lambda key: calls.append(key))

    response = await client.delete("/files/runs/abc/manifest.json")
    assert response.status_code == 200
    assert response.json() == {"deleted": True, "key": "runs/abc/manifest.json"}
    assert calls == ["runs/abc/manifest.json"]


@pytest.mark.asyncio
async def test_delete_file_storage_error_returns_500(client, monkeypatch):
    from app.repo import pipelines as pipes
    from app.runtime import files as runtime_files

    def _raise(key):
        raise RuntimeError("B2 down")

    monkeypatch.setattr(pipes, "delete_asset", _raise)
    monkeypatch.setattr(runtime_files, "delete_asset", _raise)

    response = await client.delete("/files/runs/abc/manifest.json")
    assert response.status_code == 500


@pytest.mark.asyncio
async def test_file_content_returns_bytes(client, monkeypatch):
    from app.repo import pipelines as pipes
    from app.runtime import files as runtime_files

    payload = b'{"canonical_hash": "abc123", "run": {"id": "r-1"}}'
    monkeypatch.setattr(pipes, "fetch_manifest_bytes", lambda key: payload)
    monkeypatch.setattr(runtime_files, "fetch_manifest_bytes", lambda key: payload)

    response = await client.get("/files/runs/abc/manifest.json/content")
    assert response.status_code == 200
    assert response.content == payload
    assert response.headers["content-type"].startswith("application/json")


@pytest.mark.asyncio
async def test_file_content_too_large_returns_413(client, monkeypatch):
    from app.repo import pipelines as pipes
    from app.runtime import files as runtime_files

    huge = b"x" * (5 * 1024 * 1024 + 1)
    monkeypatch.setattr(pipes, "fetch_manifest_bytes", lambda key: huge)
    monkeypatch.setattr(runtime_files, "fetch_manifest_bytes", lambda key: huge)

    response = await client.get("/files/runs/abc/big.bin/content")
    assert response.status_code == 413
