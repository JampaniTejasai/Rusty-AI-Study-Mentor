import uuid
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.test import Test, Question
from app.models.attempt import TestAttempt


class TestRepository:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def create(self, test: Test) -> Test:
        self._s.add(test)
        await self._s.flush()
        return test

    async def get_by_id(self, test_id: uuid.UUID) -> Test | None:
        result = await self._s.execute(
            select(Test)
            .options(selectinload(Test.questions))
            .where(Test.test_id == test_id)
        )
        return result.scalar_one_or_none()

    async def get_question(self, question_id: uuid.UUID) -> Question | None:
        result = await self._s.execute(
            select(Question).where(Question.question_id == question_id)
        )
        return result.scalar_one_or_none()

    async def list_by_student(self, student_id: str) -> list[Test]:
        result = await self._s.execute(
            select(Test)
            .options(selectinload(Test.questions), selectinload(Test.attempts).selectinload(TestAttempt.answer_rows))
            .join(TestAttempt, Test.test_id == TestAttempt.test_id)
            .where(TestAttempt.student_id == student_id)
            .order_by(Test.created_at.desc())
        )
        return list(result.scalars().unique().all())

    async def delete(self, test_id: uuid.UUID) -> None:
        result = await self._s.execute(
            select(Test)
            .options(
                selectinload(Test.questions),
                selectinload(Test.attempts).selectinload(TestAttempt.answer_rows),
            )
            .where(Test.test_id == test_id)
        )
        test = result.scalar_one_or_none()
        if test:
            await self._s.delete(test)
            await self._s.flush()
