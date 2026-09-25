"""
RAG pipeline trace — accumulates timing and metrics through each stage.
One trace per query. Logged as a single structured event at the end.
Query text is persisted for child-safeguarding oversight (admin-only).
Never records student IDs or IP addresses.
"""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any

import structlog

log = structlog.get_logger("rag.trace")


@dataclass
class RAGTrace:
    trace_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    query_text: str = ""
    mode: str = ""
    subject: str = ""
    class_num: int = 0
    chapter: str | None = None
    medium: str = "en"

    # Embedding stage
    embed_ms: float = 0.0

    # Retrieval stage
    vector_hits: int = 0
    vector_top_score: float = 0.0
    bm25_hits: int = 0
    bm25_top_score: float = 0.0
    retrieval_ms: float = 0.0
    lang_fallback: bool = False
    rrf_chunks: int = 0
    chunk_chapters: list[str] = field(default_factory=list)

    # Prompt
    prompt_version: str = ""
    cache_hit: bool = False

    # LLM stage
    llm_provider: str = ""
    llm_model: str = ""
    llm_prompt_tokens: int = 0
    llm_completion_tokens: int = 0
    llm_total_tokens: int = 0
    llm_ms: float = 0.0
    llm_json_valid: bool = True

    # Content previews (no PII — textbook content + generated output only)
    retrieved_chunks_preview: list[str] = field(default_factory=list)
    llm_response_preview: str = ""

    # Quality signals
    empty_response: bool = False
    mcq_generated: int = 0
    mcq_dropped: int = 0
    ground_check_kept: int = 0
    ground_check_dropped: int = 0

    # Overall
    total_ms: float = 0.0
    error: str | None = None

    _start: float = field(default_factory=time.perf_counter, repr=False)
    _db_session: Any = field(default=None, repr=False)

    def finish(self) -> None:
        self.total_ms = _elapsed_ms(self._start)

    def emit(self) -> None:
        """Log the complete trace as one structured event."""
        self.finish()
        data = {
            "trace_id": self.trace_id,
            "mode": self.mode,
            "subject": self.subject,
            "class_num": self.class_num,
            "chapter": self.chapter or "",
            "medium": self.medium,
            "embed_ms": round(self.embed_ms, 1),
            "vector_hits": self.vector_hits,
            "vector_top_score": round(self.vector_top_score, 4),
            "bm25_hits": self.bm25_hits,
            "bm25_top_score": round(self.bm25_top_score, 4),
            "retrieval_ms": round(self.retrieval_ms, 1),
            "lang_fallback": self.lang_fallback,
            "rrf_chunks": self.rrf_chunks,
            "llm_provider": self.llm_provider,
            "llm_model": self.llm_model,
            "llm_prompt_tokens": self.llm_prompt_tokens,
            "llm_completion_tokens": self.llm_completion_tokens,
            "llm_total_tokens": self.llm_total_tokens,
            "llm_ms": round(self.llm_ms, 1),
            "llm_json_valid": self.llm_json_valid,
            "prompt_version": self.prompt_version,
            "cache_hit": self.cache_hit,
            "empty_response": self.empty_response,
            "total_ms": round(self.total_ms, 1),
        }
        if self.mode == "test":
            data["mcq_generated"] = self.mcq_generated
            data["mcq_dropped"] = self.mcq_dropped
        if self.mode == "study":
            data["ground_check_kept"] = self.ground_check_kept
            data["ground_check_dropped"] = self.ground_check_dropped
        if self.chunk_chapters:
            data["chunk_chapters"] = self.chunk_chapters
        if self.error:
            data["error"] = self.error
            log.error("rag_trace", **data)
        else:
            log.info("rag_trace", **data)

    async def persist(self) -> None:
        """Write trace to DB if a session was provided."""
        if not self._db_session:
            return
        from app.models.rag_trace import RAGTraceRow
        row = RAGTraceRow(
            trace_id=self.trace_id,
            query_text=self.query_text or None,
            prompt_version=self.prompt_version or None,
            cache_hit=self.cache_hit,
            mode=self.mode,
            subject=self.subject,
            class_num=self.class_num,
            chapter=self.chapter,
            medium=self.medium,
            embed_ms=round(self.embed_ms, 1),
            vector_hits=self.vector_hits,
            vector_top_score=round(self.vector_top_score, 4),
            bm25_hits=self.bm25_hits,
            bm25_top_score=round(self.bm25_top_score, 4),
            retrieval_ms=round(self.retrieval_ms, 1),
            lang_fallback=self.lang_fallback,
            rrf_chunks=self.rrf_chunks,
            chunk_chapters=self.chunk_chapters or None,
            retrieved_chunks_preview=self.retrieved_chunks_preview or None,
            llm_response_preview=self.llm_response_preview or None,
            llm_provider=self.llm_provider,
            llm_model=self.llm_model,
            llm_prompt_tokens=self.llm_prompt_tokens,
            llm_completion_tokens=self.llm_completion_tokens,
            llm_total_tokens=self.llm_total_tokens,
            llm_ms=round(self.llm_ms, 1),
            llm_json_valid=self.llm_json_valid,
            empty_response=self.empty_response,
            mcq_generated=self.mcq_generated,
            mcq_dropped=self.mcq_dropped,
            ground_check_kept=self.ground_check_kept,
            ground_check_dropped=self.ground_check_dropped,
            total_ms=round(self.total_ms, 1),
            error=self.error,
        )
        self._db_session.add(row)
        await self._db_session.flush()


def _elapsed_ms(start: float) -> float:
    return (time.perf_counter() - start) * 1000


class Timer:
    """Context manager that records elapsed ms into a trace field."""

    def __init__(self) -> None:
        self.ms: float = 0.0
        self._start: float = 0.0

    def __enter__(self) -> Timer:
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_: Any) -> None:
        self.ms = _elapsed_ms(self._start)
