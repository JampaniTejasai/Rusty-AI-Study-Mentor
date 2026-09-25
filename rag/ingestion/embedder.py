"""
Batch embedding for ingestion — uses Ollama (local) or Vertex AI (prod).
Called once during ingestion, not at query time.
Default model: snowflake-arctic-embed2 (1024 dim, multilingual with Hindi support).
"""
import httpx


async def embed_batch_ollama(
    texts: list[str],
    base_url: str = "http://localhost:11434",
    model: str = "snowflake-arctic-embed2",
) -> list[list[float]]:
    results = []
    async with httpx.AsyncClient(timeout=120.0) as client:
        for text in texts:
            resp = await client.post(
                f"{base_url}/api/embeddings",
                json={"model": model, "prompt": text},
            )
            resp.raise_for_status()
            results.append(resp.json()["embedding"])
    return results
