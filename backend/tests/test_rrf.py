from types import SimpleNamespace
import uuid
from rag.retrieval.rrf import reciprocal_rank_fusion


def make_chunk(chunk_id=None):
    c = SimpleNamespace()
    c.chunk_id = chunk_id or uuid.uuid4()
    return c


def test_rrf_returns_top_k():
    chunks = [make_chunk() for _ in range(5)]
    vector = [(c, 0.9 - i * 0.1) for i, c in enumerate(chunks)]
    bm25 = [(c, 0.8 - i * 0.1) for i, c in enumerate(reversed(chunks))]
    result = reciprocal_rank_fusion(vector, bm25, top_k=3)
    assert len(result) == 3


def test_rrf_empty_lists():
    result = reciprocal_rank_fusion([], [], top_k=3)
    assert result == []


def test_rrf_single_source():
    chunks = [make_chunk() for _ in range(5)]
    vector = [(c, 0.9 - i * 0.1) for i, c in enumerate(chunks)]
    result = reciprocal_rank_fusion(vector, [], top_k=3)
    assert len(result) == 3


def test_rrf_deduplicates_same_chunk():
    shared = make_chunk()
    other = make_chunk()
    vector = [(shared, 0.9), (other, 0.8)]
    bm25 = [(shared, 0.85), (other, 0.7)]
    result = reciprocal_rank_fusion(vector, bm25, top_k=2)
    ids = [str(c.chunk_id) for c in result]
    assert len(ids) == len(set(ids)), "Duplicate chunks in RRF output"
