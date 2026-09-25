from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chapter_summary import ChapterSummary


class SummaryRepository:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def get(
        self,
        class_num: int,
        subject: str,
        chapter: str,
        language: str,
    ) -> ChapterSummary | None:
        result = await self._s.execute(
            select(ChapterSummary)
            .where(ChapterSummary.class_num == class_num)
            .where(ChapterSummary.subject == subject)
            .where(ChapterSummary.chapter == chapter)
            .where(ChapterSummary.language == language)
        )
        return result.scalar_one_or_none()

    async def list_available(
        self,
        class_num: int,
        subject: str,
        language: str,
    ) -> list[str]:
        result = await self._s.execute(
            select(ChapterSummary.chapter)
            .where(ChapterSummary.class_num == class_num)
            .where(ChapterSummary.subject == subject)
            .where(ChapterSummary.language == language)
            .order_by(ChapterSummary.chapter)
        )
        return list(result.scalars().all())
