import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.time_utils import get_now_ist_naive
from app.models.driver import Driver
from app.models.expense import TripExpense
from app.models.trip import Trip
from app.models.user import User
from app.schemas.expense import (
    DriverSettlementSummary,
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdateStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/expenses", tags=["expense-reimbursements"])


def _build_expense_response(exp: TripExpense) -> ExpenseResponse:
    driver_name = exp.driver.name if exp.driver else None
    return ExpenseResponse(
        id=exp.id,
        driver_id=exp.driver_id,
        trip_id=exp.trip_id,
        category=exp.category,
        amount=exp.amount,
        description=exp.description,
        receipt_number=exp.receipt_number,
        status=exp.status,
        reviewed_by=exp.reviewed_by,
        rejection_reason=exp.rejection_reason,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
        driver_name=driver_name,
    )


@router.post(
    "/",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_expense(
    expense_in: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.id == expense_in.driver_id).first()
    if not driver:
        logger.warning(
            f"Create expense failed: Driver {expense_in.driver_id} not found"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found"
        )

    if expense_in.trip_id:
        trip = db.query(Trip).filter(Trip.id == expense_in.trip_id).first()
        if not trip:
            logger.warning(
                f"Create expense failed: Trip {expense_in.trip_id} not found"
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found"
            )

    expense = TripExpense(
        driver_id=expense_in.driver_id,
        trip_id=expense_in.trip_id,
        category=expense_in.category,
        amount=expense_in.amount,
        description=expense_in.description,
        receipt_number=expense_in.receipt_number,
        status="pending",
        created_at=get_now_ist_naive(),
        updated_at=get_now_ist_naive(),
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return _build_expense_response(expense)


@router.get(
    "/",
    response_model=List[ExpenseResponse],
)
def list_expenses(
    driver_id: Optional[int] = Query(None),
    trip_id: Optional[int] = Query(None),
    expense_status: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(TripExpense)
    if driver_id:
        query = query.filter(TripExpense.driver_id == driver_id)
    if trip_id:
        query = query.filter(TripExpense.trip_id == trip_id)
    if expense_status:
        query = query.filter(TripExpense.status == expense_status)
    if category:
        query = query.filter(TripExpense.category == category)

    expenses = query.order_by(TripExpense.created_at.desc()).all()
    return [_build_expense_response(exp) for exp in expenses]


@router.get(
    "/{expense_id}",
    response_model=ExpenseResponse,
)
def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = db.query(TripExpense).filter(TripExpense.id == expense_id).first()
    if not expense:
        logger.warning(f"Get expense failed: Expense {expense_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found"
        )
    return _build_expense_response(expense)


@router.patch(
    "/{expense_id}/status",
    response_model=ExpenseResponse,
)
def update_expense_status(
    expense_id: int,
    status_update: ExpenseUpdateStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = db.query(TripExpense).filter(TripExpense.id == expense_id).first()
    if not expense:
        logger.warning(f"Update expense status failed: Expense {expense_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found"
        )

    valid_statuses = ["pending", "approved", "rejected", "settled"]
    if status_update.status not in valid_statuses:
        logger.warning(
            f"Update expense status failed: Invalid status '{status_update.status}'"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of {valid_statuses}",
        )

    expense.status = status_update.status
    expense.reviewed_by = status_update.reviewed_by or getattr(
        current_user, "username", "dispatcher"
    )
    expense.rejection_reason = status_update.rejection_reason
    expense.updated_at = get_now_ist_naive()

    db.commit()
    db.refresh(expense)
    return _build_expense_response(expense)


@router.get(
    "/settlement/{driver_id}",
    response_model=DriverSettlementSummary,
)
def get_driver_settlement(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        logger.warning(f"Get driver settlement failed: Driver {driver_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found"
        )

    completed_trips = (
        db.query(Trip)
        .filter(Trip.driver_id == driver_id, Trip.status == "completed")
        .all()
    )
    total_trips_completed = len(completed_trips)
    base_trip_earnings = sum(
        t.estimated_fare for t in completed_trips if t.estimated_fare
    )

    all_expenses = (
        db.query(TripExpense).filter(TripExpense.driver_id == driver_id).all()
    )

    total_claimed = sum(e.amount for e in all_expenses)
    approved_amount = sum(e.amount for e in all_expenses if e.status == "approved")
    pending_amount = sum(e.amount for e in all_expenses if e.status == "pending")
    rejected_amount = sum(e.amount for e in all_expenses if e.status == "rejected")
    settled_amount = sum(e.amount for e in all_expenses if e.status == "settled")

    net_payout = base_trip_earnings + approved_amount + settled_amount

    return DriverSettlementSummary(
        driver_id=driver.id,
        driver_name=driver.name,
        driver_phone=driver.phone,
        total_trips_completed=total_trips_completed,
        base_trip_earnings=round(base_trip_earnings, 2),
        total_claimed_expenses=round(total_claimed, 2),
        approved_expenses_amount=round(approved_amount, 2),
        pending_expenses_amount=round(pending_amount, 2),
        rejected_expenses_amount=round(rejected_amount, 2),
        settled_expenses_amount=round(settled_amount, 2),
        net_settlement_payout=round(net_payout, 2),
        expenses=[_build_expense_response(e) for e in all_expenses],
    )


@router.post(
    "/settlement/{driver_id}/settle",
    response_model=DriverSettlementSummary,
)
def finalize_driver_settlement(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        logger.warning(
            f"Finalize driver settlement failed: Driver {driver_id} not found"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found"
        )
    logger.info(f"Finalizing driver settlement for driver {driver_id}")

    # Mark all approved expenses as settled
    approved_expenses = (
        db.query(TripExpense)
        .filter(TripExpense.driver_id == driver_id, TripExpense.status == "approved")
        .all()
    )
    now = get_now_ist_naive()
    for exp in approved_expenses:
        exp.status = "settled"
        exp.updated_at = now

    # Mark completed trip payout status as settled
    completed_trips = (
        db.query(Trip)
        .filter(Trip.driver_id == driver_id, Trip.status == "completed")
        .all()
    )
    for trip in completed_trips:
        trip.payout_status = "settled"

    db.commit()

    return get_driver_settlement(driver_id, db=db, current_user=current_user)
