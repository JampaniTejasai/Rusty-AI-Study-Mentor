"""
Persisted RAG trace — one row per retrieval query.
Query text stored for child-safeguarding oversight (admin-only access).
No student IDs or IP addresses.
TTL: rows older than 6 months are purged on startup.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Float, Integer, Text, func, Index,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RAGTraceRow(Base):
    __tablename__ = "rag_traces"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    trace_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    query_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    mode: Mapped[str] = mapped_column(Text, nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    class_num: Mapped[int] = mapped_column(Integer, nullable=False)
    chapter: Mapped[str | None] = mapped_column(Text, nullable=True)
    medium: Mapped[str] = mapped_column(Text, nullable=False, server_default="en")

    embed_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    vector_hits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    vector_top_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    bm25_hits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bm25_top_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    retrieval_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    lang_fallback: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rrf_chunks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chunk_chapters: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    retrieved_chunks_preview: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    llm_response_preview: Mapped[str | None] = mapped_column(Text, nullable=True)

    prompt_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    cache_hit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    llm_provider: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    llm_model: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    llm_prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    llm_completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    llm_total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    llm_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    llm_json_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    empty_response: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mcq_generated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mcq_dropped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ground_check_kept: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ground_check_dropped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    total_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_rag_traces_created_at", "created_at"),
        Index("ix_rag_traces_subject_mode", "subject", "mode"),
    )
