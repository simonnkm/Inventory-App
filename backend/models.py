from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user", nullable=False)


class ItemType(Base):
    __tablename__ = "item_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    category = Column(String, nullable=True)
    brand = Column(String, nullable=True)
    reorder_threshold = Column(Integer, default=5, nullable=False)
    critical_threshold = Column(Integer, default=1, nullable=False)
    notes = Column(Text, nullable=True)


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    item_type_id = Column(Integer, ForeignKey("item_types.id"), nullable=True, index=True)

    catalogue_num = Column(String, unique=True, nullable=False)
    item_name = Column(String, nullable=False)
    lot_num = Column(Integer, nullable=True)
    quantity = Column(Integer, nullable=False)
    storage_id = Column(String, nullable=False)
    expiry_date = Column(Date, nullable=True)
    last_restocked = Column(Date, nullable=False)

    brand = Column(String, nullable=False)
    reorder_threshold = Column(Integer, default=5, nullable=False)
    critical_threshold = Column(Integer, default=1, nullable=False)
    category = Column(String, default="Uncategorized", nullable=False)
    shelf_num = Column(String, nullable=True)
    tags = Column(String, default="", nullable=True)
    last_used_at = Column(DateTime, nullable=True)


class ItemComment(Base):
    __tablename__ = "item_comments"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(String, ForeignKey("items.catalogue_num"), nullable=False, index=True)
    username = Column(String, nullable=False)
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False)
    action = Column(String, nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    details = Column(String, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    old_quantity = Column(Integer, nullable=True)
    change_amount = Column(Integer, nullable=True)
    new_quantity = Column(Integer, nullable=True)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    item_type_id = Column(Integer, ForeignKey("item_types.id"), nullable=True, index=True)

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
    status = Column(String, default="Ordered", nullable=False)
    received_by = Column(String, nullable=True)

    date_paid = Column(Date, nullable=True)
    amount_paid = Column(Float, nullable=True)
    cc_invoice = Column(String, nullable=True)


class OrderDocument(Base):
    __tablename__ = "order_documents"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True, index=True)

    document_type = Column(String, nullable=False)
    source = Column(String, default="manual", nullable=False)

    sender = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    email_message_id = Column(String, nullable=True, unique=True)

    original_filename = Column(String, nullable=True)
    stored_filename = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    content_type = Column(String, nullable=True)

    extracted_json = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)

    reviewed = Column(Boolean, default=False, nullable=False)
    received_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class OrderEvent(Base):
    __tablename__ = "order_events"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)

    event_type = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)