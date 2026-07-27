"""add trip expenses table

Revision ID: f9821901a
Revises: e68dccef6ee8
Create Date: 2026-07-21 12:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f9821901a"
down_revision: Union[str, Sequence[str], None] = "e68dccef6ee8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "trip_expenses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("driver_id", sa.Integer(), nullable=False),
        sa.Column("trip_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("receipt_number", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("reviewed_by", sa.String(), nullable=True),
        sa.Column("rejection_reason", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_trip_expenses_id"), "trip_expenses", ["id"], unique=False)
    op.create_index(
        op.f("ix_trip_expenses_driver_id"), "trip_expenses", ["driver_id"], unique=False
    )
    op.create_index(
        op.f("ix_trip_expenses_trip_id"), "trip_expenses", ["trip_id"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_trip_expenses_trip_id"), table_name="trip_expenses")
    op.drop_index(op.f("ix_trip_expenses_driver_id"), table_name="trip_expenses")
    op.drop_index(op.f("ix_trip_expenses_id"), table_name="trip_expenses")
    op.drop_table("trip_expenses")
