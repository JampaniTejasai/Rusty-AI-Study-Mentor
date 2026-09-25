"""
Response cache — stores successful RAG responses keyed by query embedding.
Queries with cosine similarity > 0.95 in the same class/subject/chapter reuse cached responses.
TTL: 7 days (textbook content changes infrequently).
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, Text, func, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from app.core.database import Base


class ResponseCache(Base):
    __tablename__ = "response_cache"

    cache_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    class_num: Mapped[int] = mapped_column(Integer, nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    chapter: Mapped[str | None] = mapped_column(Text, nullable=True)
    medium: Mapped[str] = mapped_column(Text, nullable=False, server_default="en")

    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    query_embedding: Mapped[list] = mapped_column(Vector(1024), nullable=False)

    response_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    prompt_version: Mapped[str] = mapped_column(Text, nullable=False)

    hit_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    last_hit_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ttl_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=168)

    __table_args__ = (
        Index("ix_response_cache_lookup", "class_num", "subject", "chapter"),
        Index("ix_response_cache_created", "created_at"),
    )
