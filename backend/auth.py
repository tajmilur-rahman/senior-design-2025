import os, re, logging, time, urllib.request, json as _json
from jose import jwt, jwk
from jose.exceptions import JWTError

logger = logging.getLogger(__name__)
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from database import supabase

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

def _is_uuid(val: str) -> bool:
    return bool(_UUID_RE.match(val)) if val else False

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be set in environment / .env")

ALGORITHM = os.getenv("ALGORITHM", "HS256")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
# Legacy HS256 shared secret — only needed if your project still uses the old key.
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

# JWKS cache: { "keys": [...], "fetched_at": float }
_jwks_cache: dict = {}
_JWKS_TTL = 3600  # re-fetch every hour

def _get_jwks() -> list:
    now = time.time()
    if _jwks_cache.get("keys") and now - _jwks_cache.get("fetched_at", 0) < _JWKS_TTL:
        return _jwks_cache["keys"]
    try:
        url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        with urllib.request.urlopen(url, timeout=5) as r:
            data = _json.loads(r.read())
        _jwks_cache["keys"] = data.get("keys", [])
        _jwks_cache["fetched_at"] = now
        logger.info("[auth] JWKS refreshed (%d keys)", len(_jwks_cache["keys"]))
        return _jwks_cache["keys"]
    except Exception as e:
        logger.warning("[auth] JWKS fetch failed: %s", e)
        return _jwks_cache.get("keys", [])

def _decode_token(token: str) -> dict:
    """
    Verification order:
      1. ECC P-256 (ES256) via Supabase JWKS — current key type
      2. Legacy HS256 shared secret (SUPABASE_JWT_SECRET) — previous key type
      3. Internal SECRET_KEY HS256 — locally-issued tokens
    """
    # 1. Try JWKS (handles ES256 and any future asymmetric key)
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        alg = header.get("alg", "ES256")
        keys = _get_jwks()
        for key_data in keys:
            if kid and key_data.get("kid") != kid:
                continue
            try:
                public_key = jwk.construct(key_data)
                return jwt.decode(token, public_key, algorithms=[alg],
                                  options={"verify_aud": False})
            except Exception:
                continue
    except Exception:
        pass

    # 2. Legacy HS256 Supabase shared secret
    if SUPABASE_JWT_SECRET:
        try:
            return jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"],
                              options={"verify_aud": False})
        except Exception:
            pass

    # 3. Internal SECRET_KEY
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"],
                      options={"verify_aud": False})


pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")


class UserCreate:
    username: str
    password: str
    company_id: int

class LoginRequest:
    username: str
    password: str

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload    = _decode_token(token)
        user_uuid  = payload.get("sub")
        user_email = payload.get("email")

        if not user_uuid:
            raise HTTPException(status_code=401, detail="Invalid token: missing sub")

        if _is_uuid(user_uuid):
            res = supabase.table("users").select("*").eq("uuid", user_uuid).execute()
            if res.data:
                return res.data[0]
        else:
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

        logger.info("[auth] Auto-provisioning user: %s", user_email)
        username = (user_email or "").split("@")[0] or f"user_{user_uuid[:8]}"
        existing = supabase.table("users").select("username").eq("username", username).execute()
        if existing.data:
            username = f"{username}_{user_uuid[:6]}"

        insert_res = supabase.table("users").insert({
            "uuid":                 user_uuid,
            "email":                user_email,
            "username":             username,
            "password_hash":        "",
            "role":                 "user",
            "is_admin":             False,
            "company_id":           None,
            "onboarding_completed": False,
            "status":               "pending",
        }).execute()
        return insert_res.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.warning("[auth] get_current_user error: %s", e)
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
        user_uuid = current_user.get("uuid")
        if user_uuid:
            supabase.table("users").update({"status": "active"}).eq("uuid", user_uuid).execute()
            current_user["status"] = "active"
            status = "active"
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


def require_developer_or_above(current_user: dict = Depends(require_active)) -> dict:
    if current_user.get("role") not in ("super_admin", "developer"):
        raise HTTPException(status_code=403, detail="Developer access required")
    return current_user
