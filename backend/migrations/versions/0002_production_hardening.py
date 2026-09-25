"""production hardening — response cache, prompt versioning, new trace columns

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-19 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- rag_traces: add columns that were previously ALTER TABLE'd + new ones --
    op.add_column("rag_traces", sa.Column("query_text", sa.Text, nullable=True))
    op.add_column("rag_traces", sa.Column("retrieved_chunks_preview", postgresql.ARRAY(sa.Text), nullable=True))
    op.add_column("rag_traces", sa.Column("llm_response_preview", sa.Text, nullable=True))
    op.add_column("rag_traces", sa.Column("prompt_version", sa.Text, nullable=True))
    op.add_column("rag_traces", sa.Column("cache_hit", sa.Boolean, nullable=False, server_default="false"))

    # -- response_cache table --
    op.create_table(
        "response_cache",
        sa.Column("cache_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("class_num", sa.Integer, nullable=False),
        sa.Column("subject", sa.Text, nullable=False),
        sa.Column("chapter", sa.Text, nullable=True),
        sa.Column("medium", sa.Text, nullable=False, server_default="en"),
        sa.Column("query_text", sa.Text, nullable=False),
        sa.Column("query_embedding", Vector(768), nullable=False),
        sa.Column("response_json", postgresql.JSONB, nullable=False),
        sa.Column("prompt_version", sa.Text, nullable=False),
        sa.Column("hit_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_hit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ttl_hours", sa.Integer, nullable=False, server_default="168"),
    )
    op.create_index("ix_response_cache_lookup", "response_cache", ["class_num", "subject", "chapter"])
    op.create_index("ix_response_cache_created", "response_cache", ["created_at"])


def downgrade() -> None:
    op.drop_table("response_cache")
    op.drop_column("rag_traces", "cache_hit")
    op.drop_column("rag_traces", "prompt_version")
    op.drop_column("rag_traces", "llm_response_preview")
    op.drop_column("rag_traces", "retrieved_chunks_preview")
    op.drop_column("rag_traces", "query_text")
