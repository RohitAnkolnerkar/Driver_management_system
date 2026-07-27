from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ExpenseCreate(BaseModel):
    driver_id: int
    trip_id: Optional[int] = None
    category: str = Field(
        ...,
        description="Expense category: toll, food_allowance, lodging, fuel, etc.",
    )
    amount: float = Field(..., gt=0, description="Expense amount in currency")
    description: Optional[str] = None
    receipt_number: Optional[str] = None


class ExpenseUpdateStatus(BaseModel):
    status: str = Field(..., description="Target status: approved or rejected")
    rejection_reason: Optional[str] = None
    reviewed_by: Optional[str] = "dispatcher"


class ExpenseResponse(BaseModel):
    id: int
    driver_id: int
    trip_id: Optional[int] = None
    category: str
    amount: float
    description: Optional[str] = None
    receipt_number: Optional[str] = None
    status: str
    reviewed_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    driver_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DriverSettlementSummary(BaseModel):
    driver_id: int
    driver_name: str
    driver_phone: Optional[str] = None
    total_trips_completed: int
    base_trip_earnings: float
    total_claimed_expenses: float
    approved_expenses_amount: float
    pending_expenses_amount: float
    rejected_expenses_amount: float
    settled_expenses_amount: float
    net_settlement_payout: float
    expenses: List[ExpenseResponse]

    model_config = ConfigDict(from_attributes=True)
