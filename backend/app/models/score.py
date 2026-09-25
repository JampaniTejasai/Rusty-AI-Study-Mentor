import uuid
from datetime import datetime
from sqlalchemy import Integer, Text, Boolean, DateTime, func, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class QuizScore(Base):
    __tablename__ = "quiz_scores"

    score_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    class_num: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    subject: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    chapter: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    total: Mapped[int] = mapped_column(Integer, default=10)
    weak_topics: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    math_type_breakdown: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    taken_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now() + func.cast("1 year", type_=None),
    )
