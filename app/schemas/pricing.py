from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class PricingQuoteRequest(BaseModel):
    source: str = Field(...)
    destination: str = Field(...)
    distance_km: Optional[float] = Field(
        default=None,
        description="Distance in KM. If omitted or 0, auto-calculated via geocoding.",
    )
    cargo_weight_kg: float = Field(default=1000.0, ge=0)
    cargo_type: str = Field(
        default="standard",
        description="Cargo category: standard, perishable, hazardous, heavy_machinery",
    )
    vehicle_type: str = Field(
        default="cargo_truck",
        description=(
            "Vehicle category: mini_van, cargo_truck, heavy_hauler, container_trailer"
        ),
    )

    model_config = ConfigDict(from_attributes=True)


class PricingQuoteResponse(BaseModel):
    source: str
    destination: str
    distance_km: float
    cargo_weight_kg: float
    cargo_type: str
    vehicle_type: str
    max_payload_kg: float
    is_overweight: bool = False
    overweight_warning: Optional[str] = None
    # Tariff breakdown
    base_tariff: float
    distance_charge: float
    weight_surcharge: float
    cargo_hazard_surcharge: float
    fuel_index_adjustment: float
    demand_surge_multiplier: float
    # Final pricing & profitability metrics
    total_estimated_fare: float
    estimated_fuel_cost: float
    estimated_driver_commission: float
    projected_gross_profit: float
    projected_profit_margin_percent: float
    breakdown_explanation: str

    model_config = ConfigDict(from_attributes=True)
