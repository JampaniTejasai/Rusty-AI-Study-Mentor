"""
Health and readiness probes for Cloud Run.
/health — liveness (always 200 if process is up)
/ready  — readiness (checks DB and LLM connectivity)
"""
import time

import httpx
import structlog
from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import get_session_factory
from app.core.config import get_settings
from app.services.circuit_breaker import llm_breaker

log = structlog.get_logger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/ready")
async def ready():
    checks = {}

    try:
        async with get_session_factory()() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {type(exc).__name__}"

    checks["circuit_breaker"] = llm_breaker.state.value

    settings = get_settings()
    if settings.llm_provider == "ollama":
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{settings.ollama_base_url}/api/tags")
                resp.raise_for_status()
            checks["llm"] = "ok"
        except Exception as exc:
            checks["llm"] = f"error: {type(exc).__name__}"
    else:
        checks["llm"] = "vertex_ai"

    all_ok = checks["database"] == "ok" and checks.get("llm") != "error"
    status_code = 200 if all_ok else 503
    return {"status": "ready" if all_ok else "degraded", "checks": checks}
