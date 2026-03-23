import os
from jose import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from database import supabase

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY = '+wdvqIdxOWrs4WqDF5X2IxJyKC30JMVddqQpTJy59HqHLyZrRu7O3uIBk5uZt5WVTDQEs3/f8Q/Sc2oEfKgOsA=='
ALGORITHM  = "HS256"

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")


# ── Pydantic models ───────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username:   str
    password:   str
    company_id: int

class LoginRequest(BaseModel):
    username: str
    password: str


# ── Helpers ───────────────────────────────────────────────────────────────────
def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# ── Core auth dependency ──────────────────────────────────────────────────────
def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:

    try:
        payload = jwt.get_unverified_claims(token)
        user_uuid  = payload.get("sub")    # Supabase Auth UUID
        user_email = payload.get("email")  # included by Supabase

        if not user_uuid:
            raise HTTPException(status_code=401, detail="Invalid token: missing sub")

        # Look up by uuid (the Supabase Auth user ID)
        res = supabase.table("users").select("*").eq("uuid", user_uuid).execute()

        if res.data:
            return res.data[0]

        # ── Check by email first (handles pre-invited users) ──────────────────
        # Admins can pre-create rows with an email but no UUID yet.
        # When the invited user signs up, we link their UUID to that row.
        if user_email:
            email_res = supabase.table("users").select("*").eq("email", user_email).execute()
            if email_res.data:
                row = email_res.data[0]
                if not row.get("uuid"):
                    # Link the UUID to the pre-invited row
                    supabase.table("users").update({"uuid": user_uuid}).eq("email", user_email).execute()
                    row["uuid"] = user_uuid
                return row

        # ── Auto-provision ────────────────────────────────────────────────────
        # New Supabase Auth user signed up but doesn't have a users row yet.
        # We create one with a safe default. The onboarding flow will assign
        # them to a real company and set their role properly.
        print(f"[auth] Auto-provisioning user: {user_email}")

        username = (user_email or "").split("@")[0] or f"user_{user_uuid[:8]}"

        # Make username unique if it already exists
        existing = supabase.table("users").select("username").eq("username", username).execute()
        if existing.data:
            username = f"{username}_{user_uuid[:6]}"

        new_user = {
            "uuid":                 user_uuid,
            "email":                user_email,
            "username":             username,
            "password_hash":        "",        # Supabase Auth handles auth — no local password needed
            "role":                 "user",    # default; onboarding will set properly
            "is_admin":             False,
            "company_id":           None,      # NULL until onboarding assigns a company
            "onboarding_completed": False,
            "status":               "pending", # must be approved by Super Admin
        }

        insert_res = supabase.table("users").insert(new_user).execute()
        if insert_res.data:
            return insert_res.data[0]

        raise HTTPException(status_code=500, detail="Failed to provision user record")

    except HTTPException:
        raise
    except Exception as e:
        print(f"[auth] get_current_user error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")


def require_active(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency: blocks pending or inactive accounts from accessing data."""
    status = current_user.get("status", "active")
    if status == "pending":
        raise HTTPException(status_code=403, detail="account_pending")
    if status == "inactive":
        raise HTTPException(status_code=403, detail="account_inactive")
    return current_user


def require_admin(current_user: dict = Depends(require_active)) -> dict:
    """Dependency: allows active admin and super_admin."""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency: allows only super_admin.
    Does NOT enforce require_active so super admin can always access approval endpoints.
    """
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user