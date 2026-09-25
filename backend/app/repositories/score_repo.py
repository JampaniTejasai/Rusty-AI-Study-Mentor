from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.score import QuizScore


class ScoreRepository:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def save(self, score: QuizScore) -> QuizScore:
        self._s.add(score)
        await self._s.flush()
        return score

    async def get_for_student(
        self,
        student_id: str,
        class_num: int | None = None,
        subject: str | None = None,
    ) -> list[QuizScore]:
        q = select(QuizScore).where(QuizScore.student_id == student_id)
        if class_num is not None:
            q = q.where(QuizScore.class_num == class_num)
        if subject:
            q = q.where(QuizScore.subject == subject)
        q = q.order_by(QuizScore.taken_at.desc())
        return (await self._s.execute(q)).scalars().all()
