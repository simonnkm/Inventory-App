from datetime import date, datetime
from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"

class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    model_config = {
        "from_attributes": True
    }

class UserLogin(BaseModel):
    username: str
    password: str

class ItemCreate(BaseModel):
    catalogue_num: int
    item_name: str
    lot_num: int | None = None
    quantity: int
    storage_id: str
    expiry_date: date | None = None
    last_restocked: date
    brand: str
    reorder_threshold: int = 5
    critical_threshold: int = 1

class ItemResponse(BaseModel):
    id: int
    catalogue_num: int
    item_name: str
    lot_num: int | None
    quantity: int
    storage_id: str
    expiry_date: date | None
    last_restocked: date
    brand: str
    reorder_threshold: int = 5
    critical_threshold: int = 1

    model_config = {
        "from_attributes": True
    }

class ItemUpdate(BaseModel):
    catalogue_num: int | None = None
    item_name: str | None = None
    lot_num: int | None = None
    quantity: int | None = None
    storage_id: str | None = None
    expiry_date: date | None = None
    last_restocked: date | None = None
    brand: str | None = None
    reorder_threshold: int | None = None
    critical_threshold: int | None = None

class AuditLogResponse(BaseModel):
    id: int
    username: str
    action: str
    item_id: int | None
    details: str | None
    timestamp: datetime
    model_config = {
        "from_attributes": True
    }