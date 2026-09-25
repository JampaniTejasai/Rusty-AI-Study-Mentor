"""Tests for prompt versioning."""
import re


def test_prompt_version_exists():
    from rag.retrieval.prompt_builder import PROMPT_VERSION
    assert PROMPT_VERSION
    assert re.match(r"^v\d+\.\d+$", PROMPT_VERSION)


def test_prompt_version_in_trace():
    from app.services.rag_trace import RAGTrace
    trace = RAGTrace(prompt_version="v1.1")
    assert trace.prompt_version == "v1.1"


def test_prompt_version_in_emit():
    from app.services.rag_trace import RAGTrace
    trace = RAGTrace(prompt_version="v1.1", mode="study", subject="mathematics")
    trace.finish()
    assert trace.prompt_version == "v1.1"
