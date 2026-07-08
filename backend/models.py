from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Float
from database import Base
from datetime import datetime, timezone

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default = "user", nullable=False)


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    catalogue_num = Column(String, unique=True, nullable=False)
    item_name = Column(String, nullable=False)
    lot_num = Column(Integer, nullable=True)
    quantity = Column(Integer, nullable=False)
    storage_id = Column(String, nullable=False)
    expiry_date = Column(Date, nullable=True)
    last_restocked = Column(Date, nullable=False)
    brand = Column(String, nullable= False)
    reorder_threshold = Column(Integer, default = 5, nullable=False)
    critical_threshold = Column(Integer, default = 1, nullable=False)
    category = Column(String, nullable = False, default="Uncategorized")
    shelf_num = Column(Integer, nullable=True)
    tags = Column(String, nullable = True, default = "")
    last_used_at = Column(DateTime, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index = True)
    username = Column(String, nullable= False)
    action = Column(String, nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable= True)
    details = Column(String, nullable = True)
    timestamp = Column(DateTime, default = lambda: datetime.now(timezone.utc), nullable=False)
    old_quantity = Column(Integer, nullable=True)
    change_amount = Column(Integer, nullable=True)
    new_quantity = Column(Integer, nullable=True)

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)

    order_date = Column(Date, nullable=True)
    order_placed_by = Column(String, nullable=True)
    po_number = Column(String, nullable=True)
    vendor = Column(String, nullable=True)
    category = Column(String, nullable=True)
    catalog_no = Column(String, nullable=True)
    item_name = Column(String, nullable=False)

    units_ordered = Column(Integer, nullable=True)
    price_per_unit = Column(Float, nullable=True)
    total_price = Column(Float, nullable=True)
    final_price = Column(Float, nullable=True)

    availability = Column(String, nullable=True)
    expected_delivery_date = Column(Date, nullable=True)
    order_number = Column(String, nullable=True)
    delivery_date = Column(Date, nullable=True)
    status = Column(String, nullable=False, default="Ordered")
    received_by = Column(String, nullable=True)
    date_paid = Column(Date, nullable=True)
    amount_paid = Column(Float, nullable=True)
    cc_invoice = Column(String, nullable=True)