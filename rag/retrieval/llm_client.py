"""
LLM client abstraction — routes to Ollama (local dev) or Vertex AI (production).
Output is always validated by Pydantic before use — never eval()d.
"""
import json
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings


@dataclass
class LLMResult:
    data: dict
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: float
    json_valid: bool


async def generate_structured(
    messages: list[dict],
    system_instruction: str,
    response_schema: dict,
    max_output_tokens: int = 2048,
) -> LLMResult:
    settings = get_settings()
    if settings.llm_provider == "ollama":
        return await _ollama_generate(messages, system_instruction, response_schema, max_output_tokens)
    return await _vertex_generate(messages, system_instruction, response_schema, max_output_tokens)


async def _ollama_generate(
    messages: list[dict],
    system_instruction: str,
    response_schema: dict,
    max_output_tokens: int,
) -> LLMResult:
    settings = get_settings()

    ollama_messages = [{"role": "system", "content": system_instruction}]
    for m in messages:
        role = m["role"]
        content = " ".join(p["text"] for p in m["parts"])
        if role == "model":
            role = "assistant"
        ollama_messages.append({"role": role, "content": content})

    payload = {
        "model": settings.ollama_model,
        "messages": ollama_messages,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.1,
            "top_p": 0.9,
            "repeat_penalty": 1.1,
            "num_predict": max_output_tokens,
        },
    }

    start = time.perf_counter()
    async with httpx.AsyncClient(timeout=300.0) as client:
        resp = await client.post(f"{settings.ollama_base_url}/api/chat", json=payload)
        resp.raise_for_status()
    latency_ms = (time.perf_counter() - start) * 1000

    body = resp.json()
    raw_text = body["message"]["content"]

    prompt_tokens = body.get("prompt_eval_count", 0)
    completion_tokens = body.get("eval_count", 0)

    json_valid = True
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        json_valid = False
        raise ValueError(f"LLM returned invalid JSON: {exc}\nRaw: {raw_text[:500]}") from exc

    return LLMResult(
        data=data,
        provider="ollama",
        model=settings.ollama_model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        latency_ms=round(latency_ms, 1),
        json_valid=json_valid,
    )


async def _vertex_generate(
    messages: list[dict],
    system_instruction: str,
    response_schema: dict,
    max_output_tokens: int,
) -> LLMResult:
    import vertexai
    from vertexai.generative_models import GenerativeModel, GenerationConfig, Part, Content

    settings = get_settings()
    vertexai.init(project=settings.vertex_ai_project, location=settings.vertex_ai_location)
    model = GenerativeModel(settings.gemini_model)

    config = GenerationConfig(
        response_mime_type="application/json",
        response_schema=response_schema,
        max_output_tokens=max_output_tokens,
        temperature=0.1,
        top_p=0.9,
    )

    contents = [
        Content(role=m["role"], parts=[Part.from_text(p["text"]) for p in m["parts"]])
        for m in messages
    ]

    start = time.perf_counter()
    response = await model.generate_content_async(
        contents,
        generation_config=config,
        system_instruction=system_instruction,
    )
    latency_ms = (time.perf_counter() - start) * 1000

    prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", 0)
    completion_tokens = getattr(response.usage_metadata, "candidates_token_count", 0)

    raw = response.text
    json_valid = True
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        json_valid = False
        raise ValueError(f"Gemini returned invalid JSON: {exc}") from exc

    return LLMResult(
        data=data,
        provider="vertex",
        model=settings.gemini_model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        latency_ms=round(latency_ms, 1),
        json_valid=json_valid,
    )


async def embed_text(text: str) -> list[float]:
    settings = get_settings()
    if settings.llm_provider == "ollama":
        return await _ollama_embed(text)
    return await _vertex_embed(text)


async def embed_batch(texts: list[str]) -> list[list[float]]:
    settings = get_settings()
    if settings.llm_provider == "ollama":
        return [await _ollama_embed(t) for t in texts]
    return await _vertex_embed_batch(texts)


async def _ollama_embed(text: str) -> list[float]:
    settings = get_settings()
    payload = {
        "model": settings.ollama_embed_model,
        "prompt": text,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{settings.ollama_base_url}/api/embeddings", json=payload)
        resp.raise_for_status()
    return resp.json()["embedding"]


async def _vertex_embed(text: str) -> list[float]:
    import asyncio
    import vertexai
    from vertexai.language_models import TextEmbeddingModel

    settings = get_settings()
    vertexai.init(project=settings.vertex_ai_project, location=settings.vertex_ai_location)
    model = TextEmbeddingModel.from_pretrained(settings.vertex_embed_model)
    loop = asyncio.get_event_loop()
    embeddings = await loop.run_in_executor(
        None,
        lambda: model.get_embeddings([text], output_dimensionality=settings.embed_dim),
    )
    return embeddings[0].values


async def _vertex_embed_batch(texts: list[str]) -> list[list[float]]:
    import asyncio
    import vertexai
    from vertexai.language_models import TextEmbeddingModel

    settings = get_settings()
    vertexai.init(project=settings.vertex_ai_project, location=settings.vertex_ai_location)
    model = TextEmbeddingModel.from_pretrained(settings.vertex_embed_model)
    loop = asyncio.get_event_loop()

    results = []
    for i in range(0, len(texts), 50):
        batch = texts[i:i + 50]
        embeddings = await loop.run_in_executor(
            None,
            lambda b=batch: model.get_embeddings(b, output_dimensionality=settings.embed_dim),
        )
        results.extend([e.values for e in embeddings])
    return results
