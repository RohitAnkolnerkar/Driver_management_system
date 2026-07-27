import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.fuel import FALLBACK_DIESEL_RATES
from app.db import get_db
from app.models.driver import Driver
from app.models.trip import Trip
from app.schemas.pricing import PricingQuoteRequest, PricingQuoteResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pricing", tags=["pricing"])

# Tariff matrix per vehicle type with max payload specifications
VEHICLE_TARIFFS = {
    "mini_van": {
        "base_tariff": 500.0,
        "rate_per_km": 18.0,
        "consumption_per_km": 0.08,
        "max_payload_kg": 1000.0,
        "label": "Mini Van (Max 1,000 kg)",
    },
    "cargo_truck": {
        "base_tariff": 1500.0,
        "rate_per_km": 35.0,
        "consumption_per_km": 0.12,
        "max_payload_kg": 3500.0,
        "label": "Cargo Truck (Max 3,500 kg)",
    },
    "heavy_hauler": {
        "base_tariff": 3000.0,
        "rate_per_km": 65.0,
        "consumption_per_km": 0.20,
        "max_payload_kg": 10000.0,
        "label": "Heavy Hauler (Max 10,000 kg)",
    },
    "container_trailer": {
        "base_tariff": 5000.0,
        "rate_per_km": 90.0,
        "consumption_per_km": 0.28,
        "max_payload_kg": 25000.0,
        "label": "Container Trailer (Max 25,000 kg)",
    },
}

CARGO_HAZARD_MULTIPLIERS = {
    "hazardous": 0.25,
    "perishable": 0.15,
    "heavy_machinery": 0.20,
    "standard": 0.0,
}


def calculate_pricing_quote(
    db: Session, req: PricingQuoteRequest
) -> PricingQuoteResponse:
    v_type = req.vehicle_type.lower() if req.vehicle_type else "cargo_truck"
    tariff = VEHICLE_TARIFFS.get(v_type, VEHICLE_TARIFFS["cargo_truck"])

    distance = req.distance_km
    auto_geocoded = False
    if distance is None or distance <= 0:
        from app.api.matchmaking import haversine_distance
        from app.api.trip import geocode_location

        try:
            src_lat, src_lon, _ = geocode_location(req.source, strict=True)
        except Exception as err:
            logger.warning(
                f"Pricing calculation failed: Invalid source '{req.source}' - {err}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid Source location '{req.source}': {str(err)}",
            )

        try:
            dst_lat, dst_lon, _ = geocode_location(req.destination, strict=True)
        except Exception as err:
            logger.warning(
                f"Pricing calculation failed: Invalid destination '{req.destination}' - {err}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid Destination location '{req.destination}': {str(err)}",
            )

        straight_dist = haversine_distance(src_lat, src_lon, dst_lat, dst_lon)
        distance = round(max(5.0, straight_dist * 1.25), 1)
        auto_geocoded = True

    base_tariff = tariff["base_tariff"]
    distance_charge = round(distance * tariff["rate_per_km"], 2)

    # 1. Distance-Scaled Ton-KM Cargo Weight Surcharge
    # Free payload allowance: 500 kg. Excess weight incurs ₹1.50 per ton-km.
    weight_surcharge = 0.0
    if req.cargo_weight_kg > 500.0:
        excess_tons = (req.cargo_weight_kg - 500.0) / 1000.0
        weight_surcharge = round(excess_tons * distance * 1.50, 2)

    # 2. Over-capacity Payload Penalty
    max_payload = tariff.get("max_payload_kg", 3500.0)
    is_overweight = req.cargo_weight_kg > max_payload
    if is_overweight:
        # Additional 20% surcharge for exceeding recommended vehicle payload
        weight_surcharge = round(
            weight_surcharge + (base_tariff + distance_charge) * 0.20, 2
        )

    # 3. Fuel Indexing Adjustment with Payload Load Factor
    national_avg = FALLBACK_DIESEL_RATES.get("national_average", 97.83)
    cities = FALLBACK_DIESEL_RATES.get("cities", {})
    local_diesel_price = national_avg

    if req.source or req.destination:
        for city_name, price in cities.items():
            if (
                city_name.lower() in req.source.lower()
                or city_name.lower() in req.destination.lower()
            ):
                local_diesel_price = max(local_diesel_price, price)

    # Heavy weight increases engine strain & diesel fuel burn rate by up to 15%
    load_ratio = min(1.5, req.cargo_weight_kg / max_payload) if max_payload > 0 else 1.0
    fuel_load_multiplier = 1.0 + (load_ratio * 0.15)

    expected_liters = distance * tariff["consumption_per_km"] * fuel_load_multiplier
    baseline_fuel_cost = expected_liters * national_avg
    actual_fuel_cost = expected_liters * local_diesel_price
    fuel_index_adjustment = round(max(0.0, actual_fuel_cost - baseline_fuel_cost), 2)

    # 4. Cargo Hazard Category Surcharge
    c_type = req.cargo_type.lower() if req.cargo_type else "standard"
    hazard_multiplier = CARGO_HAZARD_MULTIPLIERS.get(c_type, 0.0)
    subtotal = base_tariff + distance_charge + weight_surcharge + fuel_index_adjustment
    cargo_hazard_surcharge = round(subtotal * hazard_multiplier, 2)

    # 5. Real-time Demand Surge Multiplier
    active_pending_trips = (
        db.query(Trip).filter(Trip.status.in_(["created", "assigned"])).count()
    )
    available_drivers = db.query(Driver).filter(Driver.status == "active").count()

    surge_multiplier = 1.0
    if active_pending_trips > available_drivers and available_drivers >= 0:
        excess_demand = active_pending_trips - available_drivers
        surge_multiplier = round(min(1.5, 1.0 + (excess_demand * 0.1)), 2)

    # Final fare calculation
    total_estimated_fare = round(
        (subtotal + cargo_hazard_surcharge) * surge_multiplier, 2
    )

    # Financial & profitability metrics
    estimated_fuel_cost = round(actual_fuel_cost, 2)
    estimated_driver_commission = round(total_estimated_fare * 0.15, 2)
    projected_gross_profit = round(
        total_estimated_fare - estimated_fuel_cost - estimated_driver_commission, 2
    )
    projected_profit_margin = (
        round((projected_gross_profit / total_estimated_fare) * 100.0, 1)
        if total_estimated_fare > 0
        else 0.0
    )

    explanation = (
        f"Vehicle: {v_type.replace('_', ' ').title()} "
        f"(Base ₹{base_tariff} + ₹{tariff['rate_per_km']}/km). "
        f"Cargo Weight: {req.cargo_weight_kg:.0f} kg "
        f"(Ton-KM Surcharge: +₹{weight_surcharge:.2f}). "
    )

    if auto_geocoded:
        explanation += (
            f"📍 Distance ({distance} km) auto-calculated via GPS geocoding. "
        )

    if is_overweight:
        explanation += (
            f"⚠️ Overweight Warning: Payload ({req.cargo_weight_kg:.0f} kg) "
            f"exceeds {tariff['label']} capacity ({max_payload:.0f} kg). "
            f"Consider upgrading to a larger vehicle class! "
        )

    explanation += (
        f"Diesel Rate: ₹{local_diesel_price:.2f}/L "
        f"(+₹{fuel_index_adjustment:.2f} fuel index). "
    )
    if hazard_multiplier > 0:
        pct = int(hazard_multiplier * 100)
        explanation += (
            f"Cargo Category '{c_type.title()}': +{pct}% surcharge "
            f"(+₹{cargo_hazard_surcharge:.2f}). "
        )
    if surge_multiplier > 1.0:
        explanation += (
            f"Fleet Surge Multiplier: {surge_multiplier}x (High Dispatch Demand). "
        )
    else:
        explanation += "Fleet Surge Multiplier: 1.0x (Standard Supply). "

    overweight_warning = None
    if is_overweight:
        overweight_warning = (
            f"Overweight Warning: Cargo weight ({req.cargo_weight_kg:.0f} kg) exceeds "
            f"{tariff['label']} capacity ({max_payload:.0f} kg)!"
        )

    return PricingQuoteResponse(
        source=req.source,
        destination=req.destination,
        distance_km=distance,
        cargo_weight_kg=req.cargo_weight_kg,
        cargo_type=c_type,
        vehicle_type=v_type,
        max_payload_kg=max_payload,
        is_overweight=is_overweight,
        overweight_warning=overweight_warning,
        base_tariff=base_tariff,
        distance_charge=distance_charge,
        weight_surcharge=weight_surcharge,
        cargo_hazard_surcharge=cargo_hazard_surcharge,
        fuel_index_adjustment=fuel_index_adjustment,
        demand_surge_multiplier=surge_multiplier,
        total_estimated_fare=total_estimated_fare,
        estimated_fuel_cost=estimated_fuel_cost,
        estimated_driver_commission=estimated_driver_commission,
        projected_gross_profit=projected_gross_profit,
        projected_profit_margin_percent=projected_profit_margin,
        breakdown_explanation=explanation,
    )


@router.post("/quote", response_model=PricingQuoteResponse)
def get_pricing_quote(
    req: PricingQuoteRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "dispatcher", "driver")),
):
    """
    Calculate dynamic freight pricing quote based on distance, cargo weight,
    hazard category, regional fuel price index, and real-time fleet surge.
    """
    return calculate_pricing_quote(db, req)
