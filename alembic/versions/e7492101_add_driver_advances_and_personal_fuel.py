"""add_driver_advances_and_personal_fuel

Revision ID: e7492101
Revises: c893001c
Create Date: 2026-07-21 11:12:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e7492101'
down_revision: Union[str, None] = 'c893001c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add advance_payment and personal_fuel_expense to driver_payments
    op.add_column('driver_payments', sa.Column('advance_payment', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('driver_payments', sa.Column('personal_fuel_expense', sa.Float(), nullable=False, server_default='0.0'))

    # Add is_personal to fuel_logs
    op.add_column('fuel_logs', sa.Column('is_personal', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('fuel_logs', 'is_personal')
    op.drop_column('driver_payments', 'personal_fuel_expense')
    op.drop_column('driver_payments', 'advance_payment')
