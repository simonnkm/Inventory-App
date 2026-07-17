import os
from datetime import datetime, timedelta, timezone
from database import SessionLocal
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

import crud
import database

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    if os.getenv("VERCEL"):
        raise RuntimeError("SECRET_KEY is missing in Vercel environment variables")

    SECRET_KEY = "local-development-secret-key"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/login')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes = ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally: 
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db),):
    credentials_exception = HTTPException(status_code=401,
                                           detail= "Could not validate credentials",
                                           headers = {"WWW-Authenticate": "Bearer"},)

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")

        if username is None:
            raise credentials_exception
        
    except JWTError:
        raise credentials_exception
    
    user = crud.get_user(db, username=username)

    if user is None: 
        raise credentials_exception
    return user

def require_role(*allowed_roles):
    def role_checker(current_user = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Not enough permissions",
            )
        return current_user
    return role_checker
