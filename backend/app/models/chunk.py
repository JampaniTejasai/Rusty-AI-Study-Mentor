import uuid
from datetime import datetime
from sqlalchemy import Integer, Text, Boolean, ARRAY, DateTime, Index, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from app.core.database import Base


class Chunk(Base):
    __tablename__ = "chunks"

    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    class_num: Mapped[int] = mapped_column(Integer, nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    chapter: Mapped[str | None] = mapped_column(Text, nullable=True)
    section_type: Mapped[str] = mapped_column(Text, nullable=False)
    math_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    contains_formula: Mapped[bool] = mapped_column(Boolean, default=False)
    latex_equations: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    diagram_image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1024), nullable=True)
    page_num: Mapped[int | None] = mapped_column(Integer, nullable=True)
    language: Mapped[str] = mapped_column(Text, nullable=False, server_default="en")
    source_pdf: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_chunks_retrieval", "class_num", "subject", "language", "chapter"),
        Index("ix_chunks_source_pdf", "source_pdf"),
    )
