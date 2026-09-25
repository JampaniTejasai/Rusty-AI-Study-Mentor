"""
Repository for RAG trace persistence and aggregation queries.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, case, cast, Float
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rag_trace import RAGTraceRow


TTL_DAYS = 180  # 6 months


class TraceRepository:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def insert(self, row: RAGTraceRow) -> None:
        self._s.add(row)
        await self._s.flush()

    async def purge_expired(self) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(days=TTL_DAYS)
        result = await self._s.execute(
            delete(RAGTraceRow).where(RAGTraceRow.created_at < cutoff)
        )
        return result.rowcount

    async def recent(self, limit: int = 50) -> list[RAGTraceRow]:
        result = await self._s.execute(
            select(RAGTraceRow)
            .order_by(RAGTraceRow.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def summary_stats(self, days: int = 7) -> dict:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        q = select(
            func.count().label("total_queries"),
            func.avg(RAGTraceRow.total_ms).label("avg_total_ms"),
            func.avg(RAGTraceRow.embed_ms).label("avg_embed_ms"),
            func.avg(RAGTraceRow.retrieval_ms).label("avg_retrieval_ms"),
            func.avg(RAGTraceRow.llm_ms).label("avg_llm_ms"),
            func.sum(RAGTraceRow.llm_total_tokens).label("total_tokens"),
            func.avg(RAGTraceRow.llm_total_tokens).label("avg_tokens_per_query"),
            func.sum(case((RAGTraceRow.error.is_not(None), 1), else_=0)).label("error_count"),
            func.sum(case((RAGTraceRow.empty_response == True, 1), else_=0)).label("empty_count"),
            func.sum(case((RAGTraceRow.llm_json_valid == False, 1), else_=0)).label("json_fail_count"),
            func.sum(case((RAGTraceRow.lang_fallback == True, 1), else_=0)).label("fallback_count"),
            func.avg(RAGTraceRow.vector_hits).label("avg_vector_hits"),
            func.avg(RAGTraceRow.bm25_hits).label("avg_bm25_hits"),
            func.avg(RAGTraceRow.rrf_chunks).label("avg_rrf_chunks"),
            func.avg(RAGTraceRow.vector_top_score).label("avg_vector_top_score"),
        ).where(RAGTraceRow.created_at >= since)

        row = (await self._s.execute(q)).one()
        total = row.total_queries or 0

        return {
            "period_days": days,
            "total_queries": total,
            "avg_total_ms": round(row.avg_total_ms or 0, 1),
            "avg_embed_ms": round(row.avg_embed_ms or 0, 1),
            "avg_retrieval_ms": round(row.avg_retrieval_ms or 0, 1),
            "avg_llm_ms": round(row.avg_llm_ms or 0, 1),
            "total_tokens": row.total_tokens or 0,
            "avg_tokens_per_query": round(row.avg_tokens_per_query or 0, 1),
            "error_rate": round((row.error_count or 0) / total * 100, 1) if total else 0,
            "empty_rate": round((row.empty_count or 0) / total * 100, 1) if total else 0,
            "json_fail_rate": round((row.json_fail_count or 0) / total * 100, 1) if total else 0,
            "fallback_rate": round((row.fallback_count or 0) / total * 100, 1) if total else 0,
            "avg_vector_hits": round(row.avg_vector_hits or 0, 1),
            "avg_bm25_hits": round(row.avg_bm25_hits or 0, 1),
            "avg_rrf_chunks": round(row.avg_rrf_chunks or 0, 1),
            "avg_vector_top_score": round(row.avg_vector_top_score or 0, 4),
        }

    async def by_subject(self, days: int = 7) -> list[dict]:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        q = (
            select(
                RAGTraceRow.subject,
                func.count().label("count"),
                func.avg(RAGTraceRow.total_ms).label("avg_ms"),
                func.sum(RAGTraceRow.llm_total_tokens).label("tokens"),
                func.sum(case((RAGTraceRow.error.is_not(None), 1), else_=0)).label("errors"),
                func.sum(case((RAGTraceRow.empty_response == True, 1), else_=0)).label("empty"),
            )
            .where(RAGTraceRow.created_at >= since)
            .group_by(RAGTraceRow.subject)
            .order_by(func.count().desc())
        )
        rows = (await self._s.execute(q)).all()
        return [
            {
                "subject": r.subject,
                "count": r.count,
                "avg_ms": round(r.avg_ms or 0, 1),
                "tokens": r.tokens or 0,
                "error_rate": round((r.errors or 0) / r.count * 100, 1) if r.count else 0,
                "empty_rate": round((r.empty or 0) / r.count * 100, 1) if r.count else 0,
            }
            for r in rows
        ]

    async def latency_timeline(self, days: int = 7) -> list[dict]:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        q = (
            select(
                func.date_trunc("hour", RAGTraceRow.created_at).label("hour"),
                func.count().label("count"),
                func.avg(RAGTraceRow.total_ms).label("avg_total_ms"),
                func.avg(RAGTraceRow.embed_ms).label("avg_embed_ms"),
                func.avg(RAGTraceRow.retrieval_ms).label("avg_retrieval_ms"),
                func.avg(RAGTraceRow.llm_ms).label("avg_llm_ms"),
            )
            .where(RAGTraceRow.created_at >= since)
            .group_by("hour")
            .order_by("hour")
        )
        rows = (await self._s.execute(q)).all()
        return [
            {
                "hour": r.hour.isoformat(),
                "count": r.count,
                "avg_total_ms": round(r.avg_total_ms or 0, 1),
                "avg_embed_ms": round(r.avg_embed_ms or 0, 1),
                "avg_retrieval_ms": round(r.avg_retrieval_ms or 0, 1),
                "avg_llm_ms": round(r.avg_llm_ms or 0, 1),
            }
            for r in rows
        ]
