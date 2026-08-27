"""Seed script to populate database with realistic test data:
- 12 Vehicles (Mini Van, Cargo Truck, Heavy Hauler, Container Trailer)
- 12 Drivers with valid E.164 phone numbers and Indian DL numbers
- 15 Trips across various statuses (created, assigned, started, completed)
- Fuel Logs & Theft Alerts
- Maintenance Logs
- Pre-Trip Safety Inspections
- Driver Expenses & Allowance Claims
"""

from datetime import timedelta

from app.core.time_utils import get_now_ist_naive
from app.db import SessionLocal
from app.models.driver import Driver
from app.models.expense import TripExpense
from app.models.fuel import FuelLog
from app.models.trip import Trip
from app.models.vehicle import MaintenanceLog, Vehicle


def seed_database():
    db = SessionLocal()
    print("[+] Starting database seeding...")

    try:
        # 1. Create Vehicles
        vehicles_data = [
            {
                "make": "Tata",
                "model": "Ace Gold",
                "year": 2022,
                "license_plate": "MH-12-AV-1001",
                "odometer_km": 24500.0,
                "status": "active",
                "fasttag_balance": 1500.0,
            },
            {
                "make": "Mahindra",
                "model": "Supro Maxitruck",
                "year": 2023,
                "license_plate": "MH-14-BW-1002",
                "odometer_km": 18200.0,
                "status": "active",
                "fasttag_balance": 150.0,
            },
            {
                "make": "Eicher",
                "model": "Pro 2049",
                "year": 2021,
                "license_plate": "MH-12-CT-2001",
                "odometer_km": 54100.0,
                "status": "active",
                "fasttag_balance": 450.0,
            },
            {
                "make": "Ashok Leyland",
                "model": "Partner Super",
                "year": 2022,
                "license_plate": "MH-04-DX-2002",
                "odometer_km": 42000.0,
                "status": "active",
                "fasttag_balance": 1800.0,
            },
            {
                "make": "Tata",
                "model": "407 Gold SF",
                "year": 2020,
                "license_plate": "DL-01-AB-2003",
                "odometer_km": 89000.0,
                "status": "active",
                "fasttag_balance": 2400.0,
            },
            {
                "make": "BharatBenz",
                "model": "1215R Freight Truck",
                "year": 2023,
                "license_plate": "GJ-01-EE-2004",
                "odometer_km": 31500.0,
                "status": "active",
                "fasttag_balance": 120.0,
            },
            {
                "make": "Ashok Leyland",
                "model": "2820 Heavy Hauler",
                "year": 2021,
                "license_plate": "MH-12-HH-3001",
                "odometer_km": 112000.0,
                "status": "active",
                "fasttag_balance": 3500.0,
            },
            {
                "make": "Tata",
                "model": "Prima 2830.K",
                "year": 2022,
                "license_plate": "KA-01-FF-3002",
                "odometer_km": 67800.0,
                "status": "active",
                "fasttag_balance": 4200.0,
            },
            {
                "make": "Eicher",
                "model": "Pro 6035",
                "year": 2023,
                "license_plate": "TS-07-GG-3003",
                "odometer_km": 29400.0,
                "status": "active",
                "fasttag_balance": 3100.0,
            },
            {
                "make": "Volvo",
                "model": "FH16 Container Trailer",
                "year": 2022,
                "license_plate": "MH-12-TR-4001",
                "odometer_km": 145000.0,
                "status": "active",
                "fasttag_balance": 5000.0,
            },
            {
                "make": "Scania",
                "model": "R580 V8 Trailer",
                "year": 2021,
                "license_plate": "HR-26-HH-4002",
                "odometer_km": 168000.0,
                "status": "maintenance",
                "fasttag_balance": 250.0,
            },
            {
                "make": "MAN",
                "model": "TGM 18.290 Multi-Axle",
                "year": 2023,
                "license_plate": "WB-02-JJ-4003",
                "odometer_km": 38200.0,
                "status": "active",
                "fasttag_balance": 2100.0,
            },
        ]

        existing_plates = {
            v.license_plate for v in db.query(Vehicle.license_plate).all()
        }
        created_vehicles = []
        for vdata in vehicles_data:
            if vdata["license_plate"] not in existing_plates:
                v = Vehicle(**vdata)
                db.add(v)
                db.flush()
                created_vehicles.append(v)
            else:
                v = (
                    db.query(Vehicle)
                    .filter(Vehicle.license_plate == vdata["license_plate"])
                    .first()
                )
                created_vehicles.append(v)

        db.commit()
        print(f"[+] Created/Verified {len(created_vehicles)} vehicles.")

        # 2. Create Drivers
        drivers_data = [
            {
                "name": "Ramesh Kumar",
                "phone": "+919876543201",
                "license_number": "MH-12-2020-0001001",
                "status": "on_trip",
                "base_salary": 25000.0,
                "vehicle_type": "mini_van",
            },
            {
                "name": "Suresh Singh",
                "phone": "+919876543202",
                "license_number": "MH-14-2019-0001002",
                "status": "available",
                "base_salary": 26000.0,
                "vehicle_type": "mini_van",
            },
            {
                "name": "Amit Patel",
                "phone": "+919876543203",
                "license_number": "GJ-01-2020-0001003",
                "status": "on_trip",
                "base_salary": 28000.0,
                "vehicle_type": "cargo_truck",
            },
            {
                "name": "Vikram Sharma",
                "phone": "+919876543204",
                "license_number": "DL-04-2017-0001004",
                "status": "on_trip",
                "base_salary": 30000.0,
                "vehicle_type": "cargo_truck",
            },
            {
                "name": "Anil Kapoor",
                "phone": "+919876543205",
                "license_number": "KA-01-2016-0001005",
                "status": "available",
                "base_salary": 27000.0,
                "vehicle_type": "cargo_truck",
            },
            {
                "name": "Rajesh Verma",
                "phone": "+919876543206",
                "license_number": "MH-12-2018-0001006",
                "status": "available",
                "base_salary": 29000.0,
                "vehicle_type": "cargo_truck",
            },
            {
                "name": "Dharmendra Yadav",
                "phone": "+919876543207",
                "license_number": "UP-32-2021-0001007",
                "status": "on_trip",
                "base_salary": 32000.0,
                "vehicle_type": "heavy_hauler",
            },
            {
                "name": "Manoj Tiwari",
                "phone": "+919876543208",
                "license_number": "HR-26-2020-0001008",
                "status": "available",
                "base_salary": 31000.0,
                "vehicle_type": "heavy_hauler",
            },
            {
                "name": "Arvind Swamy",
                "phone": "+919876543209",
                "license_number": "TN-01-2019-0001009",
                "status": "available",
                "base_salary": 33000.0,
                "vehicle_type": "heavy_hauler",
            },
            {
                "name": "Sunil Shetty",
                "phone": "+919876543210",
                "license_number": "MH-02-2015-0001010",
                "status": "on_trip",
                "base_salary": 36000.0,
                "vehicle_type": "container_trailer",
            },
            {
                "name": "Ajay Devgn",
                "phone": "+919876543211",
                "license_number": "DL-03-2018-0001011",
                "status": "inactive",
                "base_salary": 35000.0,
                "vehicle_type": "container_trailer",
            },
            {
                "name": "Sanjay Dutt",
                "phone": "+919876543212",
                "license_number": "MH-12-2017-0001012",
                "status": "available",
                "base_salary": 34000.0,
                "vehicle_type": "container_trailer",
            },
        ]

        existing_phones = {d.phone for d in db.query(Driver.phone).all()}
        created_drivers = []
        for idx, ddata in enumerate(drivers_data):
            v_assigned = created_vehicles[idx] if idx < len(created_vehicles) else None
            if ddata["phone"] not in existing_phones:
                dr = Driver(**ddata, vehicle_id=v_assigned.id if v_assigned else None)
                db.add(dr)
                db.flush()
                created_drivers.append(dr)
            else:
                dr = db.query(Driver).filter(Driver.phone == ddata["phone"]).first()
                if v_assigned and not dr.vehicle_id:
                    dr.vehicle_id = v_assigned.id
                created_drivers.append(dr)

        db.commit()
        print(f"[+] Created/Verified {len(created_drivers)} drivers.")

        # 3. Create Trips
        now = get_now_ist_naive()
        trips_data = [
            {
                "source": "Mumbai Depot",
                "destination": "Pune Logistics Hub",
                "distance_km": 148.5,
                "duration_minutes": 180,
                "estimated_fare": 6750.0,
                "cargo_weight_kg": 1200.0,
                "cargo_volume_m3": 12.0,
                "status": "completed",
                "driver_id": created_drivers[0].id,
                "vehicle_id": created_vehicles[0].id,
                "start_time": now - timedelta(days=2, hours=5),
                "end_time": now - timedelta(days=2, hours=2),
                "payout_status": "settled",
                "audit_status": "passed",
            },
            {
                "source": "Mumbai Port Terminal",
                "destination": "Nashik Industrial Park",
                "distance_km": 166.0,
                "duration_minutes": 210,
                "estimated_fare": 7400.0,
                "cargo_weight_kg": 2800.0,
                "cargo_volume_m3": 18.0,
                "status": "started",
                "driver_id": created_drivers[2].id,
                "vehicle_id": created_vehicles[2].id,
                "start_time": now - timedelta(hours=3),
                "payout_status": "pending",
                "audit_status": "passed",
            },
            {
                "source": "Delhi Freight Complex",
                "destination": "Jaipur Transport Hub",
                "distance_km": 280.0,
                "duration_minutes": 330,
                "estimated_fare": 13500.0,
                "cargo_weight_kg": 3200.0,
                "cargo_volume_m3": 22.0,
                "status": "started",
                "driver_id": created_drivers[3].id,
                "vehicle_id": created_vehicles[3].id,
                "start_time": now - timedelta(hours=4),
                "payout_status": "pending",
                "audit_status": "passed",
            },
            {
                "source": "Chennai Port Terminal",
                "destination": "Bengaluru Logistics Park",
                "distance_km": 346.0,
                "duration_minutes": 420,
                "estimated_fare": 26500.0,
                "cargo_weight_kg": 8500.0,
                "cargo_volume_m3": 45.0,
                "status": "started",
                "driver_id": created_drivers[6].id,
                "vehicle_id": created_vehicles[6].id,
                "start_time": now - timedelta(hours=6),
                "payout_status": "pending",
                "audit_status": "passed",
            },
            {
                "source": "Jawaharlal Nehru Port Trust (JNPT)",
                "destination": "Ahmedabad Logistics Hub",
                "distance_km": 525.0,
                "duration_minutes": 600,
                "estimated_fare": 54000.0,
                "cargo_weight_kg": 22000.0,
                "cargo_volume_m3": 85.0,
                "status": "started",
                "driver_id": created_drivers[9].id,
                "vehicle_id": created_vehicles[9].id,
                "start_time": now - timedelta(hours=8),
                "payout_status": "pending",
                "audit_status": "passed",
            },
            {
                "source": "Surat Textile Yard",
                "destination": "Mumbai Central Warehouse",
                "distance_km": 284.0,
                "duration_minutes": 320,
                "estimated_fare": 12800.0,
                "cargo_weight_kg": 2900.0,
                "cargo_volume_m3": 20.0,
                "status": "completed",
                "driver_id": created_drivers[4].id,
                "vehicle_id": created_vehicles[4].id,
                "start_time": now - timedelta(days=3, hours=7),
                "end_time": now - timedelta(days=3, hours=2),
                "payout_status": "approved",
                "audit_status": "passed",
            },
            {
                "source": "Hyderabad Container Depot",
                "destination": "Vijayawada Freight Hub",
                "distance_km": 272.0,
                "duration_minutes": 300,
                "estimated_fare": 19800.0,
                "cargo_weight_kg": 7200.0,
                "cargo_volume_m3": 40.0,
                "status": "completed",
                "driver_id": created_drivers[7].id,
                "vehicle_id": created_vehicles[7].id,
                "start_time": now - timedelta(days=4, hours=6),
                "end_time": now - timedelta(days=4, hours=1),
                "payout_status": "settled",
                "audit_status": "passed",
            },
            {
                "source": "Kolkata Port Dock",
                "destination": "Bhubaneswar Cargo Hub",
                "distance_km": 440.0,
                "duration_minutes": 510,
                "estimated_fare": 41500.0,
                "cargo_weight_kg": 18500.0,
                "cargo_volume_m3": 75.0,
                "status": "completed",
                "driver_id": created_drivers[11].id,
                "vehicle_id": created_vehicles[11].id,
                "start_time": now - timedelta(days=5, hours=9),
                "end_time": now - timedelta(days=5, hours=1),
                "payout_status": "settled",
                "audit_status": "passed",
            },
            {
                "source": "Nagpur Central Depot",
                "destination": "Raipur Industrial Zone",
                "distance_km": 285.0,
                "duration_minutes": 340,
                "estimated_fare": 14200.0,
                "cargo_weight_kg": 3100.0,
                "cargo_volume_m3": 21.0,
                "status": "assigned",
                "driver_id": created_drivers[1].id,
                "vehicle_id": created_vehicles[1].id,
                "payout_status": "pending",
                "audit_status": "passed",
            },
            {
                "source": "Pune Logistics Hub",
                "destination": "Goa Port Terminal",
                "distance_km": 448.0,
                "duration_minutes": 540,
                "estimated_fare": 36000.0,
                "cargo_weight_kg": 9200.0,
                "cargo_volume_m3": 50.0,
                "status": "assigned",
                "driver_id": created_drivers[5].id,
                "vehicle_id": created_vehicles[5].id,
                "payout_status": "pending",
                "audit_status": "passed",
            },
            {
                "source": "Indore Transport Nagar",
                "destination": "Bhopal Central Hub",
                "distance_km": 194.0,
                "duration_minutes": 220,
                "estimated_fare": 8900.0,
                "cargo_weight_kg": 1800.0,
                "cargo_volume_m3": 14.0,
                "status": "created",
                "payout_status": "pending",
                "audit_status": "passed",
            },
            {
                "source": "Chandigarh Freight Depot",
                "destination": "Ludhiana Textile Park",
                "distance_km": 100.0,
                "duration_minutes": 130,
                "estimated_fare": 5200.0,
                "cargo_weight_kg": 1500.0,
                "cargo_volume_m3": 10.0,
                "status": "created",
                "payout_status": "pending",
                "audit_status": "passed",
            },
        ]

        created_trips = []
        for tdata in trips_data:
            tr = Trip(**tdata)
            db.add(tr)
            db.flush()
            created_trips.append(tr)

        db.commit()
        print(f"[+] Created {len(created_trips)} trip dispatches.")

        # 4. Create Fuel Logs
        fuel_logs_data = [
            {
                "driver_id": created_drivers[0].id,
                "trip_id": created_trips[0].id,
                "liters_refueled": 12.5,
                "cost": 1222.8,
                "odometer": 24500.0,
                "fuel_station_name": "IndianOil Mumbai Depot",
            },
            {
                "driver_id": created_drivers[2].id,
                "trip_id": created_trips[1].id,
                "liters_refueled": 20.0,
                "cost": 1956.6,
                "odometer": 54100.0,
                "fuel_station_name": "HPCL Highway Bunk Nashik",
            },
            {
                "driver_id": created_drivers[3].id,
                "trip_id": created_trips[2].id,
                "liters_refueled": 35.0,
                "cost": 3424.0,
                "odometer": 42000.0,
                "fuel_station_name": "BPCL Expressway Delhi",
            },
            {
                "driver_id": created_drivers[6].id,
                "trip_id": created_trips[3].id,
                "liters_refueled": 70.0,
                "cost": 6848.0,
                "odometer": 112000.0,
                "fuel_station_name": "Reliance Petroleum Chennai",
            },
            {
                "driver_id": created_drivers[9].id,
                "trip_id": created_trips[4].id,
                "liters_refueled": 140.0,
                "cost": 13696.0,
                "odometer": 145000.0,
                "fuel_station_name": "Shell Highway JNPT",
            },
        ]
        for flog in fuel_logs_data:
            fl = FuelLog(**flog)
            db.add(fl)
        db.commit()
        print("[+] Created fuel refuel logs.")

        # 5. Create Maintenance Logs
        maint_logs = [
            {
                "vehicle_id": created_vehicles[0].id,
                "service_type": "oil_change",
                "description": "Engine oil and filter replacement",
                "cost": 3500.0,
                "odometer_at_service": 24000.0,
            },
            {
                "vehicle_id": created_vehicles[2].id,
                "service_type": "brakes",
                "description": "Front brake pad & disc overhaul",
                "cost": 8200.0,
                "odometer_at_service": 53000.0,
            },
            {
                "vehicle_id": created_vehicles[6].id,
                "service_type": "tire_rotation",
                "description": "6-wheel alignment and rotation",
                "cost": 12000.0,
                "odometer_at_service": 110000.0,
            },
            {
                "vehicle_id": created_vehicles[10].id,
                "service_type": "engine",
                "description": "Turbocharger inspection and intercooler flush",
                "cost": 45000.0,
                "odometer_at_service": 168000.0,
            },
        ]
        for mlog in maint_logs:
            ml = MaintenanceLog(**mlog)
            db.add(ml)
        db.commit()
        print("[+] Created vehicle maintenance logs.")

        # 5.5 Create Vehicle Toll Logs
        from app.models.vehicle import VehicleTollLog

        toll_logs_data = [
            {
                "vehicle_id": created_vehicles[0].id,
                "driver_id": created_drivers[0].id,
                "trip_id": created_trips[0].id,
                "toll_plaza_name": "Khalapur Toll Plaza",
                "highway_name": "Mumbai-Pune Expressway",
                "amount": 320.0,
                "payment_method": "FASTag",
                "transaction_reference": "FT-5511882",
            },
            {
                "vehicle_id": created_vehicles[0].id,
                "driver_id": created_drivers[0].id,
                "trip_id": created_trips[0].id,
                "toll_plaza_name": "Talegaon Toll Booth",
                "highway_name": "Mumbai-Pune Expressway",
                "amount": 180.0,
                "payment_method": "FASTag",
                "transaction_reference": "FT-5511899",
            },
            {
                "vehicle_id": created_vehicles[2].id,
                "driver_id": created_drivers[2].id,
                "trip_id": created_trips[1].id,
                "toll_plaza_name": "Khed-Shivapur Plaza",
                "highway_name": "NH-48",
                "amount": 240.0,
                "payment_method": "FASTag",
                "transaction_reference": "FT-6622991",
            },
            {
                "vehicle_id": created_vehicles[3].id,
                "driver_id": created_drivers[3].id,
                "trip_id": created_trips[2].id,
                "toll_plaza_name": "Ghoti Toll Plaza",
                "highway_name": "NH-160",
                "amount": 150.0,
                "payment_method": "FASTag",
                "transaction_reference": "FT-7722110",
            },
            {
                "vehicle_id": created_vehicles[6].id,
                "driver_id": created_drivers[6].id,
                "trip_id": created_trips[3].id,
                "toll_plaza_name": "Charoti Plaza",
                "highway_name": "NH-48",
                "amount": 380.0,
                "payment_method": "FASTag",
                "transaction_reference": "FT-8833991",
            },
            {
                "vehicle_id": created_vehicles[9].id,
                "driver_id": created_drivers[9].id,
                "trip_id": created_trips[4].id,
                "toll_plaza_name": "Vashi Toll Plaza",
                "highway_name": "Sion-Panvel Expressway",
                "amount": 100.0,
                "payment_method": "Cash",
                "transaction_reference": "CASH-1122",
            },
        ]
        for tlog in toll_logs_data:
            tl = VehicleTollLog(**tlog)
            db.add(tl)
        db.commit()
        print("[+] Created vehicle toll logs.")

        # 6. Create Trip Expenses
        expenses = [
            {
                "driver_id": created_drivers[0].id,
                "trip_id": created_trips[0].id,
                "category": "toll",
                "amount": 350.0,
                "description": "Mumbai-Pune FASTag Toll",
                "status": "settled",
                "receipt_number": "TXN-887711",
            },
            {
                "driver_id": created_drivers[0].id,
                "trip_id": created_trips[0].id,
                "category": "food_allowance",
                "amount": 250.0,
                "description": "Driver lunch & tea allowance",
                "status": "settled",
                "receipt_number": "RCP-10293",
            },
            {
                "driver_id": created_drivers[2].id,
                "trip_id": created_trips[1].id,
                "category": "toll",
                "amount": 420.0,
                "description": "NH-160 Expressway Toll",
                "status": "approved",
                "receipt_number": "TXN-993821",
            },
            {
                "driver_id": created_drivers[3].id,
                "trip_id": created_trips[2].id,
                "category": "lodging",
                "amount": 1200.0,
                "description": "Highway Motel overnight stay",
                "status": "approved",
                "receipt_number": "HOTEL-4422",
            },
            {
                "driver_id": created_drivers[6].id,
                "trip_id": created_trips[3].id,
                "category": "fuel_out_of_pocket",
                "amount": 1500.0,
                "description": "Emergency 15L Diesel refill at night",
                "status": "pending",
                "receipt_number": "EMG-77112",
            },
            {
                "driver_id": created_drivers[9].id,
                "trip_id": created_trips[4].id,
                "category": "maintenance_emergency",
                "amount": 2800.0,
                "description": "Highway tire puncture & tube repair",
                "status": "pending",
                "receipt_number": "TYRE-992",
            },
        ]
        for exp in expenses:
            ex = TripExpense(**exp)
            db.add(ex)
        db.commit()
        print("[+] Created driver expense reimbursement claims.")

        print(
            "[SUCCESS] Database seeding completed successfully with 12 vehicles, 12 drivers, and 12+ trips!"
        )

    except Exception as e:
        db.rollback()
        print(f"[-] Error during database seeding: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
