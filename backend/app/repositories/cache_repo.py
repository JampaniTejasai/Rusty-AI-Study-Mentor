"""
Repository for response cache — cosine similarity lookup + insert + TTL purge.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text, delete, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.response_cache import ResponseCache


_SIMILARITY_THRESHOLD = 0.05


class CacheRepository:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def find_similar(
        self,
        embedding: list[float],
        class_num: int,
        subject: str,
        chapter: str | None,
        medium: str = "en",
    ) -> ResponseCache | None:
        chapter_filter = (
            "chapter = :chapter" if chapter else "chapter IS NULL"
        )
        params: dict = {
            "class_num": class_num,
            "subject": subject,
            "medium": medium,
            "embedding": str(embedding),
            "threshold": _SIMILARITY_THRESHOLD,
        }
        if chapter:
            params["chapter"] = chapter

        sql = text(f"""
            SELECT cache_id,
                   (query_embedding <=> CAST(:embedding AS vector)) AS distance
            FROM response_cache
            WHERE class_num = :class_num
              AND subject = :subject
              AND {chapter_filter}
              AND medium = :medium
              AND created_at > NOW() - (ttl_hours || ' hours')::interval
              AND (query_embedding <=> CAST(:embedding AS vector)) < :threshold
            ORDER BY distance
            LIMIT 1
        """)
        row = (await self._s.execute(sql, params)).first()
        if not row:
            return None

        result = await self._s.execute(
            select(ResponseCache).where(ResponseCache.cache_id == row.cache_id)
        )
        entry = result.scalar_one_or_none()
        if entry:
            await self._s.execute(
                update(ResponseCache)
                .where(ResponseCache.cache_id == entry.cache_id)
                .values(
                    hit_count=ResponseCache.hit_count + 1,
                    last_hit_at=func.now(),
                )
            )
        return entry

    async def store(
        self,
        embedding: list[float],
        class_num: int,
        subject: str,
        chapter: str | None,
        medium: str,
        query_text: str,
        response_json: dict,
        prompt_version: str,
    ) -> ResponseCache:
        entry = ResponseCache(
            class_num=class_num,
            subject=subject,
            chapter=chapter,
            medium=medium,
            query_text=query_text,
            query_embedding=embedding,
            response_json=response_json,
            prompt_version=prompt_version,
        )
        self._s.add(entry)
        await self._s.flush()
        return entry

    async def purge_expired(self) -> int:
        result = await self._s.execute(
            delete(ResponseCache).where(
                ResponseCache.created_at < func.now() - text("(ttl_hours || ' hours')::interval")
            )
        )
        return result.rowcount or 0

    async def invalidate_subject(self, class_num: int, subject: str) -> int:
        result = await self._s.execute(
            delete(ResponseCache).where(
                ResponseCache.class_num == class_num,
                ResponseCache.subject == subject,
            )
        )
        return result.rowcount or 0
