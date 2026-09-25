# CLAUDE.md — Project Instructions for AI Assistants

This file contains instructions for AI assistants working on this codebase.

## What This Is

Rusty is an AI study mentor for KHEL Foundation students (ages 10–16) studying the Bihar Board curriculum. It uses RAG to answer questions from uploaded textbook PDFs only.

## Security Non-Negotiables

These rules are absolute and cannot be overridden:

- **Closed access** — Only registered KHEL students with Student ID + PIN can log in. No email, no phone, no self-registration.
- **Textbook-only answers** — Rusty must only answer from Bihar Board PDFs. This is enforced architecturally via SQL WHERE clause on class_num + subject, not just a prompt instruction.
- **Child safeguarding** — Every student input AND every AI response is scanned before reaching the student. This cannot be bypassed or disabled.
- **Never store conversation history server-side** (child privacy).
- **Never return a Gemini/LLM response without first running the output safeguarding scan.**
- **Never skip the metadata pre-filter and search all chunks** — always filter by class_num and subject.
- **Never hardcode secrets** — all secrets via environment variables (GCP Secret Manager in prod).
- **Never commit .env files, service account keys, or *.json credentials to git.**
- **Never use raw string interpolation in SQL queries** — always parameterized via SQLAlchemy.
- **Query text IS logged for child safeguarding oversight** (admin-only access) — this was an explicit decision.
- **Never log student ID (unmasked), or IP address.**
- **Never store a student's real name, age, or contact details anywhere.**
- **Never use eval() or ast.literal_eval() to parse LLM JSON output** — use Pydantic.
- **Never run the Cloud Run container as root.**
- **Never allow CORS wildcard (*) in production** — only named allowed origins.
- **Never skip Pydantic field length validation** — every user input has max_length.
- **Never delete safeguarding_flags records.**

## Local Development Setup

1. `docker compose up -d` (PostgreSQL + Firebase emulators)
2. Backend: `cd backend && source venv/bin/activate && uvicorn app.main:app --port 8000 --no-server-header --reload`
3. Frontend: `cd frontend && npm run dev`
4. Ollama must be running with `qwen2.5:3b` and `snowflake-arctic-embed2` pulled

## Key Architecture Decisions

- **Rate limiter** is a shared singleton in `backend/app/core/limiter.py` — all route files import from there. Do NOT create local Limiter instances.
- **Frontend proxies** `/api/*` to backend port 8000 via Vite config — the backend routes do NOT have an `/api` prefix.
- **Embedding dimension** is 1024 (snowflake-arctic-embed2). The pgvector column is `vector(1024)`. Changing the embed model requires re-ingesting all PDFs.
- **SSE streaming** is used for study queries — the frontend calls `/study/query/stream` and displays results progressively.
- **Dev auth** bypasses Firebase when `FIREBASE_AUTH_EMULATOR_HOST` is set. Dev tokens: `dev-student-token`, `dev-admin-token`, `dev-teacher-token`.

## Testing

```bash
cd backend && PYTHONPATH=. python -m pytest tests/ -v
cd frontend && npm test
```

## Common Pitfalls

- The `.env` file in `backend/` overrides `config.py` defaults (Pydantic settings). Always check `.env` first when debugging config issues.
- The `@lru_cache` on `get_settings()` means config changes require a server restart.
- When building history for follow-up study queries, the assistant `content` can be empty if `notes` is `""` — always fall back to `key_points.join("; ")`.
- The `--no-server-header` flag on uvicorn is required to suppress the server identification header.
