"""Script to truncate data in all tables and seed fresh test data, preserving schema/tables."""

import os
import sys

# Add current directory to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.core.security import hash_password  # noqa: E402
from app.db import Base, SessionLocal  # noqa: E402
from app.models.driver import Driver  # noqa: E402
from app.models.fuel import FuelLog  # noqa: E402
from app.models.fuel_theft import FuelTheftAlert  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.vehicle import Vehicle  # noqa: E402
from seed_data import seed_database  # noqa: E402


def clear_and_seed_data():
    db = SessionLocal()
    print("[*] Clearing all existing data rows from database tables...")
    try:
        # Delete from tables in reverse dependency order to satisfy foreign key constraints
        for table in reversed(Base.metadata.sorted_tables):
            print(f"  - Deleting data from table: {table.name}")
            db.execute(table.delete())
        db.commit()
        print("[+] Successfully cleared all table rows.")
    except Exception as e:
        db.rollback()
        print(f"[-] Error clearing data: {e}")
        db.close()
        return

    # Seed operational data (vehicles, drivers, trips, fuel, maintenance, expenses)
    print("[*] Seeding fresh operational test data...")
    try:
        seed_database()
    except Exception as e:
        print(f"[-] Error seeding operational database: {e}")
        db.close()
        return

    # Seed default user logins
    print("[*] Seeding default test user logins...")
    try:
        default_users = [
            {
                "username": "designer",
                "email": "designer@example.com",
                "role": "dispatcher",
            },
            {"username": "rohit", "email": "rohit@example.com", "role": "admin"},
            {"username": "me", "email": "me@example.com", "role": "admin"},
            {"username": "Ajay", "email": "ajay@example.com", "role": "dispatcher"},
        ]

        for udata in default_users:
            user = User(
                username=udata["username"],
                email=udata["email"],
                hashed_password=hash_password("password"),
                role=udata["role"],
                is_active=True,
            )
            db.add(user)
        db.commit()
        print(
            "[+] Default users seeded successfully: designer, rohit, me, Ajay (all with password: 'password')"
        )
    except Exception as e:
        db.rollback()
        print(f"[-] Error seeding users: {e}")

    # Seed fuel theft alerts directly for UI testing
    print("[*] Seeding fuel theft alerts for audit validation...")
    try:
        driver1 = db.query(Driver).first()
        vehicle1 = db.query(Vehicle).first()
        fuel_log1 = db.query(FuelLog).first()

        if driver1 and vehicle1 and fuel_log1:
            alert1 = FuelTheftAlert(
                driver_id=driver1.id,
                vehicle_id=vehicle1.id,
                fuel_log_id=fuel_log1.id,
                alert_type="abnormal_consumption_spike",
                severity="critical",
                detected_loss_liters=25.5,
                estimated_financial_loss=2422.5,
                description="Abnormal consumption spike. Vehicle efficiency dropped to 2.1 km/L (expected 4.0 km/L). Estimated loss: 25.5 L.",
                status="unresolved",
            )
            db.add(alert1)

        driver2 = db.query(Driver).offset(1).first()
        vehicle2 = db.query(Vehicle).offset(1).first()
        fuel_log2 = db.query(FuelLog).offset(1).first()

        if driver2 and vehicle2 and fuel_log2:
            alert2 = FuelTheftAlert(
                driver_id=driver2.id,
                vehicle_id=vehicle2.id,
                fuel_log_id=fuel_log2.id,
                alert_type="offsite_refuel_fraud",
                severity="high",
                detected_loss_liters=42.0,
                estimated_financial_loss=3990.0,
                description="Offsite refuel location mismatch. Card swiped at Shell Highway JNPT but vehicle GPS coordinates placed it 3.4 km away.",
                status="unresolved",
            )
            db.add(alert2)

        db.commit()
        print("[+] Seeded 2 fuel theft alerts (1 critical, 1 high).")
    except Exception as e:
        db.rollback()
        print(f"[-] Error seeding fuel theft alerts: {e}")
    finally:
        db.close()
        print("[SUCCESS] Database data reset and seeding completed!")


if __name__ == "__main__":
    clear_and_seed_data()
