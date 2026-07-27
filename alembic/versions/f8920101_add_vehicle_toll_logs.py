"""add_vehicle_toll_logs

Revision ID: f8920101
Revises: e7492101
Create Date: 2026-07-21 11:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f8920101'
down_revision: Union[str, None] = 'e7492101'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'vehicle_toll_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('vehicle_id', sa.Integer(), nullable=False),
        sa.Column('driver_id', sa.Integer(), nullable=True),
        sa.Column('trip_id', sa.Integer(), nullable=True),
        sa.Column('toll_plaza_name', sa.String(), nullable=False),
        sa.Column('highway_name', sa.String(), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('payment_method', sa.String(), nullable=False, server_default='FASTag'),
        sa.Column('transaction_reference', sa.String(), nullable=True),
        sa.Column('toll_date', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['driver_id'], ['drivers.id'], ),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vehicle_toll_logs_id'), 'vehicle_toll_logs', ['id'], unique=False)
    op.create_index(op.f('ix_vehicle_toll_logs_vehicle_id'), 'vehicle_toll_logs', ['vehicle_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_vehicle_toll_logs_vehicle_id'), table_name='vehicle_toll_logs')
    op.drop_index(op.f('ix_vehicle_toll_logs_id'), table_name='vehicle_toll_logs')
    op.drop_table('vehicle_toll_logs')
