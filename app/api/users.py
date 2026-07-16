from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import hash_password
from app.db import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hash_password(user.password),
        role=user.role,
    )
    db.add(db_user)
    try:
        db.flush()

        if db_user.role == "driver":
            from app.models.driver import Driver, DriverAvailabilityHistory

            phone_num = user.phone or f"TEMP-{db_user.id}"

            existing_driver = db.query(Driver).filter(Driver.phone == phone_num).first()
            if existing_driver:
                raise HTTPException(
                    status_code=400, detail="Driver with this phone already exists"
                )

            db_driver = Driver(
                name=db_user.username,
                phone=phone_num,
                user_id=db_user.id,
                status="available",
            )
            db.add(db_driver)
            db.flush()

            history_entry = DriverAvailabilityHistory(
                driver_id=db_driver.id,
                status=db_driver.status,
                note="driver created via signup",
            )
            db.add(history_entry)

        db.commit()
        db.refresh(db_user)
        return db_user
    except IntegrityError as e:
        db.rollback()
        err_msg = str(e).lower()
        if "phone" in err_msg:
            raise HTTPException(
                status_code=400, detail="Driver with this phone already exists"
            )
        raise HTTPException(
            status_code=400, detail="Username or email already registered"
        )
    except HTTPException:
        db.rollback()
        raise


@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_user_me(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_update.username is not None:
        current_user.username = user_update.username
    if user_update.email is not None:
        current_user.email = user_update.email
    if user_update.password is not None:
        current_user.hashed_password = hash_password(user_update.password)

    try:
        db.commit()
        db.refresh(current_user)
        return current_user
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="Username or email already registered"
        )
