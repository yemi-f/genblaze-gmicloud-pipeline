"""Integration tests for the health endpoint."""

import pytest


@pytest.mark.asyncio
async def test_health_returns_200(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "b2_connected" in data
    assert "gmi_key_present" in data
    assert data["status"] in ("healthy", "degraded")
