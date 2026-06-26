from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
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
    catalogue_num = Column(Integer, unique=True, nullable=False)
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


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index = True)
    username = Column(String, nullable= False)
    action = Column(String, nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable= True)
    details = Column(String, nullable = True)
    timestamp = Column(DateTime, default = lambda: datetime.now(timezone.utc), nullable=False)