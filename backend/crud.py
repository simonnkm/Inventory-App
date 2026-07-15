from sqlalchemy.orm import Session
from sqlalchemy import func
from pwdlib import PasswordHash
from datetime import timedelta, date, datetime, timezone

import models
import schemas

def create_item(db: Session, item: schemas.ItemCreate):
    data = item.model_dump()

    if not data.get("item_type_id"):
        item_type = get_or_create_item_type_by_name(
            db,
            name=data["item_name"],
            category=data.get("category"),
            brand=data.get("brand"),
        )
        data["item_type_id"] = item_type.id

    db_item = models.Item(**data)

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

def get_item(db: Session, item_id: str):
    return (
        db.query(models.Item)
        .filter(models.Item.catalogue_num == str(item_id))
        .first()
    )

def get_items_filtered(
        db: Session,
        name: str | None = None,
        storage_id: str | None = None,
        expiring_before=None,
        status: str | None = None,
        category: str | None = None,
        shelf_num: int | None = None,
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

    if category:
        query = query.filter(models.Item.category == category)

    if shelf_num:
        query = query.filter(models.Item.shelf_num == shelf_num)

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


def get_item_types(db: Session):
    rows = (
        db.query(
            models.ItemType,
            func.coalesce(func.sum(models.Item.quantity), 0).label("total_quantity"),
        )
        .outerjoin(models.Item, models.Item.item_type_id == models.ItemType.id)
        .group_by(models.ItemType.id)
        .order_by(models.ItemType.name.asc())
        .all()
    )

    return [
        {
            "id": item_type.id,
            "name": item_type.name,
            "category": item_type.category,
            "brand": item_type.brand,
            "reorder_threshold": item_type.reorder_threshold,
            "critical_threshold": item_type.critical_threshold,
            "notes": item_type.notes,
            "total_quantity": int(total_quantity or 0),
        }
        for item_type, total_quantity in rows
    ]

def create_item_type(db: Session, payload: schemas.ItemTypeCreate):
    item_type = models.ItemType(**payload.model_dump())
    db.add(item_type)
    db.commit()
    db.refresh(item_type)
    return item_type


def get_or_create_item_type_by_name(
    db: Session,
    name: str,
    category: str | None = None,
    brand: str | None = None,
):
    cleaned_name = name.strip()

    existing = (
        db.query(models.ItemType)
        .filter(func.lower(models.ItemType.name) == cleaned_name.lower())
        .first()
    )

    if existing:
        return existing

    item_type = models.ItemType(
        name=cleaned_name,
        category=category,
        brand=brand,
    )

    db.add(item_type)
    db.commit()
    db.refresh(item_type)
    return item_type

def delete_item(db: Session, item_id: str):
    db_item = get_item(db, item_id)
    if db_item is None:
        return None
    db.delete(db_item)
    db.commit()

    return db_item

def update_item(db: Session, item_id: str, item_data: schemas.ItemUpdate):
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
        item_id: str | None = None,
        details: str | None = None,
        old_quantity: int | None = None,
        change_amount: int | None = None,
        new_quantity: int | None = None,
):
    log = models.AuditLog(
        username = username,
        action = action,
        item_id = item_id,
        details = details,
        old_quantity=old_quantity,
        change_amount=change_amount,
        new_quantity=new_quantity,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return log


def get_audit_logs(db: Session):
    return(
        db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).all()
    )

def use_item(db: Session, item_id: str, amount: int):
    item = get_item(db, item_id)

    if item is None:
        return None
    
    if amount <= 0:
        return "invalid_amount"
    
    if item.quantity < amount:
        return "not_enough_quantity"
    
    item.quantity -= amount
    db.commit()
    db.refresh(item)
    return item

def restock_item(db: Session, item_id: str, amount: int):
    item = get_item(db, item_id)

    if item is None:
        return None
    
    if amount <= 0:
        return "invalid_amount"
    
    item.quantity += amount
    db.commit()
    db.refresh(item)
    return item

def get_item_comments(db: Session, item_id: str):
    return (
        db.query(models.ItemComment)
        .filter(models.ItemComment.item_id == str(item_id))
        .order_by(models.ItemComment.created_at.desc())
        .all()
    )


def create_item_comment(
    db: Session,
    item_id: str,
    username: str,
    comment: str,
):
    item = get_item(db, item_id)

    if item is None:
        return None

    db_comment = models.ItemComment(
        item_id=str(item_id),
        username=username,
        comment=comment.strip(),
    )

    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)

    return db_comment


def delete_item_comment(db: Session, comment_id: int):
    comment = (
        db.query(models.ItemComment)
        .filter(models.ItemComment.id == comment_id)
        .first()
    )

    if comment is None:
        return None

    db.delete(comment)
    db.commit()

    return comment

def create_transaction(db: Session, item_id: str, change_amount: int):
    item = get_item(db, item_id)

    if item is None:
        return None

    old_quantity = item.quantity
    new_quantity = old_quantity + change_amount

    if new_quantity < 0:
        return "not_enough_quantity"

    item.quantity = new_quantity
    item.last_used_at = datetime.now(timezone.utc)

    if change_amount > 0:
        item.last_restocked = date.today()

    db.commit()
    db.refresh(item)

    return item, old_quantity, new_quantity

def apply_item_transaction(db, item_id, transaction, username):
    item = get_item(db, item_id)

    if item is None:
        return None
    if transaction.amount <= 0:
        return "invalid amount"
    old_quantity = item.quantity

    if transaction.type == "use":
        if item.quantity < transaction.amount:
            return "not enough quantity"
        item.quantity -= transaction.amount
        change_amount = -transaction.amount
        action = "USE_ITEM"

    elif transaction.type == "restock":
        item.quantity += transaction.amount
        change_amount = transaction.amount
        action = "RESTOCK_ITEM"

    else:
        return "invalid type"
    
    item.last_used_at = datetime.now(timezone.utc)
    new_quantity = item.quantity

    db.commit()
    db.refresh(item)

    create_audit_log(
        db, username=username,action=action,item_id=item_id,
        details=f"{action}: {transaction.amount} of {item.item_name}. Reason: {transaction.reason}",
        old_quantity=old_quantity, change_amount=change_amount, new_quantity=new_quantity,
    )
    return item

def get_dashboard_stats(db: Session):
    today = date.today()
    soon = today + timedelta(days=14)
    unique_items = db.query(models.Item).count()
    total_quantity = (db.query(func.coalesce(func.sum(models.Item.quantity), 0)).scalar())
    out_of_stock = db.query(models.Item).filter(models.Item.quantity <= 0).count()
    critical = db.query(models.Item).filter(models.Item.quantity > 0,
                                             models.Item.quantity <= models.Item.critical_threshold).count()
    
    low_stock = db.query(models.Item).filter(models.Item.quantity <= models.Item.reorder_threshold).count()
    expiring_soon = db.query(models.Item).filter(models.Item.expiry_date != None,
                                                  models.Item.expiry_date >= today,
                                                  models.Item.expiry_date <= soon,
                                                  ).count()
    
    return {
        "unique_items": unique_items,
        "total_quantity": total_quantity,
        "out_of_stock": out_of_stock,
        "critical": critical,
        "low_stock": low_stock,
        "expiring_soon": expiring_soon,
    }

def get_users(db: Session):
    return db.query(models.User).order_by(models.User.id.asc()).all()

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def delete_user(db: Session, user_id: int):
    user = get_user_by_id(db, user_id)

    if user is None:
        return None

    db.delete(user)
    db.commit()

    return user

def get_orders(db: Session):
    return db.query(models.Order).order_by(models.Order.id.desc()).all()


def get_orders_by_ids(db: Session, order_ids: list[int]):
    return (
        db.query(models.Order)
        .filter(models.Order.id.in_(order_ids))
        .order_by(models.Order.id.desc())
        .all()
    )


def create_order(db: Session, order: schemas.OrderCreate):
    db_order = models.Order(**order.model_dump())

    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    # Create item shell only. Do not increase inventory count yet.
    create_inventory_placeholder_from_order(db, db_order)

    # Only add quantity if the order is already recorded as delivered/received.
    if order_counts_as_received(db_order):
        receive_order_into_inventory(db, db_order)

        create_order_event(
            db,
            order_id=db_order.id,
            event_type="DELIVERED",
            notes="Order created as delivered; inventory updated",
            created_by=db_order.received_by,
        )

    return db_order

def get_item_by_catalogue_num(db: Session, catalogue_num: str):
    return (
        db.query(models.Item)
        .filter(models.Item.catalogue_num == catalogue_num)
        .first()
    )


def order_counts_as_received(order: models.Order):
    status = (order.status or "").strip().lower()

    received_statuses = {
        "delivered",
        "received",
        "complete",
        "completed",
        "paid",
    }

    return bool(
        order.delivery_date
        or order.received_by
        or status in received_statuses
    )


def create_inventory_placeholder_from_order(db: Session, order: models.Order):
    if not order.catalog_no:
        return None

    catalogue_num = str(order.catalog_no).strip()

    if not catalogue_num:
        return None

    existing_item = get_item_by_catalogue_num(db, catalogue_num)

    if existing_item is not None:
        return existing_item

    item = models.Item(
        catalogue_num=catalogue_num,
        item_name=order.item_name,
        lot_num=None,
        quantity=0,
        storage_id="Pending Order",
        expiry_date=order.expected_delivery_date or order.delivery_date,
        last_restocked=order.order_date or date.today(),
        brand=order.vendor or "—",
        reorder_threshold=5,
        critical_threshold=1,
        category=order.category or "Uncategorized",
        shelf_num=None,
        tags="order,pending",
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return item


def receive_order_into_inventory(db: Session, order: models.Order):
    if not order.catalog_no:
        return None

    catalogue_num = str(order.catalog_no).strip()

    if not catalogue_num:
        return None

    units = order.units_ordered or 0

    item = get_item_by_catalogue_num(db, catalogue_num)

    if item is None:
        item = create_inventory_placeholder_from_order(db, order)

    if item is None:
        return None

    if units > 0:
        item.quantity += units

    item.storage_id = item.storage_id if item.storage_id != "Pending Order" else "Imported"
    item.last_restocked = order.delivery_date or order.order_date or date.today()

    if item.tags:
        tags = set(tag.strip() for tag in item.tags.split(",") if tag.strip())
        tags.update(["order", "received"])
        item.tags = ",".join(sorted(tags))
    else:
        item.tags = "order,received"

    db.commit()
    db.refresh(item)

    return item

def get_order_by_id(db: Session, order_id: int):
    return db.query(models.Order).filter(models.Order.id == order_id).first()


def create_order_event(
    db: Session,
    order_id: int,
    event_type: str,
    notes: str | None = None,
    created_by: str | None = None,
):
    event = models.OrderEvent(
        order_id=order_id,
        event_type=event_type,
        notes=notes,
        created_by=created_by,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event


def get_order_events(db: Session, order_id: int):
    return (
        db.query(models.OrderEvent)
        .filter(models.OrderEvent.order_id == order_id)
        .order_by(models.OrderEvent.created_at.desc())
        .all()
    )


def order_has_event(db: Session, order_id: int, event_type: str):
    return (
        db.query(models.OrderEvent)
        .filter(
            models.OrderEvent.order_id == order_id,
            models.OrderEvent.event_type == event_type,
        )
        .first()
        is not None
    )


def create_order_document(
    db: Session,
    order_id: int | None,
    document_type: str,
    source: str,
    original_filename: str | None,
    stored_filename: str | None,
    file_path: str | None,
    content_type: str | None,
    sender: str | None = None,
    subject: str | None = None,
    email_message_id: str | None = None,
    extracted_json: str | None = None,
    confidence: float | None = None,
    reviewed: bool = False,
):
    document = models.OrderDocument(
        order_id=order_id,
        document_type=document_type,
        source=source,
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_path=file_path,
        content_type=content_type,
        sender=sender,
        subject=subject,
        email_message_id=email_message_id,
        extracted_json=extracted_json,
        confidence=confidence,
        reviewed=reviewed,
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    return document


def get_order_documents(db: Session, order_id: int):
    return (
        db.query(models.OrderDocument)
        .filter(models.OrderDocument.order_id == order_id)
        .order_by(models.OrderDocument.received_at.desc())
        .all()
    )

def delete_order_document(db: Session, document_id: int):
    document = get_order_document(db, document_id)

    if document is None:
        return None

    db.delete(document)
    db.commit()

    return document

def get_order_document(db: Session, document_id: int):
    return (
        db.query(models.OrderDocument)
        .filter(models.OrderDocument.id == document_id)
        .first()
    )

def mark_order_confirmed(db: Session, order_id: int, username: str | None = None):
    order = get_order_by_id(db, order_id)

    if order is None:
        return None

    order.status = "Confirmed"
    db.commit()
    db.refresh(order)

    create_order_event(
        db,
        order_id=order.id,
        event_type="CONFIRMED",
        notes="Order confirmation uploaded",
        created_by=username,
    )

    return order


def mark_order_delivered(
    db: Session,
    order_id: int,
    delivery_date_value,
    received_by: str | None,
    username: str | None = None,
    notes: str | None = None,
):
    order = get_order_by_id(db, order_id)

    if order is None:
        return None

    already_delivered = order_has_event(db, order_id, "DELIVERED")

    order.status = "Delivered"
    order.delivery_date = delivery_date_value or date.today()
    order.received_by = received_by or username

    db.commit()
    db.refresh(order)

    if not already_delivered:
        receive_order_into_inventory(db, order)

        create_order_event(
            db,
            order_id=order.id,
            event_type="DELIVERED",
            notes=notes or "Order marked delivered; inventory updated",
            created_by=username,
        )
    else:
        create_order_event(
            db,
            order_id=order.id,
            event_type="UPDATED",
            notes="Delivery info updated; inventory was not added again",
            created_by=username,
        )

    return order


def mark_order_invoice_received(
    db: Session,
    order_id: int,
    username: str | None = None,
):
    order = get_order_by_id(db, order_id)

    if order is None:
        return None

    if order.status not in {"Delivered", "Paid"}:
        order.status = "Invoice Received"

    db.commit()
    db.refresh(order)

    create_order_event(
        db,
        order_id=order.id,
        event_type="INVOICE_RECEIVED",
        notes="Invoice uploaded",
        created_by=username,
    )

    return order


def mark_order_paid(
    db: Session,
    order_id: int,
    date_paid_value,
    amount_paid: float | None,
    cc_invoice: str | None,
    username: str | None = None,
    notes: str | None = None,
):
    order = get_order_by_id(db, order_id)

    if order is None:
        return None

    order.status = "Paid"
    order.date_paid = date_paid_value or date.today()
    order.amount_paid = amount_paid
    order.cc_invoice = cc_invoice

    db.commit()
    db.refresh(order)

    create_order_event(
        db,
        order_id=order.id,
        event_type="PAID",
        notes=notes or "Order marked paid",
        created_by=username,
    )

    return order