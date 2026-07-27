"""add missing fuel log columns

Revision ID: c893001c
Revises: b7829901b
Create Date: 2026-07-21 15:42:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c893001c"
down_revision: Union[str, Sequence[str], None] = "b7829901b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("fuel_logs")]

    if "refuel_latitude" not in columns:
        op.add_column("fuel_logs", sa.Column("refuel_latitude", sa.Float(), nullable=True))
    if "refuel_longitude" not in columns:
        op.add_column("fuel_logs", sa.Column("refuel_longitude", sa.Float(), nullable=True))
    if "fuel_station_name" not in columns:
        op.add_column("fuel_logs", sa.Column("fuel_station_name", sa.String(), nullable=True))
    if "expected_consumption_liters" not in columns:
        op.add_column("fuel_logs", sa.Column("expected_consumption_liters", sa.Float(), nullable=True))
    if "variance_percentage" not in columns:
        op.add_column("fuel_logs", sa.Column("variance_percentage", sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("fuel_logs", "variance_percentage")
    op.drop_column("fuel_logs", "expected_consumption_liters")
    op.drop_column("fuel_logs", "fuel_station_name")
    op.drop_column("fuel_logs", "refuel_longitude")
    op.drop_column("fuel_logs", "refuel_latitude")
