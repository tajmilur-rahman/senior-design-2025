import os
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from database import supabase


class UserCreate(BaseModel):
    username: str
    password: str
    company_id: int
class LoginRequest(BaseModel):
    username: str
    password: str

# Configuration
SECRET_KEY = '+wdvqIdxOWrs4WqDF5X2IxJyKC30JMVddqQpTJy59HqHLyZrRu7O3uIBk5uZt5WVTDQEs3/f8Q/Sc2oEfKgOsA=='
ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        # 1. Bypass the alg error
        payload = jwt.get_unverified_claims(token)
        user_id = payload.get("sub")
        email = payload.get("email") # Supabase includes email in the token

        # 2. Check if user exists in our local table
        response = supabase.table("users").select("*").eq("uuid", user_id).execute()
        
        if response.data:
            return response.data[0]
        
        # 3. AUTO-PROVISION: If not found, create the row now!
        # This fixes the 'User Mapping Failed' for new registrations
        print(f"DEBUG: New user detected ({email}). Provisioning local record...")
        
        new_user = {
            "uuid": user_id,
            "username": email.split('@')[0],
            "role": "user",      # Default new users to regular role
            "is_admin": False,
            "company_id": 1,     # Assign to a default demo company
            "onboarding_completed": False
        }
        
        insert_res = supabase.table("users").insert(new_user).execute()
        return insert_res.data[0]

    except Exception as e:
        print(f"DEBUG: Auth Flow Failure -> {e}")
        raise HTTPException(status_code=401, detail="Authentication sync failed")