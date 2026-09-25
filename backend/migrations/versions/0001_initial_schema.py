"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-01-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "tests",
        sa.Column("test_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("created_by", sa.Text, nullable=False),
        sa.Column("centre_id", sa.Text, nullable=False),
        sa.Column("class_num", sa.Integer, nullable=False),
        sa.Column("subject", sa.Text, nullable=False),
        sa.Column("chapter", sa.Text, nullable=True),
        sa.Column("total_marks", sa.Integer, server_default="10"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), server_default=sa.text("NOW() + INTERVAL '1 year'")),
        sa.Column("is_active", sa.Boolean, server_default="true"),
    )

    op.create_table(
        "questions",
        sa.Column("question_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("test_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tests.test_id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_no", sa.Integer, nullable=False),
        sa.Column("question_text", sa.Text, nullable=False),
        sa.Column("option_a", sa.Text, nullable=False),
        sa.Column("option_b", sa.Text, nullable=False),
        sa.Column("option_c", sa.Text, nullable=False),
        sa.Column("option_d", sa.Text, nullable=False),
        sa.Column("correct_option", sa.Text, nullable=False),
        sa.Column("explanation", sa.Text, nullable=True),
        sa.Column("question_type", sa.Text, server_default="'mcq'"),
        sa.Column("math_type", sa.Text, nullable=True),
    )

    op.create_table(
        "test_attempts",
        sa.Column("attempt_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("test_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tests.test_id"), nullable=False),
        sa.Column("student_id", sa.Text, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("score", sa.Integer, nullable=True),
        sa.Column("time_taken_s", sa.Integer, nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("test_id", "student_id", name="uq_attempt_student_test"),
    )

    op.create_table(
        "attempt_answers",
        sa.Column("answer_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("attempt_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("test_attempts.attempt_id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("questions.question_id"), nullable=False),
        sa.Column("student_answer", sa.Text, nullable=True),
        sa.Column("is_correct", sa.Boolean, nullable=True),
        sa.Column("answered_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    op.create_table(
        "quiz_scores",
        sa.Column("score_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("student_id", sa.Text, nullable=False),
        sa.Column("class_num", sa.Integer, nullable=False),
        sa.Column("subject", sa.Text, nullable=False),
        sa.Column("chapter", sa.Text, nullable=True),
        sa.Column("score", sa.Integer, nullable=False),
        sa.Column("total", sa.Integer, server_default="10"),
        sa.Column("weak_topics", postgresql.ARRAY(sa.Text), nullable=True),
        sa.Column("math_type_breakdown", postgresql.JSONB, nullable=True),
        sa.Column("taken_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), server_default=sa.text("NOW() + INTERVAL '1 year'")),
    )

    op.create_table(
        "chunks",
        sa.Column("chunk_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("class_num", sa.Integer, nullable=False),
        sa.Column("subject", sa.Text, nullable=False),
        sa.Column("chapter", sa.Text, nullable=True),
        sa.Column("section_type", sa.Text, nullable=False),
        sa.Column("math_type", sa.Text, nullable=True),
        sa.Column("contains_formula", sa.Boolean, server_default="false"),
        sa.Column("latex_equations", postgresql.ARRAY(sa.Text), nullable=True),
        sa.Column("diagram_image_path", sa.Text, nullable=True),
        sa.Column("text_content", sa.Text, nullable=False),
        sa.Column("embedding", sa.Text, nullable=True),  # placeholder; replaced below
        sa.Column("source_pdf", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    # Replace placeholder with real vector column
    op.execute("ALTER TABLE chunks DROP COLUMN embedding")
    op.execute("ALTER TABLE chunks ADD COLUMN embedding vector(768)")

    # Indexes
    op.create_index("ix_chunks_class_subject_chapter", "chunks", ["class_num", "subject", "chapter"])
    op.execute(
        "CREATE INDEX ix_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
    op.execute(
        "CREATE INDEX ix_chunks_fts ON chunks USING GIN (to_tsvector('english', text_content))"
    )
    op.create_index("ix_test_attempts_student_id", "test_attempts", ["student_id"])
    op.create_index("ix_quiz_scores_student_class_subject", "quiz_scores", ["student_id", "class_num", "subject"])


def downgrade() -> None:
    op.drop_table("chunks")
    op.drop_table("quiz_scores")
    op.drop_table("attempt_answers")
    op.drop_table("test_attempts")
    op.drop_table("questions")
    op.drop_table("tests")
