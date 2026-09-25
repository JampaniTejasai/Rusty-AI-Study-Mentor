"""Tests for health and readiness endpoints."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_health_returns_ok():
    from app.api.health import health
    result = await health()
    assert result["status"] == "ok"


@pytest.mark.asyncio
async def test_ready_checks_database():
    from app.api.health import ready

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    mock_factory = MagicMock(return_value=mock_session)

    with patch("app.api.health.get_session_factory", return_value=mock_factory):
        with patch("app.api.health.get_settings") as mock_settings:
            mock_settings.return_value.llm_provider = "ollama"
            mock_settings.return_value.ollama_base_url = "http://localhost:11434"
            with patch("app.api.health.httpx.AsyncClient") as mock_client:
                mock_resp = AsyncMock()
                mock_resp.raise_for_status = MagicMock()
                client_instance = AsyncMock()
                client_instance.get = AsyncMock(return_value=mock_resp)
                client_instance.__aenter__ = AsyncMock(return_value=client_instance)
                client_instance.__aexit__ = AsyncMock(return_value=False)
                mock_client.return_value = client_instance

                result = await ready()
                assert result["checks"]["database"] == "ok"
                assert result["checks"]["llm"] == "ok"
