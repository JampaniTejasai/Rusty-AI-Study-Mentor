"""
Pre-computed chapter summaries — generated at ingestion time, served instantly.
One row per (class_num, subject, chapter, language) combination.
"""
import uuid
from datetime import datetime

from sqlalchemy import Integer, Text, DateTime, Index, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ChapterSummary(Base):
    __tablename__ = "chapter_summaries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    class_num: Mapped[int] = mapped_column(Integer, nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    chapter: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(Text, nullable=False)

    summary: Mapped[str] = mapped_column(Text, nullable=False)
    key_topics: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    important_formulas: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    important_definitions: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)

    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source_pdf: Mapped[str] = mapped_column(Text, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("class_num", "subject", "chapter", "language", name="uq_chapter_summary"),
        Index("ix_chapter_summary_lookup", "class_num", "subject", "chapter", "language"),
    )
