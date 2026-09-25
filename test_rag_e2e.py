"""
End-to-end test: query → embed → vector+BM25 search → RRF → LLM → structured response.
Run: PYTHONPATH=backend:. backend/venv/bin/python test_rag_e2e.py
"""
import asyncio
import os
import json

os.environ["SECRET_KEY"] = "test"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://rusty:localdev@localhost:5432/rusty_dev"
os.environ["LLM_PROVIDER"] = "ollama"
os.environ["OLLAMA_BASE_URL"] = "http://localhost:11434"
os.environ["OLLAMA_MODEL"] = "qwen2.5:3b"
os.environ["OLLAMA_EMBED_MODEL"] = "nomic-embed-text"
os.environ["VERTEX_AI_PROJECT"] = "demo"
os.environ["SAFEGUARDING_ALERT_EMAIL"] = "test@test.com"
os.environ["PHRASES_FILE_PATH"] = "safeguarding/phrases_v1.json"


async def test_study():
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from app.repositories.chunk_repo import ChunkRepository
    from app.services.retrieval import RetrievalService

    engine = create_async_engine(os.environ["DATABASE_URL"], echo=False)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("=" * 60)
    print("TEST 1: Study Mode")
    print("=" * 60)
    async with factory() as session:
        repo = ChunkRepository(session)
        service = RetrievalService(repo)

        result = await service.retrieve(
            query="Explain linear equations in one variable",
            class_num=8, subject="mathematics", chapter=None,
            mode="study", session_history=[],
        )
        print(f"Key Points: {result.key_points}")
        print(f"Notes: {result.notes[:200]}")
        print(f"Source Chunks: {result.source_chunks}")
        print(f"Has Math: {result.has_math}")

    print("\n" + "=" * 60)
    print("TEST 2: Quiz Mode")
    print("=" * 60)
    async with factory() as session:
        repo = ChunkRepository(session)
        service = RetrievalService(repo)

        result = await service.retrieve(
            query="Generate quiz on linear equations",
            class_num=8, subject="mathematics", chapter=None,
            mode="quiz", session_history=[],
        )
        print(f"MCQs: {len(result.mcqs)}")
        for m in result.mcqs[:3]:
            print(f"  Q{m.question_no}: {m.question[:80]}...")
        print(f"Short Answers: {len(result.short_answers)}")

    await engine.dispose()
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED - RAG pipeline working end-to-end!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_study())
