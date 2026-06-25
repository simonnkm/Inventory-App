from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import Base, engine, SessionLocal
from datetime import datetime, timedelta, timezone, date
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt
import models
import schemas
import crud
import auth

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.post("/items/{item_id}/use")
def use_item(
    item_id: int,
    amount: int,
    db: Session = Depends(get_db),
    current_user = Depends(auth.require_role("admin", "user")),
):
    item = crud.get_item(db, item_id)

    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.quantity < amount:
        raise HTTPException(status_code=400, detail="Not enough quantity")

    item.quantity -= amount
    db.commit()
    db.refresh(item)

    crud.create_audit_log(
        db,
        username=current_user.username,
        action="USE_ITEM",
        item_id=item.id,
        details=f"Used {amount} of {item.item_name}",
    )

    return item

@app.post("/items/{item_id}/restock")
def restock_item(
    item_id: int,
    amount: int,
    db: Session = Depends(get_db),
    current_user = Depends(auth.require_role("admin"))
):
    item = crud.get_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    item.quantity += amount
    db.commit()
    db.refresh(item)
    crud.create_audit_log(
        db, username= current_user.username,
        action = "RESTOCK_ITEM",
        item_id = item.id,
        details = f"Restocked {amount} of {item.item_name}",
    )
    return item

@app.put("/items/{item_id}", response_model = schemas.ItemResponse)
def update_item(
    item_id: int,
    item_data: schemas.ItemUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(auth.get_current_user),
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
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = crud.get_item(db, item_id)

    if item is None:
        raise HTTPException(status_code = 404, detail = "Item not found")
    
    return item

@app.delete("/items/{item_id}", response_model=schemas.ItemResponse)
def delete_item(item_id: int, db: Session = Depends(get_db), current_user = Depends(auth.get_current_user),):
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

@app.post("/register", response_model = schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = crud.get_user(db, user.username)

    if existing:
        raise HTTPException(
            status_code=400, detail="Username already exists"
        )
    
    return crud.create_user(db, user)


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
    current_user = Depends(auth.get_current_user),
):
    return crud.get_audit_logs(db)

@app.get("/items/low-stock/", response_model=list[schemas.ItemResponse])
def get_low_stock_items(
    db: Session = Depends(get_db),
    current_user = Depends(auth.get_current_user),
):
    return crud.get_low_stock_items(db)