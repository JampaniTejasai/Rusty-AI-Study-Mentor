from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.chunk import Chunk


class ChunkRepository:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def vector_search(
        self,
        embedding: list[float],
        class_num: int,
        subject: str,
        chapter: str | None,
        language: str | None = None,
        top_k: int = 10,
    ) -> list[tuple[Chunk, float]]:
        """cosine similarity search pre-filtered by class/subject/chapter/language."""
        q = (
            select(Chunk, Chunk.embedding.cosine_distance(embedding).label("distance"))
            .where(Chunk.class_num == class_num)
            .where(Chunk.subject == subject)
        )
        if chapter:
            q = q.where(func.lower(Chunk.chapter) == chapter.lower())
        if language:
            q = q.where(Chunk.language == language)
        q = q.order_by("distance").limit(top_k)
        rows = (await self._s.execute(q)).all()
        return [(row.Chunk, row.distance) for row in rows]

    async def bm25_search(
        self,
        query: str,
        class_num: int,
        subject: str,
        chapter: str | None,
        language: str | None = None,
        top_k: int = 10,
    ) -> list[tuple[Chunk, float]]:
        """Full-text BM25 search pre-filtered by class/subject/chapter/language."""
        filters = "class_num = :class_num AND subject = :subject"
        params: dict = {"class_num": class_num, "subject": subject, "query": query}
        if chapter:
            filters += " AND lower(chapter) = lower(:chapter)"
            params["chapter"] = chapter
        if language:
            filters += " AND language = :language"
            params["language"] = language

        sql = text(
            f"""
            SELECT chunk_id,
                   ts_rank_cd(to_tsvector('simple', text_content),
                              plainto_tsquery('simple', :query)) AS rank
            FROM chunks
            WHERE {filters}
              AND to_tsvector('simple', text_content) @@ plainto_tsquery('simple', :query)
            ORDER BY rank DESC
            LIMIT :top_k
            """
        )
        params["top_k"] = top_k
        rows = (await self._s.execute(sql, params)).fetchall()
        chunk_ids = [r.chunk_id for r in rows]
        rank_map = {r.chunk_id: r.rank for r in rows}

        if not chunk_ids:
            return []

        chunks = (
            await self._s.execute(select(Chunk).where(Chunk.chunk_id.in_(chunk_ids)))
        ).scalars().all()
        return [(c, rank_map[c.chunk_id]) for c in chunks]

    async def get_by_ids(self, chunk_ids: list) -> list[Chunk]:
        result = await self._s.execute(select(Chunk).where(Chunk.chunk_id.in_(chunk_ids)))
        return result.scalars().all()

    async def distinct_chapters(
        self, class_num: int, subject: str
    ) -> list[str]:
        q = (
            select(Chunk.chapter)
            .where(Chunk.class_num == class_num)
            .where(Chunk.subject == subject)
            .where(Chunk.chapter.is_not(None))
            .distinct()
            .order_by(Chunk.chapter)
        )
        rows = (await self._s.execute(q)).scalars().all()
        return [r for r in rows if r]

    async def available_subjects(self, class_num: int) -> list[str]:
        q = (
            select(Chunk.subject)
            .where(Chunk.class_num == class_num)
            .distinct()
            .order_by(Chunk.subject)
        )
        rows = (await self._s.execute(q)).scalars().all()
        return list(rows)
