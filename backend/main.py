from fastapi import FastAPI, Depends, HTTPException, Query, Response, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import Base, engine, SessionLocal
from datetime import datetime, timedelta, timezone, date
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt
from io import BytesIO
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook
import models
import schemas
import crud
import auth

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ORDER_COLUMNS = [
    ("Date", "order_date"),
    ("Order Placed by", "order_placed_by"),
    ("PO Number", "po_number"),
    ("Vendor", "vendor"),
    ("Category", "category"),
    ("Catalog No.", "catalog_no"),
    ("Item Name", "item_name"),
    ("# of Units", "units_ordered"),
    ("Price / Unit", "price_per_unit"),
    ("Total Price", "total_price"),
    ("Final Price (with tax & freight)", "final_price"),
    ("Availability", "availability"),
    ("Expected Delivery Date", "expected_delivery_date"),
    ("Order #", "order_number"),
    ("Delivery Date", "delivery_date"),
    ("Status", "status"),
    ("Received by", "received_by"),
    ("Date paid", "date_paid"),
    ("Amount Paid", "amount_paid"),
    ("CC/Invoice?", "cc_invoice"),
]


HEADER_ALIASES = {
    "date": "order_date",
    "order placed by": "order_placed_by",
    "po number": "po_number",
    "vendor": "vendor",
    "category": "category",
    "catalog no.": "catalog_no",
    "catalog no": "catalog_no",
    "catalog number": "catalog_no",
    "item name": "item_name",
    "# of units": "units_ordered",
    "units ordered": "units_ordered",
    "price / unit": "price_per_unit",
    "price per unit": "price_per_unit",
    "total price": "total_price",
    "final price (with tax & freight)": "final_price",
    "final price": "final_price",
    "availability": "availability",
    "expected delivery date": "expected_delivery_date",
    "order #": "order_number",
    "order number": "order_number",
    "delivery date": "delivery_date",
    "status": "status",
    "received by": "received_by",
    "dated paid": "date_paid",
    "date paid": "date_paid",
    "amount paid": "amount_paid",
    "cc/invoice?": "cc_invoice",
    "cc invoice": "cc_invoice",
}


def normalize_header(value):
    return str(value or "").strip().lower()


def parse_date(value):
    if value in (None, ""):
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    text = str(value).strip()

    for fmt in ("%Y-%m-%d", "%m-%d-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass

    return None


def parse_float(value):
    if value in (None, ""):
        return None

    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip().lower()

    empty_values = {
        "na",
        "n/a",
        "none",
        "null",
        "varies",
        "variable",
        "tbd",
        "unknown",
        "pending",
        "-",
        "--",
    }

    if text in empty_values:
        return None

    text = (
        text.replace("$", "")
        .replace(",", "")
        .replace("usd", "")
        .strip()
    )

    try:
        return float(text)
    except ValueError:
        return None


def parse_int(value):
    number = parse_float(value)

    if number is None:
        return None

    return int(number)

def is_service_order(payload: dict):
    combined = " ".join(
        str(value or "").lower()
        for value in [
            payload.get("vendor"),
            payload.get("category"),
            payload.get("catalog_no"),
            payload.get("item_name"),
            payload.get("po_number"),
            payload.get("order_number"),
        ]
    )

    service_keywords = [
        "service",
        "services",
        "software",
        "subscription",
        "license",
        "licence",
        "monthly",
        "annual",
        "microsoft",
        "cloud",
        "hosting",
        "internet",
        "it support",
    ]

    return any(keyword in combined for keyword in service_keywords)

def clean_string(value):
    if value in (None, ""):
        return None

    return str(value).strip()


def order_to_excel_row(order):
    return [
        order.order_date,
        order.order_placed_by,
        order.po_number,
        order.vendor,
        order.category,
        order.catalog_no,
        order.item_name,
        order.units_ordered,
        order.price_per_unit,
        order.total_price,
        order.final_price,
        order.availability,
        order.expected_delivery_date,
        order.order_number,
        order.delivery_date,
        order.status,
        order.received_by,
        order.date_paid,
        order.amount_paid,
        order.cc_invoice,
    ]

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/items/", response_model=schemas.ItemResponse)
def create_item(
    item: schemas.ItemCreate,
    db: Session = Depends(get_db),
    current_user = Depends(auth.require_role("admin")),
):
    created_item = crud.create_item(db, item)

    crud.create_audit_log(
        db,
        username=current_user.username,
        action="CREATE_ITEM",
        item_id=created_item.id,
        details=f"Created item {created_item.item_name}",
    )

    return created_item

@app.post("/items/{item_id}/use", response_model=schemas.ItemResponse)
def use_item(
    item_id: str,
    amount: int = Query(..., gt = 0),
    db: Session = Depends(get_db),
    current_user = Depends(auth.require_role("admin", "user")),
):
    item = crud.use_item(db, item_id, amount)

    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    if item == "invalid_amount":
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    if item == "not_enough_quantity":
        raise HTTPException(status_code=400, detail="Not enough quantity")

    crud.create_audit_log(
        db,
        username=current_user.username,
        action="USE_ITEM",
        item_id=item.id,
        details=f"Used {amount} of {item.item_name}",
    )

    return item

@app.post("/items/{item_id}/restock", response_model=schemas.ItemResponse)
def restock_item(
    item_id: str,
    amount: int = Query(..., gt = 0),
    db: Session = Depends(get_db),
    current_user = Depends(auth.require_role("admin")),
):
    item = crud.restock_item(db, item_id, amount)

    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    if item == "invalid_amount":
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    crud.create_audit_log(
        db,
        username=current_user.username,
        action="RESTOCK_ITEM",
        item_id=item.id,
        details=f"Restocked {amount} of {item.item_name}",
    )

    return item

@app.put("/items/{item_id}", response_model = schemas.ItemResponse)
def update_item(
    item_id: str,
    item_data: schemas.ItemUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(auth.require_role("admin")),
):
    item = crud.update_item(db, item_id, item_data)
    if item is None:
        raise HTTPException(status_code=404, detail = "Item not found")
    
    crud.create_audit_log(
        db,
        username = current_user.username,
        action = "UPDATE_ITEM",
        item_id = item.id,
        details = f"Updated item {item.item_name}",
    )

    return item

@app.get("/items/", response_model=list[schemas.ItemResponse])
def get_items(
    name: str | None = None,
    storage_id: str | None = None,
    expiring_before: date | None = None,
    status: str | None = None,
    category: str | None = None,
    shelf_num: str | None = None,
    db: Session = Depends(get_db),
    current_user = Depends(auth.get_current_user),
):
    return crud.get_items_filtered(
        db,
        name=name,
        storage_id=storage_id,
        expiring_before=expiring_before,
        status = status
    )

@app.get("/items/{item_id}", response_model=schemas.ItemResponse)
def get_item(item_id: str, db: Session = Depends(get_db), current_user = Depends(auth.get_current_user)):
    item = crud.get_item(db, item_id)

    if item is None:
        raise HTTPException(status_code = 404, detail = "Item not found")
    
    return item

@app.delete("/items/{item_id}", response_model=schemas.ItemResponse)
def delete_item(item_id: str, db: Session = Depends(get_db), current_user = Depends(auth.require_role("admin")),):
    item = crud.delete_item(db, item_id)

    if item is None:
        raise HTTPException(status_code = 404, detail = "Item not found")
    
    crud.create_audit_log(
        db,
        username = current_user.username,
        action = "DELETE_ITEM",
        item_id = item.id,
        details = f"Deleted item {item.item_name}",
    )

    return item

@app.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    user_count = db.query(models.User).count()

    if user_count > 0:
        raise HTTPException(
            status_code=403,
            detail="Registration disabled. Ask an admin to create your account.",
        )

    user.role = "admin"

    return crud.create_user(db, user)

@app.post("/users/", response_model=schemas.UserResponse)
def create_user_by_admin(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user = Depends(auth.require_role("admin")),
):
    existing = crud.get_user(db, user.username)

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Username already exists",
        )

    return crud.create_user(db, user)

@app.get("/users/", response_model=list[schemas.UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user=Depends(auth.require_role("admin")),
):
    return crud.get_users(db)

@app.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(auth.require_role("admin")),
):
    if current_user.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account while logged in",
        )

    deleted_user = crud.delete_user(db, user_id)

    if deleted_user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return Response(status_code=204)

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):

    auth_user = crud.authenticate_user(db, form_data.username, form_data.password)

    if not auth_user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = auth.create_access_token(
        data = {"sub": auth_user.username}
    )

    return {"access_token": token, "token_type": "bearer",}

@app.get("/audit-logs/", response_model= list[schemas.AuditLogResponse])
def get_audit_logs(
    db: Session = Depends(get_db),
    current_user = Depends(auth.require_role("admin")),
):
    return crud.get_audit_logs(db)

@app.get("/items/low-stock/", response_model=list[schemas.ItemResponse])
def get_low_stock_items(
    db: Session = Depends(get_db),
    current_user = Depends(auth.get_current_user),
):
    return crud.get_low_stock_items(db)

@app.get("/me", response_model=schemas.UserResponse)
def read_me(current_user = Depends(auth.get_current_user)):
    return current_user

@app.get("/dashboard", response_model=schemas.DashBoardStats)
def dashboard(
    db: Session = Depends(get_db),
    current_user = Depends(auth.get_current_user),
):
    return crud.get_dashboard_stats(db)

@app.post("/items/{item_id}/transactions", response_model=schemas.ItemResponse)
def create_item_transaction(
    item_id: str,
    transaction: schemas.ItemTransactionCreate,
    db: Session = Depends(get_db),
    current_user = Depends(auth.get_current_user),
):
    if transaction.type == "use":
        if current_user.role not in ["admin", "user"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif transaction.type == "restock":
        if current_user.role not in ["admin"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        raise HTTPException(status_code=400, detail="Invalid transaction type")
    
    item = crud.apply_item_transaction(
        db, item_id, transaction, current_user.username,
    )

    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item == "invalid amount":
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    
    if item == "not enough quantity":
        raise HTTPException(status_code=400, detail="Not enough quantity")
    
    return item

@app.get("/orders/", response_model=list[schemas.OrderResponse])
def list_orders(
    db: Session = Depends(get_db),
    current_user=Depends(auth.require_role("admin")),
):
    return crud.get_orders(db)


@app.post("/orders/", response_model=schemas.OrderResponse)
def create_order(
    order: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(auth.require_role("admin")),
):
    return crud.create_order(db, order)


@app.post("/orders/import", response_model=list[schemas.OrderResponse])
async def import_orders(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(auth.require_role("admin")),
):
    filename = file.filename or ""

    if not filename.endswith((".xlsx", ".xlsm")):
        raise HTTPException(
            status_code=400,
            detail="Please upload an .xlsx file",
        )

    content = await file.read()
    workbook = load_workbook(BytesIO(content), data_only=True)
    sheet = workbook.active

    rows = list(sheet.iter_rows(values_only=True))

    if not rows:
        return []

    headers = rows[0]
    field_indexes = {}

    for index, header in enumerate(headers):
        normalized = normalize_header(header)
        field_name = HEADER_ALIASES.get(normalized)

        if field_name:
            field_indexes[field_name] = index

    if "item_name" not in field_indexes:
        raise HTTPException(
            status_code=400,
            detail="Excel file must include an Item Name column",
        )

    created_orders = []

    for row in rows[1:]:
        if all(value in (None, "") for value in row):
            continue

        def value_for(field_name):
            index = field_indexes.get(field_name)

            if index is None or index >= len(row):
                return None

            return row[index]
        item_name = clean_string(value_for("item_name"))

        if not item_name:
            continue
        
        order_placed_by = clean_string(value_for("order_placed_by"))
        vendor = clean_string(value_for("vendor"))
        category = clean_string(value_for("category"))
        catalog_no = clean_string(value_for("catalog_no"))

        has_real_order_identifier = any(
            [
                order_placed_by,
                vendor,
                category,
                catalog_no,
            ]
        )

        if not has_real_order_identifier:
            continue

        raw_payload = {
            "order_date": parse_date(value_for("order_date")),
            "order_placed_by": order_placed_by,
            "po_number": clean_string(value_for("po_number")),
            "vendor": vendor,
            "category": category,
            "catalog_no": catalog_no,
            "item_name": item_name,
            "units_ordered": parse_int(value_for("units_ordered")),
            "price_per_unit": parse_float(value_for("price_per_unit")),
            "total_price": parse_float(value_for("total_price")),
            "final_price": parse_float(value_for("final_price")),
            "availability": clean_string(value_for("availability")),
            "expected_delivery_date": parse_date(value_for("expected_delivery_date")),
            "order_number": clean_string(value_for("order_number")),
            "delivery_date": parse_date(value_for("delivery_date")),
            "status": clean_string(value_for("status")) or "Ordered",
            "received_by": clean_string(value_for("received_by")),
            "date_paid": parse_date(value_for("date_paid")),
            "amount_paid": parse_float(value_for("amount_paid")),
            "cc_invoice": clean_string(value_for("cc_invoice")),
        }

        if is_service_order(raw_payload):
            continue

        payload = schemas.OrderCreate(**raw_payload)

        created_orders.append(crud.create_order(db, payload))

    return created_orders


@app.get("/orders/export")
def export_orders(
    ids: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(auth.require_role("admin")),
):
    if ids:
        try:
            order_ids = [int(value) for value in ids.split(",") if value.strip()]
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="ids must be comma-separated integers",
            )

        orders = crud.get_orders_by_ids(db, order_ids)
    else:
        orders = crud.get_orders(db)

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Orders"

    sheet.append([label for label, _field in ORDER_COLUMNS])

    for order in orders:
        sheet.append(order_to_excel_row(order))

    output = BytesIO()
    workbook.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="orders.xlsx"'
        },
    )