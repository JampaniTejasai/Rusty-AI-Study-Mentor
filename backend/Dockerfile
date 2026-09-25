# Multi-stage build — keeps final image minimal (no build tools, no pip cache)
FROM python:3.11-slim AS builder

WORKDIR /build

# Install deps into a prefix we can copy cleanly
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Final stage ──────────────────────────────────────────────────────────────
FROM python:3.11-slim

# Non-root user — Cloud Run security requirement
RUN useradd --no-create-home --shell /bin/false rusty

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY alembic.ini .
COPY safeguarding/ ./safeguarding/

# Ensure rag package is importable
COPY ../rag/ ./rag/ 2>/dev/null || true

# No root at runtime
USER rusty

EXPOSE 8080

CMD ["gunicorn", "app.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "2", \
     "--bind", "0.0.0.0:8080", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
