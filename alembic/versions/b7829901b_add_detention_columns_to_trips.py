"""add detention columns to trips table

Revision ID: b7829901b
Revises: f9821901a
Create Date: 2026-07-21 12:50:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7829901b"
down_revision: Union[str, Sequence[str], None] = ("5dcb7ef38d63", "f9821901a")

branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("trips")]

    if "detention_start_time" not in columns:
        op.add_column("trips", sa.Column("detention_start_time", sa.DateTime(), nullable=True))
    if "detention_end_time" not in columns:
        op.add_column("trips", sa.Column("detention_end_time", sa.DateTime(), nullable=True))
    if "detention_grace_minutes" not in columns:
        op.add_column(
            "trips",
            sa.Column(
                "detention_grace_minutes",
                sa.Integer(),
                nullable=True,
                server_default="120",
            ),
        )
    if "detention_hourly_rate" not in columns:
        op.add_column(
            "trips",
            sa.Column(
                "detention_hourly_rate",
                sa.Float(),
                nullable=True,
                server_default="500.0",
            ),
        )
    if "detention_billable_hours" not in columns:
        op.add_column(
            "trips",
            sa.Column(
                "detention_billable_hours",
                sa.Float(),
                nullable=True,
                server_default="0.0",
            ),
        )
    if "detention_charge" not in columns:
        op.add_column(
            "trips",
            sa.Column(
                "detention_charge",
                sa.Float(),
                nullable=True,
                server_default="0.0",
            ),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("trips", "detention_charge")
    op.drop_column("trips", "detention_billable_hours")
    op.drop_column("trips", "detention_hourly_rate")
    op.drop_column("trips", "detention_grace_minutes")
    op.drop_column("trips", "detention_end_time")
    op.drop_column("trips", "detention_start_time")
