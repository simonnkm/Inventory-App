from datetime import date, datetime
from pydantic import BaseModel
from typing import Literal

class UserCreate(BaseModel):
    username: str
    password: str
    role: Literal["user", "admin"] = "user"

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
    catalogue_num: str
    item_name: str
    lot_num: int | None = None
    quantity: int
    storage_id: str
    expiry_date: date | None = None
    last_restocked: date
    brand: str
    reorder_threshold: int = 5
    critical_threshold: int = 1
    category: str = "Uncategorized"
    shelf_num: str | None = None
    tags: str | None = ""
    last_used_at: datetime | None = None


class ItemResponse(BaseModel):
    id: int
    catalogue_num: str
    item_name: str
    lot_num: int | None
    quantity: int
    storage_id: str
    expiry_date: date | None
    last_restocked: date
    brand: str
    reorder_threshold: int = 5
    critical_threshold: int = 1
    category: str = "Uncategorized"
    shelf_num: str | None = None
    tags: str | None = ""
    last_used_at: datetime | None = None

    model_config = {
        "from_attributes": True
    }

class ItemUpdate(BaseModel):
    catalogue_num: str | None = None
    item_name: str | None = None
    lot_num: int | None = None
    quantity: int | None = None
    storage_id: str | None = None
    expiry_date: date | None = None
    last_restocked: date | None = None
    brand: str | None = None
    reorder_threshold: int | None = None
    critical_threshold: int | None = None
    category: str | None = None
    shelf_num: str | None = None
    tags: str | None = ""
    last_used_at: datetime | None = None

class ItemTransactionCreate(BaseModel):
    type: str
    amount: int
    reason: str | None = None

class DashBoardStats(BaseModel):
    out_of_stock: int
    critical: int
    low_stock: int
    expiring_soon: int
    unique_items: int
    total_quantity: int

class AuditLogResponse(BaseModel):
    id: int
    username: str
    action: str
    item_id: int | None
    details: str | None
    timestamp: datetime
    old_quantity: int | None
    change_amount: int | None
    new_quantity: int | None
    model_config = {
        "from_attributes": True
    }

class OrderBase(BaseModel):
    order_date: date | None = None
    order_placed_by: str | None = None
    po_number: str | None = None
    vendor: str | None = None
    category: str | None = None
    catalog_no: str | None = None
    item_name: str
    units_ordered: int | None = None
    price_per_unit: float | None = None
    total_price: float | None = None
    final_price: float | None = None
    availability: str | None = None
    expected_delivery_date: date | None = None
    order_number: str | None = None
    delivery_date: date | None = None
    status: str = "Ordered"
    received_by: str | None = None
    date_paid: date | None = None
    amount_paid: float | None = None
    cc_invoice: str | None = None


class OrderCreate(OrderBase):
    pass


class OrderResponse(OrderBase):
    id: int

    model_config = {
        "from_attributes": True
    }