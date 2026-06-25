from sqlalchemy.orm import Session
from pwdlib import PasswordHash
from datetime import timedelta, date

import models
import schemas

def create_item(db: Session, item: schemas.ItemCreate):
    db_item = models.Item(**item.model_dump())

    db.add(db_item)
    try:
        db.commit()
        db.refresh(db_item)
    except Exception:
        db.rollback()
        raise

    return db_item

def get_items(db: Session):
    return db.query(models.Item).all()

def get_item(db: Session, item_id: int):
    return db.query(models.Item).filter(models.Item.id == item_id).first()

def delete_item(db: Session, item_id: int):
    db_item = get_item(db, item_id)
    if db_item is None:
        return None
    db.delete(db_item)
    db.commit()

    return db_item

def update_item(db: Session, item_id: int, item_data: schemas.ItemUpdate):
    item = get_item(db, item_id)

    if not item: 
        return None
    
    update_data = item_data.model_dump(exclude_unset = True)

    for key, value in item_data.model_dump().items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)

    return item

def get_low_stock_items(db: Session):
    return(
        db.query(models.Item).filter(models.Item.quantity <= models.Item.reorder_threshold).all()
    )

password_hash = PasswordHash.recommended()

def create_user(db: Session, user: schemas.UserCreate):
    hashed = password_hash.hash(user.password)
    db_user = models.User(
        username = user.username,
        hashed_password = hashed,
        role = user.role,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user

def get_user(db: Session, username: str):
    return (
        db.query(models.User).filter(models.User.username == username).first()
    )

def authenticate_user(db: Session, username: str, password: str):
    user = get_user(db, username)

    if not user: 
        return None
    
    if not password_hash.verify(password, user.hashed_password):
        return None
    
    return user

def create_audit_log(
        db: Session,
        username: str,
        action: str,
        item_id: int | None = None,
        details: str | None = None,
):
    log = models.AuditLog(
        username = username,
        action = action,
        item_id = item_id,
        details = details,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return log

def get_items_filtered(
        db: Session,
        name: str | None = None,
        storage_id: str | None = None,
        expiring_before=None,
        status: str | None = None,
):
    query = db.query(models.Item)

    if name:
        query = query.filter(models.Item.item_name.ilike(f"%{name}%"))

    if storage_id: 
        query = query.filter(models.Item.storage_id == storage_id)

    if expiring_before:
        query = query.filter(models.Item.expiry_date <= expiring_before)

    if status == "out_of_stock":
        query = query.filter(models.Item.quantity <= 0)

    elif status == "critical":
        query = query.filter(models.Item.quantity > 0, models.Item.quantity <= models.Item.critical_threshold)
    
    elif status == "low_stock":
        query = query.filter(models.Item.quantity <= models.Item.reorder_threshold)
    
    elif status == "expiring_soon":
        today = date.today()
        soon = today + timedelta(days = 14)

        query = query.filter(
            models.Item.expiry_date != None,
            models.Item.expiry_date >= today,
            models.Item.expiry_date <= soon,
        )

    return query.all()

def get_audit_logs(db: Session):
    return(
        db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).all()
    )
