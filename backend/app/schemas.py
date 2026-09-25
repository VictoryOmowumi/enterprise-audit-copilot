from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

class VendorSchema(BaseModel):
    name: str = Field(..., min_length=2)
    contract_code: str = Field(..., min_length=3)

class ShipmentSchema(BaseModel):
    tracking_number: str
    vendor_code: str
    origin: str
    destination: str
    dispatched_at: datetime
    expected_delivery_at: datetime
    actual_delivery_at: Optional[datetime] = None
    status: str
    declared_value: float = Field(..., gt=0)
    discrepancy_notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"DELIVERED", "DELAYED", "DAMAGED", "IN_TRANSIT"}
        v_upper = v.upper()
        if v_upper not in allowed:
            raise ValueError(f"Status must be one of {allowed}, got {v}")
        return v_upper

class ContractClauseChunk(BaseModel):
    vendor_code: str
    document_name: str
    section_title: str
    clause_type: str
    content: str
    page_number: int = 1