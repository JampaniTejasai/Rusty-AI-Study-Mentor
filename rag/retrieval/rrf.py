"""
Reciprocal Rank Fusion — merges vector and BM25 ranked lists.
k=60 is the standard constant that dampens outlier rank differences.
"""

def reciprocal_rank_fusion(
    vector_results: list[tuple],   # [(chunk, score), ...]
    bm25_results: list[tuple],
    top_k: int = 3,
    k: int = 60,
) -> list:
    """
    Returns top_k chunks fused from both ranked lists.
    Each chunk is identified by its chunk_id.
    """
    scores: dict = {}

    def _id(chunk) -> str:
        return str(chunk.chunk_id)

    for rank, (chunk, _) in enumerate(vector_results):
        cid = _id(chunk)
        scores.setdefault(cid, {"chunk": chunk, "score": 0.0})
        scores[cid]["score"] += 1.0 / (k + rank + 1)

    for rank, (chunk, _) in enumerate(bm25_results):
        cid = _id(chunk)
        scores.setdefault(cid, {"chunk": chunk, "score": 0.0})
        scores[cid]["score"] += 1.0 / (k + rank + 1)

    ranked = sorted(scores.values(), key=lambda x: x["score"], reverse=True)
    return [item["chunk"] for item in ranked[:top_k]]
