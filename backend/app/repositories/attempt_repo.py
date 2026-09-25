import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.attempt import TestAttempt, AttemptAnswer


class AttemptRepository:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def create(self, attempt: TestAttempt) -> TestAttempt:
        self._s.add(attempt)
        await self._s.flush()
        return attempt

    async def get(self, attempt_id: uuid.UUID) -> TestAttempt | None:
        result = await self._s.execute(
            select(TestAttempt)
            .options(selectinload(TestAttempt.answer_rows))
            .where(TestAttempt.attempt_id == attempt_id)
        )
        return result.scalar_one_or_none()

    async def get_by_test_and_student(
        self, test_id: uuid.UUID, student_id: str
    ) -> TestAttempt | None:
        result = await self._s.execute(
            select(TestAttempt)
            .options(selectinload(TestAttempt.answer_rows))
            .where(TestAttempt.test_id == test_id)
            .where(TestAttempt.student_id == student_id)
        )
        return result.scalar_one_or_none()

    async def add_answer(self, answer: AttemptAnswer) -> AttemptAnswer:
        self._s.add(answer)
        await self._s.flush()
        return answer

    async def count_answers(self, attempt_id: uuid.UUID) -> int:
        result = await self._s.execute(
            select(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt_id)
        )
        return len(result.scalars().all())
