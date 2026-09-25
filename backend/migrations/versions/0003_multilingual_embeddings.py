"""multilingual embeddings — change vector dimension from 768 to 1024

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-19 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("TRUNCATE TABLE response_cache")
    op.execute("UPDATE chunks SET embedding = NULL")
    op.execute(
        "ALTER TABLE chunks "
        "ALTER COLUMN embedding TYPE vector(1024)"
    )
    op.execute(
        "ALTER TABLE response_cache "
        "ALTER COLUMN query_embedding TYPE vector(1024)"
    )


def downgrade() -> None:
    op.execute("TRUNCATE TABLE response_cache")
    op.execute(
        "ALTER TABLE response_cache "
        "ALTER COLUMN query_embedding TYPE vector(768)"
    )
    op.execute(
        "ALTER TABLE chunks "
        "ALTER COLUMN embedding TYPE vector(768)"
    )
