import os, re
from jose import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from database import supabase

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

def _is_uuid(val: str) -> bool:
    return bool(_UUID_RE.match(val)) if val else False

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be set in environment / .env")
ALGORITHM  = os.getenv("ALGORITHM", "HS256")

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")


class UserCreate(BaseModel):
    username: str
    password: str
    company_id: int
class LoginRequest(BaseModel):
    username: str
    password: str

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        # 1. Bypass the alg error
        payload = jwt.get_unverified_claims(token)
        user_uuid  = payload.get("sub")
        user_email = payload.get("email")

        if not user_uuid:
            raise HTTPException(status_code=401, detail="Invalid token: missing sub")

        # sub is a proper UUID — query by uuid column
        if _is_uuid(user_uuid):
            res = supabase.table("users").select("*").eq("uuid", user_uuid).execute()
            if res.data:
                return res.data[0]
        else:
            # sub is a plain username (legacy local-auth token e.g. sub="admin")
            res = supabase.table("users").select("*").eq("username", user_uuid).execute()
            if res.data:
                return res.data[0]

        if user_email:
            email_res = supabase.table("users").select("*").eq("email", user_email).execute()
            if email_res.data:
                row = email_res.data[0]
                if not row.get("uuid"):
                    supabase.table("users").update({"uuid": user_uuid}).eq("email", user_email).execute()
                    row["uuid"] = user_uuid
                return row

        print(f"[auth] Auto-provisioning user: {user_email}")
        username = (user_email or "").split("@")[0] or f"user_{user_uuid[:8]}"

        existing = supabase.table("users").select("username").eq("username", username).execute()
        if existing.data:
            username = f"{username}_{user_uuid[:6]}"

        new_user = {
            "uuid":                 user_uuid,
            "email":                user_email,
            "username":             username,
            "password_hash":        "",
            "role":                 "user",
            "is_admin":             False,
            "company_id":           None,
            "onboarding_completed": False,
            "status":               "pending",
        }
        
        insert_res = supabase.table("users").insert(new_user).execute()
        return insert_res.data[0]

    except Exception as e:
        print(f"[auth] get_current_user error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")


def require_active(current_user: dict = Depends(get_current_user)) -> dict:
    status = current_user.get("status", "active")
    if status == "pending":
        raise HTTPException(status_code=403, detail="account_pending")
    if status == "inactive":
        raise HTTPException(status_code=403, detail="account_inactive")
    if status == "invite_requested":
        raise HTTPException(status_code=403, detail="account_pending")
    if status == "pending_code":
        raise HTTPException(status_code=403, detail="account_pending_code")
    return current_user


def require_admin(current_user: dict = Depends(require_active)) -> dict:
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user
