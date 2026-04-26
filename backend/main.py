from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import os, joblib, pandas as pd, io, csv, re, json, asyncio, shutil, base64
import auth
import threading
import time as _time
import uuid as uuid_lib
import requests as http_requests
from datetime import datetime, timezone
from database import supabase, SUPABASE_URL, SUPABASE_KEY, DATABASE_URL

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
import psycopg2
import ml_logic
from config import META, FLAGS, ART_RF, get_artifact_paths, company_model_exists
import db_provision


_training_progress: dict = {}

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "rf_model.pkl")
VECTOR_PATH= os.path.join(BASE_DIR, "tfidf_vectorizer.pkl")

rf_model   = None
vectorizer = None

def load_models():
    global rf_model, vectorizer
    try:
        if os.path.exists(MODEL_PATH) and os.path.exists(VECTOR_PATH):
            rf_model   = joblib.load(MODEL_PATH)
            vectorizer = joblib.load(VECTOR_PATH)
            print("[ml] Models loaded.")
        else:
            print("[ml] Model files not found — training required.")
    except Exception as e:
        print(f"[ml] Load error: {e}")

app = FastAPI()
load_models()

_allowed_origins = [o.strip().rstrip("/") for o in FRONTEND_URL.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def validate_company_name(name: str) -> str:
    name = name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Company name is too short (minimum 2 characters)")
    if len(name) > 80:
        raise HTTPException(status_code=400, detail="Company name is too long (maximum 80 characters)")
    if re.search(r'[<>"\';&|`\\{}]', name):
        raise HTTPException(status_code=400, detail="Company name contains invalid characters")
    if re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', name):
        raise HTTPException(status_code=400, detail="Company name cannot be an email address")
    return name


def get_company_table(company_id) -> str:
    if company_id is None:
        return "bugs"
    try:
        res = supabase.table("companies").select("data_table, name") \
                      .eq("id", company_id).single().execute()
        if res.data:
            dt = res.data.get("data_table")
            if dt:
                return dt
            # data_table not set — derive from company name as fallback
            name = (res.data.get("name") or "").strip().lower()
            if "firefox" in name or "mozilla" in name:
                return "firefox_table"
        return "bugs"
    except Exception:
        return "bugs"

def is_shared_table(table: str) -> bool:
    """
    Returns True when the table is isolated by name (not by company_id column).
    Only the shared 'bugs' table uses company_id for multi-tenant filtering.
    All other tables (firefox_table, acme_corp_bugs, etc.) are isolated by table.
    """
    return table != "bugs"


def _normalize_company_id(raw_company_id):
    if raw_company_id in (None, "None", ""):
        return None
    try:
        return int(raw_company_id)
    except (TypeError, ValueError):
        return None


def _infer_component_from_summary(summary: str) -> str:
    text = (summary or "").lower()
    if not text:
        return "General"

    rules = [
        ("Security", ["security", "vulnerability", "xss", "csrf", "sql injection", "auth bypass", "unauthorized", "token leak"]),
        ("Authentication", ["login", "logout", "signin", "sign in", "signup", "password", "oauth", "mfa", "session", "jwt", "sso"]),
        ("Database", ["database", "db", "sql", "postgres", "query", "migration", "deadlock", "constraint", "connection pool"]),
        ("API", ["api", "endpoint", "request", "response", "http", "rest", "graphql", "timeout", "500", "404"]),
        ("Networking", ["network", "dns", "socket", "latency", "packet", "proxy", "gateway", "tls", "ssl"]),
        ("Frontend", ["ui", "frontend", "layout", "css", "button", "modal", "dropdown", "render", "react", "page"]),
        ("Performance", ["slow", "performance", "lag", "latency spike", "high cpu", "memory leak", "throughput", "optimize"]),
        ("Crash", ["crash", "freeze", "hang", "segfault", "panic", "fatal", "unresponsive"]),
        ("Data Processing", ["import", "export", "csv", "json", "parser", "transform", "etl", "batch"]),
    ]

    for component_name, keywords in rules:
        if any(k in text for k in keywords):
            return component_name
    return "General"


def _all_active_data_tables() -> list:
    """Return every unique company data table, always including 'bugs', never 'firefox_table'."""
    try:
        res = supabase.table("companies").select("data_table").execute()
        seen = {"firefox_table"}
        tables = ["bugs"]
        seen.add("bugs")
        for co in (res.data or []):
            dt = co.get("data_table")
            if dt and dt not in seen:
                seen.add(dt)
                tables.append(dt)
        return tables
    except Exception:
        return ["bugs"]


def _gen_invite_code() -> str:
    """Generate a unique 8-char invite code."""
    code = uuid_lib.uuid4().hex[:8].upper()
    for _ in range(5):
        if not supabase.table("companies").select("id").eq("invite_code", code).execute().data:
            break
        code = uuid_lib.uuid4().hex[:8].upper()
    return code


def _admin_get_user(user_uuid: str, current_user: dict, fields: str = "*"):
    """Fetch a user row scoped by role (super_admin sees all, admin sees own company)."""
    cid = current_user.get("company_id")
    q = supabase.table("users").select(fields).eq("uuid", user_uuid)
    if current_user.get("role") != "super_admin":
        q = q.eq("company_id", cid)
    return q.execute()


class BugPayload(BaseModel):
    summary:    str = Field(..., min_length=1, max_length=2000)
    component:  str = "General"
    severity:   str = "S3"
    status:     str = "NEW"
    company_id: int | None = None

class CompanyCreate(BaseModel):
    name: str

class RegisterRequest(BaseModel):
    company_name: str
    username:     str
    email:        str
    uuid:         str
    role:         str = "user"
    invite_code:  str = ""
    password:     str = ""

class OnboardingRequest(BaseModel):
    company_name: str
    username:     str

class FeedbackPayload(BaseModel):
    summary:              str = Field(..., min_length=1, max_length=2000)
    predicted_severity:   str = Field(..., pattern=r"^S[1-4]$")
    actual_severity:      str = Field(..., pattern=r"^S[1-4]$")
    confidence:           float = 0.0
    component:            str = "General"
    consent_global_model: bool = True

class ResolutionSearchRequest(BaseModel):
    summary:           str
    resolution_filter: str | None = None
    component_filter:  str | None = None
    severity_filter:   str | None = None
    min_days:          int | None = None
    max_days:          int | None = None


@app.post("/api/register")
def register(req: RegisterRequest):
    role = req.role if req.role in ("user", "admin") else "user"

    def _check_existing(field, value):
        res = supabase.table("users").select("*").eq(field, value).execute()
        if not res.data:
            return None
        row = res.data[0]
        if row.get("company_id") is not None:
            co = supabase.table("companies").select("name").eq("id", row["company_id"]).single().execute()
            return {
                "message":      "Already registered",
                "company_id":   row.get("company_id"),
                "company_name": co.data.get("name") if co.data else "",
                "role":         row.get("role"),
            }
        supabase.table("users").delete().eq(field, value).execute()
        return False

    db_uuid = req.uuid if req.uuid else str(uuid_lib.uuid4())

    for field, value in [("uuid", db_uuid), ("email", req.email)]:
        result = _check_existing(field, value)
        if result:
            return result

    existing_uname = supabase.table("users").select("username").eq("username", req.username).execute()
    if existing_uname.data:
        raise HTTPException(status_code=400, detail="Username already taken")

    if role == "admin":
        req.company_name = validate_company_name(req.company_name)
        existing_co = supabase.table("companies").select("id, name").eq("name", req.company_name).execute()
        
        is_new_company = False
        if existing_co.data:
            company_id   = existing_co.data[0]["id"]
            company_name = existing_co.data[0]["name"]
        else:
            is_new_company = True
            invite_code = _gen_invite_code()

            co_res = supabase.table("companies").insert({
                "name":        req.company_name,
                "data_table":  "bugs",
                "invite_code": invite_code,
                "status":      "pending",
            }).execute()
            if not co_res.data:
                raise HTTPException(status_code=500, detail="Failed to create company")
            company_id   = co_res.data[0]["id"]
            company_name = co_res.data[0]["name"]

            # Firefox/Mozilla companies share the existing firefox_table — never create a duplicate
            if db_provision.is_firefox_company(company_name):
                supabase.table("companies").update({"data_table": "firefox_table"}).eq("id", company_id).execute()
                print(f"[register] Firefox company — pointing to firefox_table (no new table created)")
            else:
                try:
                    table_name = db_provision.create_company_table(company_id, company_name)
                    print(f"[register] Created company table: {table_name}")
                    supabase.table("companies").update({"data_table": table_name}).eq("id", company_id).execute()
                except Exception as tbl_err:
                    print(f"[register] Warning: could not create company table: {tbl_err}")

        # Temporarily store the registration password so approval can set it on the
        # Supabase Auth account after invite_user_by_email creates it.
        pw_store = "plain:" + base64.b64encode(req.password.encode()).decode() if req.password else ""

        user_res = supabase.table("users").insert({
            "uuid":                 db_uuid,
            "email":                req.email,
            "username":             req.username,
            "password_hash":        pw_store,
            "role":                 "admin",
            "is_admin":             True,
            "company_id":           company_id,
            "onboarding_completed": not is_new_company,
            "status":               "pending",
        }).execute()

        if not user_res.data:
            raise HTTPException(status_code=500, detail="Failed to create user record")

        return {
            "message":      "Registration successful",
            "company_id":   company_id,
            "company_name": company_name,
            "username":     req.username,
            "role":         "admin",
        }

    if not req.invite_code or not req.invite_code.strip():
        raise HTTPException(
            status_code=400,
            detail="An invite code is required to join a company. Ask your company admin for the code."
        )

    code_upper = req.invite_code.strip().upper()
    co_res = supabase.table("companies").select("id, name").eq("invite_code", code_upper).execute()
    if not co_res.data:
        raise HTTPException(
            status_code=400,
            detail="Invalid invite code. Please check the code with your admin and try again."
        )

    company_id   = co_res.data[0]["id"]
    company_name = co_res.data[0]["name"]

    pw_hash = auth.get_password_hash(req.password) if req.password else ""
    user_res = supabase.table("users").insert({
        "uuid":                 db_uuid,
        "email":                req.email,
        "username":             req.username,
        "password_hash":        pw_hash,
        "role":                 "user",
        "is_admin":             False,
        "company_id":           company_id,
        "onboarding_completed": True,
        "status":               "active",
    }).execute()

    if not user_res.data:
        raise HTTPException(status_code=500, detail="Failed to create user record")

    return {
        "message":      "Registration successful",
        "company_id":   company_id,
        "company_name": company_name,
        "username":     req.username,
        "role":         "user",
    }


@app.post("/api/onboarding/complete")
def complete_onboarding(req: OnboardingRequest, current_user: dict = Depends(auth.get_current_user)):
    uuid = current_user.get("uuid")
    req.company_name = validate_company_name(req.company_name)

    existing = supabase.table("companies").select("id").eq("name", req.company_name).execute()
    if existing.data:
        company_id = existing.data[0]["id"]
    else:
        invite_code = _gen_invite_code()
        co_res = supabase.table("companies").insert({
            "name":        req.company_name,
            "data_table":  "bugs",
            "invite_code": invite_code,
        }).execute()
        if not co_res.data:
            raise HTTPException(status_code=500, detail="Failed to create company")
        company_id = co_res.data[0]["id"]
        # Firefox/Mozilla companies share the existing firefox_table — no new table needed
        if db_provision.is_firefox_company(req.company_name):
            supabase.table("companies").update({"data_table": "firefox_table"}).eq("id", company_id).execute()
            print(f"[onboarding] Firefox company — pointing to firefox_table (no new table created)")
        else:
            try:
                table_name = db_provision.create_company_table(company_id, req.company_name)
                supabase.table("companies").update({"data_table": table_name}).eq("id", company_id).execute()
            except Exception as tbl_err:
                print(f"[onboarding] Warning: could not create company table: {tbl_err}")

    supabase.table("users").update({
        "username":             req.username,
        "company_id":           company_id,
        "onboarding_completed": True,
        "role":                 current_user.get("role") or "user",
    }).eq("uuid", uuid).execute()

    updated = supabase.table("users").select("*").eq("uuid", uuid).single().execute()
    return {"message": "Onboarding complete", "user": updated.data}


@app.post("/api/admin/seed_company_data")
def seed_company_data(
    sample_size: int = 5000,
    current_user: dict = Depends(auth.require_admin),
):
    cid = current_user.get("company_id")
    if cid is None:
        raise HTTPException(status_code=400, detail="No company associated with this account")

    co_res = supabase.table("companies").select("data_table, name").eq("id", cid).single().execute()
    if not co_res.data:
        raise HTTPException(status_code=404, detail="Company not found")

    company_name = co_res.data.get("name", "")
    data_table   = co_res.data.get("data_table") or ""

    # Firefox/Mozilla companies always use the shared firefox_table baseline.
    # Ensure the company row points at it so get_company_table is consistent.
    if db_provision.is_firefox_company(company_name) or data_table == "firefox_table":
        if data_table != "firefox_table":
            supabase.table("companies").update({"data_table": "firefox_table"}).eq("id", cid).execute()
        supabase.table("users").update({"onboarding_completed": True}) \
            .eq("uuid", current_user.get("uuid")).execute()
        try:
            count_res = supabase.table("firefox_table").select("*", count="exact").limit(1).execute()
            bug_count = count_res.count or 0
        except Exception:
            bug_count = 0
        return {
            "message": f"Firefox baseline dataset ready — {bug_count:,} bugs available in your dashboard.",
            "table":   "firefox_table",
            "count":   bug_count,
            "already_seeded": True,
        }

    # Regular company — seed into the company-specific table if it exists, else shared bugs
    target_table = data_table if (data_table and data_table not in ("bugs",)) else "bugs"

    try:
        if target_table == "bugs":
            existing_count = supabase.table("bugs").select("*", count="exact") \
                .eq("company_id", cid).limit(1).execute().count or 0
        else:
            existing_count = supabase.table(target_table).select("*", count="exact") \
                .limit(1).execute().count or 0
    except Exception:
        existing_count = 0

    if existing_count > 0:
        supabase.table("users").update({"onboarding_completed": True}) \
            .eq("uuid", current_user.get("uuid")).execute()
        return {
            "message": f"Your database already contains {existing_count:,} bugs — seeding skipped.",
            "table":   target_table,
            "count":   existing_count,
            "already_seeded": True,
        }

    # Pull a sample from the firefox baseline.
    # Component names are intentionally excluded — they are Mozilla-specific taxonomy
    # and would pollute non-Firefox companies' Directory view with irrelevant labels.
    sample = _fetch_paginated("firefox_table", "summary, severity, status",
                              max_rows=sample_size)
    base_row = lambda r: {
        "summary":    r.get("summary", ""),
        "component":  None,           # no Mozilla taxonomy for non-Firefox companies
        "severity":   r.get("severity", "S3"),
        "status":     r.get("status",  "CONFIRMED"),
        "company_id": cid,
    }
    rows = [base_row(r) for r in sample if r.get("summary")]

    inserted = 0
    batch = 500
    for i in range(0, len(rows), batch):
        supabase.table(target_table).insert(rows[i:i + batch]).execute()
        inserted += len(rows[i:i + batch])

    supabase.table("users").update({"onboarding_completed": True}) \
        .eq("uuid", current_user.get("uuid")).execute()
    return {
        "message": f"Seeded {inserted:,} sample bugs into your database.",
        "table":   target_table,
        "count":   inserted,
    }


class UpdateMeRequest(BaseModel):
    username: str | None = None


@app.patch("/api/users/me")
def update_me(req: UpdateMeRequest, current_user: dict = Depends(auth.get_current_user)):
    uuid = current_user.get("uuid")
    if not uuid:
        raise HTTPException(status_code=401, detail="Authentication required")

    if req.username is not None:
        new_name = req.username.strip()
        if len(new_name) < 2:
            raise HTTPException(status_code=400, detail="Display name too short")
        if len(new_name) > 60:
            raise HTTPException(status_code=400, detail="Display name too long")
        existing = supabase.table("users").select("uuid").eq("username", new_name).execute()
        if existing.data and existing.data[0].get("uuid") != uuid:
            raise HTTPException(status_code=400, detail="That display name is already taken")
        supabase.table("users").update({"username": new_name}).eq("uuid", uuid).execute()

    updated = supabase.table("users").select("*").eq("uuid", uuid).single().execute()
    return updated.data


class SyncPasswordHashRequest(BaseModel):
    password: str

@app.post("/api/users/me/sync-password-hash")
def sync_password_hash(req: SyncPasswordHashRequest, current_user: dict = Depends(auth.get_current_user)):
    """Store a bcrypt hash of the user's new password in the users table (called after Supabase Auth update)."""
    uuid = current_user.get("uuid")
    if not uuid:
        raise HTTPException(status_code=401, detail="Authentication required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password too short")
    hashed = auth.get_password_hash(req.password)
    supabase.table("users").update({"password_hash": hashed}).eq("uuid", uuid).execute()
    return {"ok": True}


@app.post("/api/users/me/apply-registration-password")
def apply_registration_password(current_user: dict = Depends(auth.get_current_user)):
    """Called once when an approved user clicks their invite link.
    Applies their stored registration password to Supabase Auth and replaces
    the plain: temp value with a bcrypt hash — no password input from the user needed."""
    uuid      = current_user.get("uuid")
    pw_store  = current_user.get("password_hash", "")

    if not pw_store.startswith("plain:"):
        return {"ok": True, "skipped": True}  # already applied or no reg password

    try:
        reg_password = base64.b64decode(pw_store[6:]).decode()
    except Exception:
        return {"ok": False, "error": "Could not decode stored password"}

    try:
        supabase.auth.admin.update_user_by_id(uuid, {"password": reg_password})
    except Exception as e:
        print(f"[apply-reg-password] update_user_by_id failed: {e}")
        return {"ok": False, "error": str(e)}

    pw_hash = auth.get_password_hash(reg_password)
    supabase.table("users").update({"password_hash": pw_hash}).eq("uuid", uuid).execute()
    print(f"[apply-reg-password] Registration password applied for uuid={uuid}")
    return {"ok": True}


@app.get("/api/users/me/profile")
def get_my_profile(current_user: dict = Depends(auth.get_current_user)):
    uuid = current_user.get("uuid")
    cid  = current_user.get("company_id")
    role = current_user.get("role", "user")

    user_row = supabase.table("users").select("onboarding_completed, status").eq("uuid", uuid).single().execute()
    onboarding_done = user_row.data.get("onboarding_completed", False) if user_row.data else False

    company_name    = None
    has_own_model   = False
    if cid:
        co_res = supabase.table("companies").select("name, has_own_model").eq("id", cid).single().execute()
        if co_res.data:
            company_name  = co_res.data.get("name")
            has_own_model = co_res.data.get("has_own_model", False)

    bug_count = 0
    if role == "super_admin":
        try:
            bug_count = supabase.table("bugs").select("*", count="exact").limit(1).execute().count or 0
        except Exception:
            bug_count = 0
    elif cid:
        try:
            table = get_company_table(cid)
            q = supabase.table(table).select("*", count="exact").limit(1)
            if not is_shared_table(table):
                q = q.eq("company_id", cid)
            bug_count = q.execute().count or 0
        except Exception:
            bug_count = 0

    return {
        "company_name":         company_name,
        "bug_count":            bug_count,
        "onboarding_completed": onboarding_done,
        "has_own_model":        has_own_model,
    }


@app.get("/api/auth/session-check")
def session_check(requested_role: str = "user", current_user: dict = Depends(auth.get_current_user)):
    uuid = current_user.get("uuid")
    db_profile = supabase.table("users").select("role, company_id").eq("uuid", uuid).single().execute()

    if not db_profile.data:
        raise HTTPException(status_code=404, detail="User profile not found")

    true_role = db_profile.data.get("role") or "user"

    if requested_role != true_role and true_role != "super_admin":
        raise HTTPException(status_code=403, detail="Role Mismatch")

    return {
        "status": "ok",
        "role": true_role,
        "effective_role": true_role,
        "company_id": db_profile.data.get("company_id"),
        "is_global": true_role == "super_admin",
    }


@app.get("/api/hub/overview")
def get_overview(current_user: dict = Depends(auth.get_current_user)):
    cid   = current_user.get("company_id")
    role  = current_user.get("role")

    if cid is None and role not in ("super_admin", "developer"):
        return {
            "stats": {"total_db": 0, "analyzed": 0, "critical": 0},
            "recent": [],
            "charts": {"components": []},
            "onboarding_required": True,
        }

    is_super = role in ("super_admin", "developer")
    table = get_company_table(cid) if not is_super else "bugs"

    # Build top-5 component hotspots via real GROUP BY — accurate across entire dataset
    try:
        _conn = psycopg2.connect(DATABASE_URL)
        _cur  = _conn.cursor()
        if is_super:
            _cur.execute(
                "SELECT COALESCE(component,'General'), COUNT(*) FROM bugs "
                "GROUP BY component ORDER BY COUNT(*) DESC LIMIT 5"
            )
        else:
            if is_shared_table(table):
                _cur.execute(
                    f"SELECT COALESCE(component,'General'), COUNT(*) FROM {table} "
                    "GROUP BY component ORDER BY COUNT(*) DESC LIMIT 5"
                )
            else:
                _cur.execute(
                    "SELECT COALESCE(component,'General'), COUNT(*) FROM bugs "
                    "WHERE company_id = %s "
                    "GROUP BY component ORDER BY COUNT(*) DESC LIMIT 5",
                    (cid,)
                )
        top_5 = [{"name": r[0], "value": r[1]} for r in _cur.fetchall()]
        _cur.close(); _conn.close()
    except Exception as _e:
        print(f"[overview hotspots] {_e}")
        top_5 = []

    if is_super:
        # Super admin sees universal counts from the bugs table (source of truth)
        total_count    = supabase.table("bugs").select("*", count="exact").limit(1).execute().count or 0
        critical_count = supabase.table("bugs").select("*", count="exact").eq("severity", "S1").limit(1).execute().count or 0
        all_bugs       = supabase.table("bugs").select("*").order("bug_id", desc=True).limit(20).execute().data or []
    else:
        q_total = supabase.table(table).select("*", count="exact").limit(1)
        if not is_shared_table(table):
            q_total = q_total.eq("company_id", cid)
        total_count = q_total.execute().count or 0

        q_crit = supabase.table(table).select("*", count="exact").eq("severity", "S1").limit(1)
        if not is_shared_table(table):
            q_crit = q_crit.eq("company_id", cid)
        critical_count = q_crit.execute().count or 0

        q_recent = supabase.table(table).select("*").order("bug_id", desc=True).limit(20)
        if not is_shared_table(table):
            q_recent = q_recent.eq("company_id", cid)
        all_bugs = q_recent.execute().data or []

    recent_feed = [
        {"id": b.get("bug_id") or b.get("id"), "summary": b.get("summary"),
         "severity": b.get("severity"), "status": b.get("status")}
        for b in all_bugs[:5]
    ]

    return {
        "stats": {"total_db": total_count, "analyzed": total_count, "critical": critical_count},
        "recent": recent_feed,
        "charts": {"components": top_5},
    }


def _apply_bug_filters(query, search, sev, status, comp, db_sort, sort_dir):
    if search.strip():
        if search.strip().isdigit():
            query = query.eq("bug_id", int(search.strip()))
        else:
            query = query.ilike("summary", f"%{search.strip()}%")
    if sev:    query = query.ilike("severity",  f"%{sev}%")
    if status: query = query.ilike("status",    f"%{status}%")
    if comp:
        comp_list = [c.strip() for c in comp.split(',') if c.strip()]
        if len(comp_list) > 1:
            query = query.in_("component", comp_list)
        else:
            query = query.ilike("component", f"%{comp}%")
    return query.order(db_sort, desc=(sort_dir.lower() == "desc"))


@app.get("/api/hub/explorer")
def get_bugs(
    page: int = 1, limit: int = 10,
    search: str = "", sort_key: str = "id", sort_dir: str = "desc",
    sev: str = "", status: str = "", comp: str = "",
    requested_role: str = "user",
    filter_company_id: int = None,
    current_user: dict = Depends(auth.get_current_user),
):
    true_role = current_user.get("role")
    cid = current_user.get("company_id")

    if cid is None and true_role not in ("super_admin", "developer"):
        return {"total": 0, "role_context": true_role, "bugs": [], "onboarding_required": True}

    db_sort = "bug_id" if sort_key == "id" else sort_key
    offset  = (page - 1) * limit

    if true_role in ("super_admin", "developer"):
        if filter_company_id is not None:
            # Route to the correct table for this specific company
            co_table = get_company_table(filter_company_id)
            query = supabase.table(co_table).select("*", count="exact")
            if not is_shared_table(co_table):
                query = query.eq("company_id", filter_company_id)
        else:
            query = supabase.table("bugs").select("*", count="exact")
        query = _apply_bug_filters(query, search, sev, status, comp, db_sort, sort_dir)
        res   = query.range(offset, offset + limit - 1).execute()

        return {
            "total": res.count or 0,
            "role_context": "super_admin",
            "bugs": [
                {
                    "id":        r.get("bug_id") or r.get("id"),
                    "summary":   r.get("summary"),
                    "component": r.get("component"),
                    "severity":  r.get("severity"),
                    "status":    r.get("status"),
                    "company":   r.get("company_id"),
                }
                for r in (res.data or [])
            ],
        }

    table = get_company_table(cid)
    query = supabase.table(table).select("*", count="exact")
    if not is_shared_table(table):
        query = query.eq("company_id", cid)
    query = _apply_bug_filters(query, search, sev, status, comp, db_sort, sort_dir)
    res   = query.range(offset, offset + limit - 1).execute()

    return {
        "total": res.count or 0,
        "role_context": true_role,
        "bugs": [
            {
                "id":        r.get("bug_id") or r.get("id"),
                "summary":   r.get("summary"),
                "component": r.get("component"),
                "severity":  r.get("severity"),
                "status":    r.get("status"),
                "company":   None,
            }
            for r in (res.data or [])
        ],
    }

@app.get("/api/hub/export")
def export_bugs_csv(
    search: str = "", sort_key: str = "id", sort_dir: str = "desc",
    sev: str = "", status: str = "", comp: str = "",
    current_user: dict = Depends(auth.get_current_user),
):
    cid     = current_user.get("company_id")
    role    = current_user.get("role")

    if cid is None and role != "super_admin":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Summary", "Component", "Severity", "Status"])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=apex_export.csv"},
        )

    db_sort = "bug_id" if sort_key == "id" else sort_key

    if role == "super_admin":
        query = supabase.table("bugs").select("*")
    else:
        table = get_company_table(cid)
        query = supabase.table(table).select("*")
        if not is_shared_table(table):
            query = query.eq("company_id", cid)

    if search: query = query.ilike("summary",   f"%{search}%")
    if sev:    query = query.ilike("severity",  f"%{sev}%")
    if status: query = query.ilike("status",    f"%{status}%")
    if comp:
        comp_list = [c.strip() for c in comp.split(',') if c.strip()]
        if len(comp_list) > 1:
            query = query.in_("component", comp_list)
        else:
            query = query.ilike("component", f"%{comp}%")

    bugs = query.order(db_sort, desc=(sort_dir.lower() == "desc")).limit(10000).execute().data or []

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Summary", "Component", "Severity", "Status"])
    for b in bugs:
        writer.writerow([b.get("bug_id") or b.get("id"), b.get("summary",""),
                         b.get("component",""), b.get("severity",""), b.get("status","")])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=apex_export.csv"},
    )


@app.post("/api/bug")
async def create_bug(request: BugPayload, current_user: dict = Depends(auth.require_active)):
    is_super = current_user.get("role") == "super_admin"

    if is_super:
        if not request.company_id:
            raise HTTPException(status_code=400, detail="Super Admin must specify a company_id for bug creation")
        cid = request.company_id
    else:
        cid = current_user.get("company_id")

    raw_component = (request.component or "").strip()
    component_value = raw_component
    if not raw_component or raw_component.lower() in ("general", "none", "n/a", "na"):
        component_value = _infer_component_from_summary(request.summary)

    table = get_company_table(cid)
    payload = {
        "summary":   request.summary,
        "component": component_value,
        "severity":  request.severity,
        "status":    "NEW",
    }
    if not is_shared_table(table):
        payload["company_id"] = cid

    res = supabase.table(table).insert(payload).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to log bug")
    return res.data


@app.delete("/api/bug/{bug_id}")
async def delete_bug(bug_id: int, current_user: dict = Depends(auth.require_active)):
    cid = current_user.get("company_id")
    table = get_company_table(cid)

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Prefer": "return=representation",
    }
    true_role = current_user.get("role")
    params = {"bug_id": f"eq.{bug_id}"}
    if not is_shared_table(table) and true_role != "super_admin":
        params["company_id"] = f"eq.{cid}"

    resp = http_requests.delete(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=headers,
        params=params,
    )
    print(f"[delete] table={table} bug_id={bug_id} status={resp.status_code} body={resp.text[:200]}")

    if not resp.ok:
        raise HTTPException(status_code=500, detail=f"DB error: {resp.text}")
    if not resp.json():
        raise HTTPException(status_code=404, detail="Bug not found")

    return {"message": "Bug deleted"}


@app.get("/api/analyze_bug")
@app.post("/api/analyze_bug")
async def analyze_bug(
    bug_text:     str = Query(...),
    model_source: str = Query(default="universal"),
    current_user: dict = Depends(auth.require_active),
):
    cid = _normalize_company_id(current_user.get("company_id"))
    try:
        target_cid = cid if model_source == "company" else None
        result = ml_logic.predict_severity(bug_text, company_id=target_cid)
    except Exception as e:
        print(f"[analyze] error: {e}")
        result = {"prediction": "S3", "confidence": 0.6, "diagnosis": "Standard Logic Defect",
                  "team": "🔧 General Maintenance", "keywords": [], "model_source": "global", "fallback": True}

    similar_bugs = ml_logic.find_similar_bugs(bug_text, company_id=cid, top_k=5)

    return {"severity": result, "similar_bugs": similar_bugs}


@app.post("/api/feedback")
async def submit_feedback(req: FeedbackPayload, current_user: dict = Depends(auth.get_current_user)):
    cid = _normalize_company_id(current_user.get("company_id"))
    is_correction = req.predicted_severity != req.actual_severity

    existing = supabase.table("feedback") \
        .select("id") \
        .eq("company_id", cid) \
        .eq("summary", req.summary) \
        .eq("is_correction", False) \
        .is_("actual_severity", "null") \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    if existing.data:
        row_id = existing.data[0]["id"]
        supabase.table("feedback").update({
            "actual_severity":      req.actual_severity,
            "is_correction":        is_correction,
            "consent_global_model": req.consent_global_model,
            "component":            req.component,
        }).eq("id", row_id).execute()
    else:
        supabase.table("feedback").insert({
            "summary":              req.summary,
            "predicted_severity":   req.predicted_severity,
            "actual_severity":      req.actual_severity,
            "confidence":           req.confidence,
            "component":            req.component,
            "company_id":           cid,
            "is_correction":        is_correction,
            "consent_global_model": req.consent_global_model,
        }).execute()

    return {"message": "Feedback recorded", "is_correction": is_correction}

@app.get("/api/hub/ml_metrics")
def get_ml_metrics(
    current_user: dict = Depends(auth.require_admin),
    target_company_id: int | None = Query(default=None),
):
    role = current_user.get("role")
    is_super = role == "super_admin"
    raw_cid = current_user.get("company_id")
    try:
        cid = int(raw_cid) if raw_cid not in (None, "None", "") else None
    except (TypeError, ValueError):
        cid = None

    # Super admin: if a target_company_id is provided, view that company's model.
    # Otherwise fall back to the global/universal model (cid=None).
    if is_super:
        cid = target_company_id  # None = universal, int = specific company

    total_live = 0
    feedback_list = []
    last_trained_str = "Not yet trained"
    company_name = "Universal" if (is_super and cid is None) else "Your Company"

    try:
        table = get_company_table(cid)
        q_bugs = supabase.table(table).select("*", count="exact").limit(1)
        if cid is not None and not is_shared_table(table):
            q_bugs = q_bugs.eq("company_id", cid)
        company_bug_count = q_bugs.execute().count or 0

        fb_q = supabase.table("feedback").select("*").order("created_at", desc=True)
        if cid is not None:
            fb_q = fb_q.eq("company_id", cid)
        fb_res = fb_q.execute()
        feedback_list = fb_res.data or []

        corrections_count = len([f for f in feedback_list if f.get("is_correction")])
        total_live = company_bug_count + corrections_count

        if feedback_list:
            raw = feedback_list[0].get("created_at", "")
            if raw:
                dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                last_trained_str = dt.strftime("%b %d, %I:%M %p")

        if cid is not None:
            co_res = supabase.table("companies").select("name").eq("id", cid).limit(1).execute()
            if co_res.data:
                company_name = co_res.data[0].get("name", company_name)
    except Exception as e:
        print(f"[ml_metrics] DB error: {e}")

    current_metrics = {
        "accuracy": 0.0, "f1_score": 0.0, "precision": 0.0, "recall": 0.0,
        "dataset_size": total_live, "status": "Not Trained",
        "last_trained": last_trained_str, "total_trees": 0,
        "model_source": "none", "model_status": "not_trained",
        "dataset_label": "Not trained", "company_name": company_name,
    }

    # Check company-specific model first
    if cid is not None:
        company_met_path = get_artifact_paths(cid).get("met", "")
        if company_met_path and os.path.exists(company_met_path):
            try:
                with open(company_met_path) as f:
                    saved = json.load(f)
                current_metrics.update({
                    "accuracy":        round(saved.get("accuracy",  0.0), 4),
                    "f1_score":        round(saved.get("f1_score",  0.0), 4),
                    "precision":       round(saved.get("precision", 0.0), 4),
                    "recall":          round(saved.get("recall",    0.0), 4),
                    "last_trained":    saved.get("last_trained", last_trained_str),
                    "total_trees":     saved.get("total_trees", 100),
                    "status":          "Active Build",
                    "model_source":    "company",
                    "model_status":    "ready",
                    "dataset_label":   saved.get("dataset_label", "Company data"),
                    "confusion_matrix": saved.get("confusion_matrix"),
                })
            except Exception:
                pass
    # Fall back to global model metrics only for super admin (cid is None).
    # Company admins must see "No Model Trained" when their own model doesn't exist —
    # the global fallback here would mask the clean-slate state after a reset.
    if current_metrics["model_status"] == "not_trained" and cid is None:
        try:
            met_path = ART_RF.get("met", "")
            pkl_path = ART_RF.get("model", "")
            if met_path and os.path.exists(met_path) and pkl_path and os.path.exists(pkl_path):
                with open(met_path) as f:
                    saved = json.load(f)
                current_metrics.update({
                        "accuracy":        round(saved.get("accuracy",  0.0), 4),
                        "f1_score":        round(saved.get("f1_score",  0.0), 4),
                        "precision":       round(saved.get("precision", 0.0), 4),
                        "recall":          round(saved.get("recall",    0.0), 4),
                    "last_trained":    saved.get("last_trained", last_trained_str),
                        "total_trees":     saved.get("total_trees", 0),
                    "status":          "Active Build",
                    "model_source":    "global",
                    "model_status":    "ready",
                    "dataset_label":   saved.get("dataset_label", "Global training data"),
                    "confusion_matrix": saved.get("confusion_matrix"),
                })
        except Exception:
            pass

    def _read_extra_metrics(filename, fallback):
        base_dir = os.path.dirname(
            get_artifact_paths(cid)["met"] if cid is not None else ART_RF["met"]
        )
        path = os.path.join(base_dir, filename)
        if os.path.exists(path):
            try:
                with open(path) as _f:
                    d = json.load(_f)
                return {
                    **fallback,
                    "accuracy":      round(d.get("accuracy",  fallback["accuracy"]),  4),
                    "f1_score":      round(d.get("f1_score",  fallback["f1_score"]),  4),
                    "precision":     round(d.get("precision", fallback["precision"]), 4),
                    "recall":        round(d.get("recall",    fallback["recall"]),    4),
                    "last_trained":  d.get("last_trained",  fallback.get("last_trained", "—")),
                    "total_trees":   d.get("total_trees",   fallback.get("total_trees", 0)),
                    "dataset_label": d.get("dataset_label", fallback.get("dataset_label", "—")),
                }
            except Exception:
                pass
        return fallback

    baseline_fallback = {**current_metrics, "status": "Main Brain"}
    previous_fallback = {**current_metrics, "status": "Previous Build",
                         "accuracy": 0.0, "f1_score": 0.0, "precision": 0.0, "recall": 0.0,
                         "total_trees": 0, "dataset_label": "No previous build", "last_trained": "—"}

    baseline = _read_extra_metrics("main_brain_metrics.json", baseline_fallback)
    baseline["status"] = "Main Brain"
    previous = _read_extra_metrics("previous_metrics.json", previous_fallback)
    previous["status"] = "Previous Build"

    total_fb = len(feedback_list)
    corrections = [f for f in feedback_list if f.get("is_correction")]
    correction_rate = len(corrections) / total_fb if total_fb > 0 else 0.0

    # Prefer the confusion matrix saved at training time (from full dataset).
    # Fall back to the live feedback-corrections matrix when no trained model exists.
    saved_cm = current_metrics.get("confusion_matrix")
    if saved_cm:
        confusion_matrix = saved_cm
    else:
        labels = ["S1", "S2", "S3", "S4"]
        matrix = {a: {p: 0 for p in labels} for a in labels}
        for f in corrections:
            actual = f.get("actual_severity", "S3")
            pred   = f.get("predicted_severity", "S3")
            if actual in matrix and pred in matrix[actual]:
                matrix[actual][pred] += 1
        confusion_matrix = [{"actual": a, **matrix[a]} for a in labels]

    comp_errors: dict = {}
    comp_total:  dict = {}
    for f in feedback_list:
        c = f.get("component") or "General"
        comp_total[c] = comp_total.get(c, 0) + 1
        if f.get("is_correction"):
            comp_errors[c] = comp_errors.get(c, 0) + 1
    weak = sorted(
        [{"component": c, "error_rate": round(comp_errors.get(c,0)/comp_total[c]*100, 1)}
         for c in comp_total if comp_total[c] >= 3],
        key=lambda x: x["error_rate"], reverse=True
    )[:5]

    return {
        "current":          current_metrics,
        "baseline":         baseline,
        "previous":         previous,
        "confusion_matrix": confusion_matrix,
        "trained_count":    total_live,
        "model_source":     current_metrics.get("model_source", "none"),
        "model_status":     current_metrics.get("model_status", "not_trained"),
        "dataset_label":    current_metrics.get("dataset_label", "Not trained"),
        "company_name":     company_name,
        "feedback_stats": {
            "total_feedback":    len(feedback_list),
            "total_corrections": len(corrections),
            "correction_rate":   round(correction_rate, 4),
            "weak_components":   weak,
        },
    }


@app.post("/api/bulk_submit")
async def bulk_submit(
    file: UploadFile = File(...),
    batch_name: str = "",
    current_user: dict = Depends(auth.require_admin),
):
    """Insert bugs from a CSV/JSON file into the company database. No model training.

    Bulk imports go into the company's primary data_table (per-tenant table preferred).
    firefox_table is never written to — it is the ML baseline only.
    """
    cid = current_user.get("company_id")
    table = get_company_table(cid)

    # Safety: never write into ML baseline.
    if table == "firefox_table":
        table = "bugs"

    content = await file.read()

    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.DataFrame(json.loads(content.decode()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    pre_insert_ts = datetime.now(timezone.utc).isoformat()

    def _parse_bug_id(val):
        # Handles NaN, empty strings, None
        if val is None:
            return None
        # pandas NaN check
        try:
            if pd.isna(val):
                return None
        except Exception:
            pass

        s = str(val).strip()
        if s == "" or s.lower() == "none" or s.lower() == "null":
            return None

        # Allow "12.0" coming from Excel/CSV
        try:
            as_float = float(s)
            as_int = int(as_float)
            if as_float != as_int:
                raise ValueError("bug_id must be an integer")
            return as_int
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid bug_id value: {val}")

    rows = []
    has_bug_id_col = "bug_id" in df.columns

    for _, row in df.iterrows():
        summary_text = str(row.get("summary", "") or "")
        raw_component = str(row.get("component", "") or "").strip()
        component_value = raw_component if raw_component else _infer_component_from_summary(summary_text)

        bug_row = {
            "summary":   summary_text,
            "component": component_value,
            "severity":  str(row.get("severity", "S3")).upper(),
            "status":    str(row.get("status", "PROCESSED")),
        }

        # Persist bug_id if present in upload
        if has_bug_id_col:
            parsed_bug_id = _parse_bug_id(row.get("bug_id"))
            if parsed_bug_id is not None:
                bug_row["bug_id"] = parsed_bug_id

        # Only add company_id when writing to shared table(s) that need scoping by column.
        # NOTE: your `is_shared_table()` naming is confusing (it returns table != "bugs").
        # This preserves your existing behavior but you may want to revisit that function.
        if not is_shared_table(table):
            bug_row["company_id"] = cid

        rows.append(bug_row)

    if rows:
        try:
            supabase.table(table).insert(rows).execute()
        except Exception as e:
            # If bug_id is unique in your schema, duplicates will error here.
            raise HTTPException(status_code=400, detail=f"Insert failed: {e}")

    batch_payload = {
        "batch_name":  batch_name or file.filename,
        "company_id":  cid,
        "bug_count":   len(rows),
        "status":      "imported",
        "upload_time": pre_insert_ts,
    }

    try:
        supabase.table("training_batches").insert(batch_payload).execute()
    except Exception:
        supabase.table("training_batches").insert({
            k: v for k, v in batch_payload.items() if k != "upload_time"
        }).execute()

    try:
        supabase.table("users").update({"onboarding_completed": True}).eq("uuid", current_user.get("uuid")).execute()
    except Exception:
        pass

    return {"message": "Bugs imported successfully", "records_processed": len(rows)}
@app.get("/api/batches")
def get_batches(current_user: dict = Depends(auth.get_current_user)):
    cid = current_user.get("company_id")
    if cid is None:
        return []
    try:
        company_id_int = int(cid)
    except (TypeError, ValueError):
        return []
    res = supabase.table("training_batches").select("*") \
                  .eq("company_id", company_id_int) \
                  .order("upload_time", desc=True).limit(20).execute()
    rows = []
    for r in (res.data or []):
        rows.append({**r, "records_processed": r.get("bug_count", 0)})
    return rows


def _delete_bulk_imported_bugs(cid, since_ts: str) -> int:
    """Delete bulk-imported bugs for a company inserted at or after `since_ts`.

    Deletes from both the shared `bugs` table (company_id + created_at filter)
    and the company's dedicated table if it exists (created_at filter only,
    since company_{id}_bugs is already scoped by table name).
    """
    total = 0
    try:
        res = supabase.table("bugs").delete() \
                      .eq("company_id", cid) \
                      .gte("created_at", since_ts) \
                      .execute()
        total += len(res.data or [])
    except Exception as e:
        print(f"[delete_bulk_imported_bugs] bugs table: {e}")

    company_table = get_company_table(cid)
    if is_shared_table(company_table):
        try:
            res = supabase.table(company_table).delete() \
                          .gte("created_at", since_ts) \
                          .execute()
            total += len(res.data or [])
        except Exception as e:
            print(f"[delete_bulk_imported_bugs] {company_table}: {e}")

    return total


@app.delete("/api/batches")
def delete_all_batches(current_user: dict = Depends(auth.get_current_user)):
    """Delete every batch record and all bugs that were bulk-imported.

    Strategy: find the earliest batch upload_time for this company and delete
    every bug whose created_at >= that timestamp.  Seeded / baseline bugs were
    inserted long before any admin batch upload so they are left untouched.
    Works for both firefox_table (shared, no company_id column) and
    company-specific tables.
    """
    cid = current_user.get("company_id")
    if not cid:
        return {"message": "No company assigned", "batches_deleted": 0, "bugs_deleted": 0}

    batches_res = supabase.table("training_batches").select("upload_time") \
                          .eq("company_id", cid).order("upload_time").execute()
    batches = batches_res.data or []

    from datetime import timedelta
    bugs_deleted = 0
    if batches:
        earliest = batches[0].get("upload_time")
    else:
        # Batch records were already cleared (e.g. by old broken version) but bugs
        # may still be present. Fall back to a 7-day rolling window — the baseline
        # Firefox/seeded data is always much older than that.
        earliest = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    if earliest:
        bugs_deleted = _delete_bulk_imported_bugs(cid, earliest)

    supabase.table("training_batches").delete().eq("company_id", cid).execute()
    return {"message": "All batches deleted", "batches_deleted": len(batches), "bugs_deleted": bugs_deleted}


@app.delete("/api/batches/{batch_id}")
def delete_batch(batch_id: int, current_user: dict = Depends(auth.get_current_user)):
    cid = current_user.get("company_id")

    batch_res = supabase.table("training_batches").select("upload_time") \
                        .eq("id", batch_id).eq("company_id", cid).execute()
    batch = batch_res.data[0] if batch_res.data else None

    bugs_deleted = 0
    if batch:
        upload_time = batch.get("upload_time")
        if upload_time:
            bugs_deleted = _delete_bulk_imported_bugs(cid, upload_time)

    supabase.table("training_batches").delete() \
            .eq("id", batch_id).eq("company_id", cid).execute()

    return {"message": "Batch and bugs deleted", "bugs_deleted": bugs_deleted}


@app.post("/api/admin/table/reset")
def reset_company_table(current_user: dict = Depends(auth.require_admin)):
    """Reset the company's bug database to its original seeded state.

    - Deletes all bulk-imported bugs (always in `bugs` table with company_id).
    - For company-specific tables (company_{id}_bugs): also wipes and re-seeds.
    - Clears all training_batches records for the company.

    Bulk imports always land in the `bugs` table (see bulk_submit), so deletion
    is a simple DELETE WHERE company_id = cid — no timestamp guesswork needed.
    """
    cid = current_user.get("company_id")
    role = current_user.get("role")
    if role == "super_admin" or cid is None:
        raise HTTPException(status_code=400, detail="Super admin does not own a company table.")

    co_res = supabase.table("companies").select("data_table, name").eq("id", cid).single().execute()
    if not co_res.data:
        raise HTTPException(status_code=404, detail="Company not found")

    table = co_res.data.get("data_table") or "bugs"
    bugs_deleted = 0
    reseeded = 0

    # Delete all bugs for this company from the shared bugs table.
    try:
        del_res = supabase.table("bugs").delete().eq("company_id", cid).execute()
        bugs_deleted = len(del_res.data or [])
    except Exception as e:
        print(f"[table/reset] bugs-table delete error: {e}")

    # If the company has a dedicated table, wipe and re-seed it too.
    if table not in ("bugs", "firefox_table"):
        try:
            supabase.table(table).delete().neq("bug_id", 0).execute()
        except Exception as e:
            print(f"[table/reset] company-table delete error: {e}")

        try:
            reseeded = db_provision.seed_company_table(cid, sample_size=5000)
        except Exception as e:
            print(f"[table/reset] re-seed error: {e}")

    msg = f"Reset complete: removed {bugs_deleted} imported bugs, re-seeded {reseeded} sample bugs."

    # Clear all batch records regardless of table type
    supabase.table("training_batches").delete().eq("company_id", cid).execute()

    return {"success": True, "message": msg, "bugs_deleted": bugs_deleted, "reseeded": reseeded}


def _train_upload_in_background(key: str, cid, table: str):
    """Background thread: fetch all company bugs (incl. newly inserted) then train."""
    def cb(step: str, pct: int):
        _training_progress[key] = {"step": step, "pct": pct, "done": False, "error": None}
    try:
        cb("Loading company dataset", 5)
        raw = _fetch_paginated(
            table, "summary, severity",
            eq_filters=None if is_shared_table(table) else [("company_id", cid)],
        )
        records = [
            {"summary": r["summary"], "severity": r.get("severity", "S3")}
            for r in raw if r.get("summary") and r.get("severity")
        ]
        if not records:
            _training_progress[key] = {"step": "Error", "pct": 0, "done": True,
                                        "error": "No labeled bugs found.", "result": None}
            return
        print(f"[upload_train/bg] Training on {len(records):,} company bugs (key={key})")
        result = ml_logic.full_train_from_dataset(records, company_id=cid, progress_cb=cb)
        
        if result and not result.get("success"):
            _training_progress[key] = {"step": "Error", "pct": 0, "done": True, "error": result.get("error", "Training failed."), "result": result}
            return

        cb("Saving model", 95)
        _time.sleep(0.2)
        _training_progress[key] = {"step": "Done", "pct": 100, "done": True, "error": None, "result": result}
    except Exception as e:
        _training_progress[key] = {"step": "Error", "pct": 0, "done": True, "error": str(e), "result": None}


@app.post("/api/upload_and_train")
async def upload_and_train(
    file: UploadFile = File(...),
    batch_name: str = "",
    current_user: dict = Depends(auth.require_admin),
):
    cid = current_user.get("company_id")
    table = get_company_table(cid)
    # firefox_table has a non-serial PK — never write into it directly
    if table == "firefox_table":
        table = "bugs"
    content = await file.read()

    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.DataFrame(json.loads(content.decode()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    records = len(df)

    rows = []
    for _, row in df.iterrows():
        bug_row = {
            "summary":   str(row.get("summary", "")),
            "component": str(row.get("component", "General")),
            "severity":  str(row.get("severity", "S3")).upper(),
            "status":    str(row.get("status", "PROCESSED")),
        }
        if not is_shared_table(table):
            bug_row["company_id"] = cid
        rows.append(bug_row)
    if rows:
        supabase.table(table).insert(rows).execute()

    supabase.table("training_batches").insert({
        "batch_name": batch_name or file.filename,
        "company_id": cid,
        "bug_count":  records,
        "status":     "complete",
    }).execute()

    # Kick off background training — returns immediately so the UI doesn't hang
    key = f"upload_{cid}_{int(_time.time())}"
    _training_progress[key] = {"step": "Initializing", "pct": 0, "done": False, "error": None}
    threading.Thread(target=_train_upload_in_background, args=(key, cid, table), daemon=True).start()

    try:
        supabase.table("users").update({"onboarding_completed": True}).eq("uuid", current_user.get("uuid")).execute()
    except Exception:
        pass

    return {
        "message":           "Upload successful — training started in background.",
        "records_processed": records,
        "key":               key,
        "stream_url":        f"/api/admin/model/train/stream?stream_key={key}",
    }


@app.get("/api/hub/component_counts")
def get_component_counts(current_user: dict = Depends(auth.get_current_user)):
    raw_cid = current_user.get("company_id")
    try:
        cid = int(raw_cid) if raw_cid not in (None, "None", "") else None
    except (TypeError, ValueError):
        cid = None

    is_super = current_user.get("role") == "super_admin"
    table = get_company_table(cid) if not is_super else "bugs"

    counts: dict = {}
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur  = conn.cursor()
        if is_super:
            cur.execute(
                "SELECT COALESCE(component, 'general'), COUNT(*) FROM bugs GROUP BY component"
            )
        else:
            # Company-specific tables (e.g. acme_corp_bugs) are pre-filtered by name.
            # Shared tables (`bugs`, `firefox_table`) must be filtered by company_id.
            if table in ('bugs', 'firefox_table'):
                cur.execute(f"SELECT COALESCE(component, 'general'), COUNT(*) FROM {table} WHERE company_id = %s GROUP BY component", (cid,))
            else:
                cur.execute(f"SELECT COALESCE(component, 'general'), COUNT(*) FROM {table} GROUP BY component")

        for row in cur.fetchall():
            # Ensure component names are non-empty strings before lowercasing
            comp_name = row[0] if row[0] and row[0].strip() else 'general'
            counts[comp_name.strip().lower()] = row[1]
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[component_counts] psycopg2 error: {e}")
        # Fallback to Supabase API
        query = supabase.table(table).select("component").limit(5000)
        if not is_super and cid is not None:
            # Apply company_id filter for shared tables in fallback path as well
            if table in ('bugs', 'firefox_table'):
                query = query.eq("company_id", cid)
        
        res = query.execute()
        for r in (res.data or []):
            comp = (r.get("component") or "general").strip().lower()
            if comp:
                counts[comp] = counts.get(comp, 0) + 1

    return counts


@app.get("/api/hub/component_inspector")
def component_inspector(
    component: str, team: str = "",
    current_user: dict = Depends(auth.get_current_user),
):
    raw_cid = current_user.get("company_id")
    try:
        cid = int(raw_cid) if raw_cid not in (None, "None", "") else None
    except (TypeError, ValueError):
        cid = None

    is_super = current_user.get("role") == "super_admin"
    table = get_company_table(cid)

    q_total = supabase.table(table).select("bug_id", count="exact").eq("component", component)
    if not is_super and cid is not None and not is_shared_table(table):
        q_total = q_total.eq("company_id", cid)
    total = q_total.execute().count or 0

    q_crit = supabase.table(table).select("*").eq("component", component).in_("severity", ["S1","CRITICAL"])
    if not is_super and cid is not None and not is_shared_table(table):
        q_crit = q_crit.eq("company_id", cid)
    recent_critical = [
        {"id": r.get("bug_id") or r.get("id"), "summary": r.get("summary"), "severity": r.get("severity")}
        for r in (q_crit.order("bug_id", desc=True).limit(5).execute().data or [])
    ]
    return {"component": component, "team": team, "total": total, "recent_critical": recent_critical}


@app.post("/api/retrain")
def retrain(current_user: dict = Depends(auth.require_admin)):
    cid  = current_user.get("company_id")
    role = current_user.get("role")
    target_cid = None if role == "super_admin" else cid

    res = supabase.table("feedback").select("*").eq("is_correction", True)
    if target_cid is not None:
        res = res.eq("company_id", target_cid)
    feedback_list = res.execute().data or []

    if not feedback_list:
        return {"success": False, "message": "No corrections found to learn from."}

    result = ml_logic.fast_retrain(feedback_list, company_id=target_cid)
    return {
        "success":              result.get("success", False),
        "status":               "Model updated",
        "new_knowledge_points": len(feedback_list),
        "total_trees":          result.get("total_trees", 0),
        "company_id":           target_cid,
        "timestamp":            datetime.utcnow().isoformat(),
    }


def _start_train_thread(key: str, feedback_list: list, target_cid, bug_records=None, message: str = "", mode: str = ""):
    _training_progress[key] = {"step": "Initializing", "pct": 0, "done": False, "error": None}
    threading.Thread(
        target=_train_with_progress,
        args=(key, feedback_list, target_cid),
        kwargs={"bug_records": bug_records},
        daemon=True,
    ).start()
    return {"success": True, "message": message, "key": key, "mode": mode,
            "stream_url": f"/api/admin/model/train/stream?stream_key={key}"}


def _save_model_artifact_log(result: dict, target_cid, records_used: int):
    """Persist a training run record to Supabase company_model_log table."""
    try:
        if not result or not result.get("success"):
            return
        supabase.table("company_model_log").insert({
            "company_id":   target_cid,
            "accuracy":     result.get("accuracy", 0),
            "f1_score":     result.get("f1_score", 0),
            "precision":    result.get("precision", 0),
            "recall":       result.get("recall", 0),
            "records_used": records_used,
            "total_trees":  result.get("total_trees", 0),
            "mode":         "company" if target_cid is not None else "global",
            "trained_at":   datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as log_err:
        print(f"[model_log] Failed to save artifact log: {log_err}")


_FULL_TRAIN_SAMPLE = 250000
_PAGE_SIZE = 1000  # Supabase PostgREST hard caps single responses at 1,000 rows


def _train_with_progress(key: str, feedback_list: list, target_cid, bug_records: list = None):
    def cb(step: str, pct: int):
        _training_progress[key] = {"step": step, "pct": pct, "done": False, "error": None}

    try:
        if bug_records is None and not feedback_list:
            # Full-train path: fetch data inside the thread so the API returns immediately
            cb("Loading bug data", 3)
            if target_cid is None:
                # Global: use firefox baseline (capped for speed)
                raw_rows = _fetch_paginated("firefox_table", "summary, severity",
                                            max_rows=_FULL_TRAIN_SAMPLE)
                try:
                    all_companies = supabase.table("companies").select("id").execute().data or []
                    for co in all_companies:
                        co_cid = co.get("id")
                        co_table = get_company_table(co_cid)
                        if co_table and not is_shared_table(co_table):
                            raw_rows.extend(_fetch_paginated(
                                co_table, "summary, severity",
                                eq_filters=[("company_id", co_cid)],
                            ))
                except Exception as agg_err:
                    print(f"[train/thread] company aggregation warning: {agg_err}")
                bug_records = raw_rows
            else:
                # Company-specific: fetch full dataset
                table = get_company_table(target_cid)
                filters = None if is_shared_table(table) else [("company_id", target_cid)]
                bug_records = _fetch_paginated(table, "summary, severity",
                                               eq_filters=filters)

            bug_records = [
                {"summary": r["summary"], "severity": r.get("severity", "S3")}
                for r in bug_records
                if r.get("summary") and r.get("severity")
            ]
            if not bug_records:
                _training_progress[key] = {"step": "Error", "pct": 0, "done": True,
                                            "error": "No labeled bugs found.", "result": None}
                return

        records_used = len(bug_records) if bug_records else 0

        if bug_records is not None:
            cb("Sampling company data", 5)
            _time.sleep(0.1)
            result = ml_logic.full_train_from_dataset(bug_records, company_id=target_cid, progress_cb=cb)
        else:
            cb("Loading feedback data", 5)
            _time.sleep(0.2)
            cb("Preparing features", 20)
            _time.sleep(0.1)
            cb("Vectorizing text", 40)
            result = ml_logic.fast_retrain(feedback_list, company_id=target_cid, progress_cb=cb)
            records_used = len(feedback_list)

        if result and not result.get("success"):
            _training_progress[key] = {"step": "Error", "pct": 0, "done": True, "error": result.get("error", "Training failed."), "result": result}
            return

        cb("Saving model", 95)
        # Persist training metadata to Supabase
        _save_model_artifact_log(result, target_cid, records_used)
        _time.sleep(0.1)
        _training_progress[key] = {"step": "Done", "pct": 100, "done": True, "error": None, "result": result}
    except Exception as e:
        _training_progress[key] = {"step": "Error", "pct": 0, "done": True, "error": str(e), "result": None}


def _fetch_paginated(table: str, columns: str, eq_filters: list = None, max_rows: int = _FULL_TRAIN_SAMPLE) -> list:
    """Fetch rows from Supabase in 1,000-row pages to bypass the server-side row cap."""
    all_rows = []
    offset = 0
    while len(all_rows) < max_rows:
        q = supabase.table(table).select(columns)
        if eq_filters:
            for col, val in eq_filters:
                q = q.eq(col, val)
        batch = q.range(offset, offset + _PAGE_SIZE - 1).execute().data or []
        if not batch:
            break
        all_rows.extend(batch)
        if len(batch) < _PAGE_SIZE:
            break
        offset += _PAGE_SIZE
    return all_rows[:max_rows]


@app.post("/api/admin/model/train/start")
def train_model_start(current_user: dict = Depends(auth.require_admin)):
    raw_cid = current_user.get("company_id")
    cid     = int(raw_cid) if raw_cid is not None else None
    role    = current_user.get("role")
    target_cid = None if role == "super_admin" else cid
    
    base_key = str(target_cid) if target_cid is not None else "global"
    key = f"train_{base_key}_{int(_time.time())}"

    feedback_res = supabase.table("feedback").select("*").eq("is_correction", True)
    if target_cid is not None:
        feedback_res = feedback_res.eq("company_id", target_cid)
    feedback_list = feedback_res.execute().data or []

    has_model = company_model_exists(target_cid)

    if feedback_list and has_model:
        return _start_train_thread(
            key, feedback_list, target_cid,
            message=f"Training started on {len(feedback_list)} feedback corrections.",
            mode="fast_retrain",
        )

    # No feedback — full train. Pass neither bug_records nor feedback_list so the
    # thread fetches data itself, letting this endpoint return immediately.
    return _start_train_thread(
        key, [], target_cid, bug_records=None,
        message="Full training started — loading dataset in background.",
        mode="full_train",
    )


@app.get("/api/admin/model/train/stream")
async def train_model_stream(
    stream_key: str = Query(default="global"),
    token: str = Query(default=None),
):
    """Legacy SSE endpoint — kept for backwards compatibility.  Clients should
    use the polling endpoint /api/admin/model/train/status instead."""
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        user = auth.get_current_user(token)
        if user.get("role") not in ("admin", "super_admin"):
            raise HTTPException(status_code=403, detail="Admin access required")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    key = stream_key

    async def event_gen():
        max_wait = 600
        elapsed  = 0
        last_ping = 0
        while elapsed < max_wait:
            state = _training_progress.get(key, {"step": "Waiting", "pct": 0, "done": False})
            yield f"data: {json.dumps(state)}\n\n"
            if state.get("done"):
                break
            if elapsed - last_ping >= 15:
                yield ": ping\n\n"
                last_ping = elapsed
            await asyncio.sleep(0.5)
            elapsed += 0.5
        else:
            yield f"data: {json.dumps({'step': 'Timeout', 'pct': 0, 'done': True, 'error': 'Training timed out after 10 minutes'})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@app.get("/api/admin/model/train/status")
def train_model_status(
    stream_key: str = Query(default="global"),
    current_user: dict = Depends(auth.require_admin),
):
    """Polling endpoint: returns the current training progress for a given key.
    The frontend polls this every second instead of holding an SSE connection."""
    state = _training_progress.get(stream_key, {"step": "Waiting", "pct": 0, "done": False})
    return state


@app.post("/api/admin/model/validate")
def validate_company_model(current_user: dict = Depends(auth.require_admin)):
    cid  = current_user.get("company_id")
    role = current_user.get("role")
    target_cid = None if role == "super_admin" else cid

    fb_res = supabase.table("feedback") \
                     .select("summary, predicted_severity, actual_severity, component") \
                     .eq("is_correction", True) \
                     .not_.is_("actual_severity", "null")
    if target_cid is not None:
        fb_res = fb_res.eq("company_id", target_cid)
    records = fb_res.order("created_at", desc=True).limit(50).execute().data or []

    if not records:
        return {"success": False, "message": "No corrected feedback found to validate against.", "records": 0}

    correct = 0
    total   = len(records)
    details = []

    for rec in records:
        try:
            result = ml_logic.predict_severity(
                rec["summary"],
                component=rec.get("component", "General"),
                company_id=target_cid,
            )
            predicted = result.get("prediction")
            actual    = rec["actual_severity"]
            hit       = predicted == actual
            if hit:
                correct += 1
            details.append({"predicted": predicted, "actual": actual, "correct": hit})
        except Exception:
            total -= 1

    accuracy = round((correct / total * 100), 1) if total > 0 else 0.0
    return {
        "success":   True,
        "accuracy":  accuracy,
        "correct":   correct,
        "total":     total,
        "details":   details[:20],
        "model_source": "company" if (target_cid and company_model_exists(target_cid)) else "global",
    }


class UpdateCompanyRequest(BaseModel):
    description: str | None = None
    website:     str | None = None


@app.get("/api/admin/company_profile")
def get_company_profile(current_user: dict = Depends(auth.require_admin)):
    cid = current_user.get("company_id")

    # Super admin has no company_id — return an aggregated universal profile
    if not cid:
        try:
            all_companies = supabase.table("companies").select("*", count="exact").execute()
            total_companies = all_companies.count or 0
            bugs_res  = supabase.table("bugs").select("*", count="exact").limit(1).execute()
            fb_res    = supabase.table("feedback").select("*", count="exact").limit(1).execute()
            users_res = supabase.table("users").select("*", count="exact").limit(1).execute()
        except Exception:
            total_companies, bugs_res, fb_res, users_res = 0, None, None, None
        return {
            "id":            None,
            "name":          "Universal (Super Admin)",
            "description":   "Aggregated view across all companies.",
            "website":       "",
            "status":        "active",
            "invite_code":   "",
            "has_own_model": company_model_exists(None),
            "created_at":    None,
            "is_super_admin": True,
            "stats": {
                "total_bugs":     (bugs_res.count  or 0) if bugs_res  else 0,
                "total_users":    (users_res.count or 0) if users_res else 0,
                "total_feedback": (fb_res.count    or 0) if fb_res    else 0,
                "total_companies": total_companies,
            },
        }

    co_res = supabase.table("companies").select("*").eq("id", cid).single().execute()
    if not co_res.data:
        raise HTTPException(status_code=404, detail="Company not found")

    co = co_res.data
    bugs_table = get_company_table(cid)
    bugs_q     = supabase.table(bugs_table).select("*", count="exact")
    if not is_shared_table(bugs_table):
        bugs_q = bugs_q.eq("company_id", cid)
    bugs_res   = bugs_q.limit(1).execute()
    users_res  = supabase.table("users").select("*", count="exact").eq("company_id", cid).limit(1).execute()
    fb_res     = supabase.table("feedback").select("*", count="exact").eq("company_id", cid).limit(1).execute()

    return {
        "id":            co.get("id"),
        "name":          co.get("name"),
        "description":   co.get("description", ""),
        "website":       co.get("website", ""),
        "status":        co.get("status", "active"),
        "invite_code":   co.get("invite_code", ""),
        "has_own_model": co.get("has_own_model", False),
        "created_at":    co.get("created_at"),
        "stats": {
            "total_bugs":     bugs_res.count  or 0,
            "total_users":    users_res.count or 0,
            "total_feedback": fb_res.count    or 0,
        },
    }


@app.patch("/api/admin/company_profile")
def update_company_profile(
    req: UpdateCompanyRequest,
    current_user: dict = Depends(auth.require_admin),
):
    cid = current_user.get("company_id")
    if not cid:
        raise HTTPException(status_code=400, detail="No company assigned")

    update_data = {}
    if req.description is not None:
        update_data["description"] = req.description.strip()
    if req.website is not None:
        update_data["website"] = req.website.strip()

    if update_data:
        supabase.table("companies").update(update_data).eq("id", cid).execute()

    return {"message": "Company profile updated"}


def _do_model_reset(cid):
    """Core reset logic: delete all ML artifact files for a given company_id (or None=global)."""
    paths = get_artifact_paths(cid)
    deleted = []
    for _, path in paths.items():
        if os.path.exists(path):
            os.remove(path)
            deleted.append(os.path.basename(path))

    metrics_dir = os.path.dirname(paths["met"])
    for extra in ("main_brain_metrics.json", "previous_metrics.json"):
        p = os.path.join(metrics_dir, extra)
        if os.path.exists(p):
            os.remove(p)
            deleted.append(extra)

    ml_logic._model_cache.pop(cid if cid is not None else "global", None)

    if cid is not None:
        try:
            supabase.table("companies").update({"has_own_model": False}).eq("id", cid).execute()
        except Exception:
            pass

    return deleted


@app.delete("/api/admin/model/reset")
def reset_model(
    target_company_id: int | None = Query(default=None),
    current_user: dict = Depends(auth.require_admin),
):
    """Delete all ML artifacts for the specified scope.

    - Company admin: always resets their own company's artifacts only.
      `target_company_id` is ignored.
    - Super admin: if `target_company_id` is provided, resets that specific
      company's artifacts; if omitted, resets the global/universal model.
    """
    role = current_user.get("role")
    raw_cid = current_user.get("company_id")
    try:
        caller_cid = int(raw_cid) if raw_cid not in (None, "None", "") else None
    except (TypeError, ValueError):
        caller_cid = None

    if role == "super_admin":
        # Super admin can target any company or the global model
        cid = target_company_id  # None = global, int = specific company
    else:
        # Company admin can only reset their own artifacts
        cid = caller_cid
        if cid is None:
            raise HTTPException(status_code=400, detail="No company assigned to this admin account")

    deleted = _do_model_reset(cid)
    return {"success": True, "deleted": deleted, "company_id": cid, "scope": "global" if cid is None else f"company_{cid}"}


@app.post("/api/companies")
def create_company(req: CompanyCreate, current_user: dict = Depends(auth.require_admin)):
    req.name = validate_company_name(req.name)
    existing = supabase.table("companies").select("id").eq("name", req.name).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Company name already exists")
    res = supabase.table("companies").insert({"name": req.name, "data_table": "bugs"}).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create company")
    return {"message": "Company created", "company_id": res.data[0]["id"], "company_name": req.name}


@app.get("/api/superadmin/companies")
def superadmin_get_companies(current_user: dict = Depends(auth.require_developer_or_above)):
    companies_res = supabase.table("companies").select("*").execute()
    companies = companies_res.data or []

    # Count users per company via exact count (no row-limit issue)
    users_res = supabase.table("users").select("company_id").execute()
    users_data = users_res.data or []
    user_counts: dict = {}
    for u in users_data:
        uid = u.get("company_id")
        if uid is not None:
            user_counts[uid] = user_counts.get(uid, 0) + 1

    result = []
    for co in companies:
        cid        = co.get("id")
        data_table = co.get("data_table") or "bugs"
        resolved_statuses = co.get("resolved_statuses") or ["RESOLVED", "VERIFIED", "FIXED", "PROCESSED"]

        total    = 0
        critical = 0
        resolved = 0

        try:
            if data_table == "bugs":
                # Company uses the shared bugs table — filter by company_id
                total    = supabase.table("bugs").select("*", count="exact").eq("company_id", cid).limit(1).execute().count or 0
                critical = supabase.table("bugs").select("*", count="exact").eq("company_id", cid).eq("severity", "S1").limit(1).execute().count or 0
                resolved = 0
                for st in resolved_statuses:
                    resolved += supabase.table("bugs").select("*", count="exact").eq("company_id", cid).ilike("status", st).limit(1).execute().count or 0
            else:
                # Company has its own table (firefox_table, company_N_bugs, etc.)
                total    = supabase.table(data_table).select("*", count="exact").limit(1).execute().count or 0
                critical = supabase.table(data_table).select("*", count="exact").eq("severity", "S1").limit(1).execute().count or 0
                resolved = 0
                for st in resolved_statuses:
                    resolved += supabase.table(data_table).select("*", count="exact").ilike("status", st).limit(1).execute().count or 0
        except Exception as e:
            print(f"[superadmin companies] cid={cid} table={data_table}: {e}")

        model_acc = 0.0
        if co.get("has_own_model", False):
            try:
                met_path = get_artifact_paths(cid).get("met", "")
                if met_path and os.path.exists(met_path):
                    with open(met_path, "r") as f:
                        saved = json.load(f)
                        model_acc = round(saved.get("accuracy", 0.0) * 100, 1)
            except Exception:
                pass

        result.append({
            "id":             cid,
            "name":           co.get("name", f"Company #{cid}"),
            "status":         co.get("status", "active"),
            "has_own_model":  co.get("has_own_model", False),
            "total_bugs":     total,
            "total_users":    user_counts.get(cid, 0),
            "total_feedback": 0,
            "critical":       critical,
            "resolved":       resolved,
            # legacy aliases used by SystemPanel / SuperAdmin.jsx
            "total":          total,
            "users":          user_counts.get(cid, 0),
            "model_acc":      model_acc,
            "last_active":    "Live",
        })

    result.sort(key=lambda x: x["total"], reverse=True)
    return result


@app.get("/api/superadmin/users")
def superadmin_get_users(current_user: dict = Depends(auth.require_developer_or_above)):
    users_res = supabase.table("users").select(
        "uuid, username, email, role, is_admin, company_id, onboarding_completed, status"
    ).execute()
    users = users_res.data or []

    co_res   = supabase.table("companies").select("id, name").execute()
    co_map   = {c["id"]: c["name"] for c in (co_res.data or [])}

    for u in users:
        u["company_name"] = co_map.get(u.get("company_id"), "—")

    return users


@app.get("/api/superadmin/pending")
def superadmin_get_pending(current_user: dict = Depends(auth.require_developer_or_above)):
    users_res = supabase.table("users").select(
        "uuid, username, email, role, company_id, onboarding_completed, status"
    ).eq("status", "pending").execute()
    users = users_res.data or []

    co_res = supabase.table("companies").select("id, name, status").execute()
    co_map = {c["id"]: c for c in (co_res.data or [])}

    for u in users:
        co = co_map.get(u.get("company_id"), {})
        u["company_name"] = co.get("name", "—")
        u["company_status"] = co.get("status", "—")

    return users


@app.patch("/api/superadmin/users/{user_uuid}/approve")
def superadmin_approve_user(
    user_uuid: str,
    current_user: dict = Depends(auth.require_super_admin),
):
    target_res = supabase.table("users").select("*").eq("uuid", user_uuid).execute()
    if not target_res.data:
        raise HTTPException(status_code=404, detail="User not found")

    target = target_res.data[0]
    email  = target.get("email")
    name   = target.get("username", email)
    role   = target.get("role", "user")
    cid    = target.get("company_id")
    old_status = target.get("status")

    supabase.table("users").update({"status": "active"}).eq("uuid", user_uuid).execute()

    company_name = ""
    if cid:
        co_res = supabase.table("companies").select("status, name, data_table").eq("id", cid).execute()
        if co_res.data:
            company_name = co_res.data[0].get("name", "")
            company_update: dict = {}
            if co_res.data[0].get("status") == "pending":
                company_update["status"] = "active"
            # Ensure Firefox companies are wired to firefox_table from the start
            if db_provision.is_firefox_company(company_name) and co_res.data[0].get("data_table") != "firefox_table":
                company_update["data_table"] = "firefox_table"
            if company_update:
                supabase.table("companies").update(company_update).eq("id", cid).execute()

    uuid = target.get("uuid")
    email_sent = False

    if old_status == "pending":
        pw_store = target.get("password_hash", "")
        has_reg_password = pw_store.startswith("plain:")

        # invite_user_by_email is the only admin method that sends an email.
        # We do NOT call update_user_by_id here — doing so invalidates the OTP in the
        # invite link. Instead the password is applied transparently when the user clicks
        # the link (see /api/users/me/apply-registration-password).
        try:
            auth_res = supabase.auth.admin.invite_user_by_email(
                email,
                options={"data": {
                    "username":         name,
                    "company_name":     company_name,
                    "role":             role,
                    "password_prefilled": has_reg_password,
                }, "redirect_to": FRONTEND_URL},
            )
            email_sent = True
            if auth_res and auth_res.user:
                supabase.table("users").update({"uuid": auth_res.user.id}).eq("uuid", user_uuid).execute()
            print(f"[superadmin approve] Invite email sent to {email}")
        except Exception as e:
            print(f"[superadmin approve] Invite failed: {e}")
    else:
        print(f"[superadmin approve] {email} already had auth, status set to active")

    if email_sent:
        msg_suffix = " Invite email sent — they can sign in with their registration password."
    else:
        msg_suffix = " Invite email could not be sent — ask them to use password reset."

    return {
        "message": f"'{name}' approved." + msg_suffix,
        "email_sent": email_sent,
    }


@app.patch("/api/superadmin/users/{user_uuid}/reject")
def superadmin_reject_user(
    user_uuid: str,
    current_user: dict = Depends(auth.require_super_admin),
):
    target_res = supabase.table("users").select("username").eq("uuid", user_uuid).execute()
    if not target_res.data:
        raise HTTPException(status_code=404, detail="User not found")

    supabase.table("users").update({"status": "inactive"}).eq("uuid", user_uuid).execute()
    return {"message": "User rejected."}


class SuperAdminCreateUserRequest(BaseModel):
    email:      str
    username:   str
    role:       str = "user"
    company_id: int


class SystemInviteRequest(BaseModel):
    email:    str
    username: str
    role:     str  # "super_admin" or "developer"


@app.post("/api/superadmin/users/create")
def superadmin_create_user(
    req: SuperAdminCreateUserRequest,
    current_user: dict = Depends(auth.require_super_admin),
):
    co_res = supabase.table("companies").select("id, name").eq("id", req.company_id).single().execute()
    if not co_res.data:
        raise HTTPException(status_code=404, detail="Company not found")
    company_name = co_res.data.get("name", "")

    if req.role in ("super_admin", "developer"):
        raise HTTPException(status_code=400, detail="Use /api/superadmin/invite-system-user for system roles")
    role = req.role if req.role in ("user", "admin") else "user"

    existing = supabase.table("users").select("email").eq("email", req.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="A user with that email already exists")

    db_uuid = str(uuid_lib.uuid4())

    supabase.table("users").insert({
        "uuid":                 db_uuid,
        "email":                req.email,
        "username":             req.username,
        "role":                 role,
        "is_admin":             role == "admin",
        "company_id":           req.company_id,
        "onboarding_completed": True,
        "status":               "active",
    }).execute()

    email_sent = False
    invite_code = co_res.data.get("invite_code", "") if co_res.data else ""
    try:
        auth_res = supabase.auth.admin.invite_user_by_email(
            req.email,
            options={"data": {"username": req.username, "company_name": company_name, "role": role, "needs_password_setup": True}, "redirect_to": FRONTEND_URL},
        )
        email_sent = True
        # Link the newly created auth UUID back to the database
        if auth_res and auth_res.user:
            supabase.table("users").update({"uuid": auth_res.user.id}).eq("email", req.email).execute()
    except Exception as e:
        print(f"[superadmin create_user] Failed to send invite email to {req.email}: {e}")

    return {
        "message":    (
            f"User '{req.username}' created and invite sent to {req.email}."
            if email_sent
            else f"User '{req.username}' pre-registered. Email could not be delivered to {req.email} — share the invite code manually."
        ),
        "email_sent":  email_sent,
        "invite_code": invite_code,
        "username":    req.username,
        "company":     company_name,
    }


@app.post("/api/superadmin/invite-system-user")
def superadmin_invite_system_user(
    req: SystemInviteRequest,
    current_user: dict = Depends(auth.require_super_admin),
):
    if req.role not in ("super_admin", "developer"):
        raise HTTPException(status_code=400, detail="Role must be 'super_admin' or 'developer'")

    existing = supabase.table("users").select("email").eq("email", req.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="A user with that email already exists")

    system_res = supabase.table("companies").select("id").eq("name", "System").execute()
    system_company_id = system_res.data[0]["id"] if system_res.data else None

    db_uuid = str(uuid_lib.uuid4())
    supabase.table("users").insert({
        "uuid":                 db_uuid,
        "email":                req.email,
        "username":             req.username,
        "role":                 req.role,
        "is_admin":             False,
        "company_id":           system_company_id,
        "onboarding_completed": True,
        "status":               "active",
    }).execute()

    email_sent = False
    try:
        auth_res = supabase.auth.admin.invite_user_by_email(
            req.email,
            options={"data": {"username": req.username, "role": req.role, "needs_password_setup": True}, "redirect_to": FRONTEND_URL},
        )
        email_sent = True
        if auth_res and auth_res.user:
            supabase.table("users").update({"uuid": auth_res.user.id}).eq("email", req.email).execute()
    except Exception as e:
        print(f"[superadmin invite_system_user] Failed to send invite to {req.email}: {e}")

    role_label = "Super Admin" if req.role == "super_admin" else "Developer"
    return {
        "message": (
            f"{role_label} invite sent to {req.email}."
            if email_sent
            else f"{role_label} '{req.username}' pre-registered. Email could not be delivered to {req.email}."
        ),
        "email_sent": email_sent,
    }


@app.get("/api/companies/list")
def list_companies(current_user: dict = Depends(auth.get_current_user)):
    companies_res = supabase.table("companies").select("id, name").order("name").execute()
    all_companies = companies_res.data or []

    users_res = supabase.table("users").select("company_id").execute()
    active_ids = set(
        u["company_id"] for u in (users_res.data or [])
        if u.get("company_id") is not None
    )

    filtered = [
        c for c in all_companies
        if c.get("name") != "System" and c.get("id") in active_ids
    ]

    return filtered


@app.get("/api/admin/users/pending")
def admin_list_pending(current_user: dict = Depends(auth.require_admin)):
    cid = current_user.get("company_id")
    res = supabase.table("users").select(
        "uuid, username, email, role, status"
    ).eq("company_id", cid).eq("status", "pending").execute()
    return res.data or []


@app.get("/api/admin/users/pending/all")
def admin_list_pending_all(current_user: dict = Depends(auth.require_admin)):
    cid = current_user.get("company_id")
    res = supabase.table("users").select(
        "uuid, username, email, role, status"
    ).eq("company_id", cid).in_("status", ["pending", "invite_requested", "pending_code"]).execute()
    return res.data or []


@app.get("/api/admin/users")
def admin_list_users(current_user: dict = Depends(auth.require_admin)):
    cid = current_user.get("company_id")
    res = supabase.table("users") \
                  .select("uuid, username, email, role, is_admin, onboarding_completed, status") \
                  .eq("company_id", cid) \
                  .order("username") \
                  .execute()
    return res.data or []


class InviteUserRequest(BaseModel):
    email:    str
    username: str
    role:     str = "user"

@app.get("/api/invite/companies")
def public_companies_list():
    res = supabase.table("companies").select("id, name").order("name").execute()
    return [c for c in (res.data or []) if c.get("name") != "System"]


class InviteRequestCreate(BaseModel):
    username:   str
    email:      str
    company_id: int
    uuid:       str = ""
    password:   str = ""


@app.post("/api/invite/request")
def submit_invite_request(req: InviteRequestCreate):
    email_clean = req.email.strip().lower()

    existing = supabase.table("users").select("email, status").eq("email", email_clean).execute()
    if existing.data:
        raise HTTPException(
            status_code=400,
            detail="This email already has an account or a pending access request."
        )

    co_res = supabase.table("companies").select("id").eq("id", req.company_id).execute()
    if not co_res.data:
        raise HTTPException(status_code=404, detail="Company not found.")

    db_uuid = req.uuid.strip() if req.uuid else str(uuid_lib.uuid4())
    pw_hash = auth.get_password_hash(req.password) if req.password else ""

    supabase.table("users").insert({
        "uuid":                 db_uuid,
        "email":                email_clean,
        "username":             req.username.strip(),
        "password_hash":        pw_hash,
        "role":                 "user",
        "is_admin":             False,
        "company_id":           req.company_id,
        "onboarding_completed": True,
        "status":               "invite_requested",
    }).execute()

    return {"message": "Request submitted. Your admin will review it — you'll be able to log in once approved."}


@app.get("/api/admin/invite_requests")
def list_invite_requests(current_user: dict = Depends(auth.require_admin)):
    cid = current_user.get("company_id")
    if not cid:
        raise HTTPException(status_code=400, detail="No company assigned")
    res = supabase.table("users") \
                  .select("id, username, email") \
                  .eq("company_id", cid) \
                  .eq("status", "invite_requested") \
                  .execute()
    return res.data or []


@app.post("/api/admin/invite_requests/{request_id}/approve")
def approve_invite_request(
    request_id: int,
    current_user: dict = Depends(auth.require_admin),
):
    cid = current_user.get("company_id")

    row_res = supabase.table("users") \
                      .select("*") \
                      .eq("id", request_id) \
                      .eq("company_id", cid) \
                      .eq("status", "invite_requested") \
                      .execute()
    if not row_res.data:
        raise HTTPException(status_code=404, detail="Request not found or already processed.")

    row   = row_res.data[0]
    email = row["email"]
    name  = row.get("username", email)
    uuid  = row.get("uuid")
    old_status = row.get("status")

    co_res = supabase.table("companies").select("name, invite_code").eq("id", cid).single().execute()
    company_name = co_res.data.get("name", "")        if co_res.data else ""
    company_code = co_res.data.get("invite_code", "") if co_res.data else ""

    supabase.table("users").update({"status": "pending_code"}).eq("id", request_id).execute()

    email_sent = False
    try:
        if old_status == "invite_requested":
            auth_res = supabase.auth.admin.invite_user_by_email(
                email,
                options={"data": {
                    "invite_code":  company_code,
                    "company_name": company_name,
                    "username":     name,
                }, "redirect_to": FRONTEND_URL},
            )
            email_sent = True
            if auth_res and auth_res.user:
                supabase.table("users").update({"uuid": auth_res.user.id}).eq("id", request_id).execute()
            print(f"[approve_invite] Invite email sent to {email}")
        else:
            print(f"[approve_invite] Existing auth account preserved for {email}")
    except Exception as e:
        print(f"[approve_invite] Email send failed: {e}")

    return {
        "message": (
            f"{name} approved! Invite code: {company_code} — "
            + ("email sent with the code." if email_sent
               else "share this code manually; user can keep their existing password.")
        ),
        "invite_code": company_code,
        "email_sent":  email_sent,
    }


class VerifyInviteCodeRequest(BaseModel):
    code: str


@app.post("/api/invite/verify_code")
def verify_invite_code(req: VerifyInviteCodeRequest, current_user: dict = Depends(auth.get_current_user)):
    status = current_user.get("status", "")
    if status != "pending_code":
        raise HTTPException(status_code=400, detail="No code verification required for your account.")

    cid = current_user.get("company_id")
    if not cid:
        raise HTTPException(status_code=400, detail="No company assigned to this account.")

    co_res = supabase.table("companies").select("invite_code").eq("id", cid).single().execute()
    if not co_res.data:
        raise HTTPException(status_code=404, detail="Company not found.")

    expected = (co_res.data.get("invite_code") or "").strip().upper()
    submitted = req.code.strip().upper()

    if submitted != expected:
        raise HTTPException(status_code=400, detail="Invalid code. Check the email your admin sent and try again.")

    uuid = current_user.get("uuid")
    supabase.table("users").update({"status": "active"}).eq("uuid", uuid).execute()
    return {"message": "Code accepted. Welcome aboard!"}


@app.delete("/api/admin/invite_requests/{request_id}")
def reject_invite_request(
    request_id: int,
    current_user: dict = Depends(auth.require_admin),
):
    cid = current_user.get("company_id")
    row_res = supabase.table("users") \
                      .select("id") \
                      .eq("id", request_id) \
                      .eq("company_id", cid) \
                      .eq("status", "invite_requested") \
                      .execute()
    if not row_res.data:
        raise HTTPException(status_code=404, detail="Request not found.")
    supabase.table("users").delete().eq("id", request_id).execute()
    return {"message": "Request rejected."}


@app.get("/api/invite/validate")
def validate_invite_code(code: str):
    if not code or len(code.strip()) < 4:
        return {"valid": False, "company_name": ""}

    code_upper = code.strip().upper()
    res = supabase.table("companies").select("id, name").eq("invite_code", code_upper).execute()
    if res.data:
        return {"valid": True, "company_name": res.data[0]["name"], "company_id": res.data[0]["id"]}
    return {"valid": False, "company_name": ""}

@app.get("/api/admin/invite_code")
def get_invite_code(current_user: dict = Depends(auth.require_admin)):
    cid = current_user.get("company_id")
    if not cid:
        raise HTTPException(status_code=400, detail="No company assigned to this admin")

    res = supabase.table("companies").select("id, name, invite_code").eq("id", cid).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Company not found")

    return {
        "company_id":   res.data["id"],
        "company_name": res.data["name"],
        "invite_code":  res.data.get("invite_code") or "",
    }

@app.post("/api/admin/invite_code/regenerate")
def regenerate_invite_code(current_user: dict = Depends(auth.require_admin)):
    cid = current_user.get("company_id")
    if not cid:
        raise HTTPException(status_code=400, detail="No company assigned")

    new_code = _gen_invite_code()
    supabase.table("companies").update({"invite_code": new_code}).eq("id", cid).execute()
    return {"invite_code": new_code, "message": "Invite code regenerated. The old code is now invalid."}

@app.post("/api/admin/users/invite")
def admin_invite_user(req: InviteUserRequest, current_user: dict = Depends(auth.require_admin)):
    cid = current_user.get("company_id")

    if req.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")

    existing_email = supabase.table("users").select("email").eq("email", req.email).execute()
    if existing_email.data:
        raise HTTPException(status_code=400, detail="A user with that email already exists")

    existing_uname = supabase.table("users").select("username").eq("username", req.username).execute()
    if existing_uname.data:
        raise HTTPException(status_code=400, detail="That username is already taken")

    db_uuid = str(uuid_lib.uuid4())

    res = supabase.table("users").insert({
        "uuid":                 db_uuid,
        "email":                req.email,
        "username":             req.username,
        "password_hash":        "",
        "role":                 req.role,
        "is_admin":             req.role == "admin",
        "company_id":           cid,
        "onboarding_completed": True,
        "status":               "active",
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create user record")

    email_sent = False
    invite_code = ""
    email_error = ""
    try:
        co_res = supabase.table("companies").select("name, invite_code").eq("id", cid).single().execute()
        company_name = co_res.data.get("name", "") if co_res.data else ""
        invite_code  = co_res.data.get("invite_code", "") if co_res.data else ""
        auth_res = supabase.auth.admin.invite_user_by_email(
            req.email,
            options={"data": {"username": req.username, "company_name": company_name, "role": req.role}, "redirect_to": FRONTEND_URL},
        )
        email_sent = True
        if auth_res and auth_res.user:
            supabase.table("users").update({"uuid": auth_res.user.id}).eq("email", req.email).execute()
    except Exception as e:
        email_error = str(e)
        print(f"[invite] Failed to send invite email to {req.email}: {email_error}")
        # Fetch invite code even on failure so admin can share it manually
        if not invite_code:
            try:
                co_res2 = supabase.table("companies").select("invite_code").eq("id", cid).single().execute()
                invite_code = co_res2.data.get("invite_code", "") if co_res2.data else ""
            except Exception:
                pass

    return {
        "message":    (
            f"Invitation sent to {req.email}."
            if email_sent
            else f"User pre-registered. Email could not be delivered to {req.email} — share the invite code below manually."
        ),
        "email_sent":  email_sent,
        "invite_code": invite_code,
        "username":    req.username,
        "email":       req.email,
        "role":        req.role,
    }


class UpdateUserRequest(BaseModel):
    username: str | None = None
    role:     str | None = None


@app.patch("/api/admin/users/{user_uuid}")
def admin_update_user(
    user_uuid: str,
    req: UpdateUserRequest,
    current_user: dict = Depends(auth.require_admin),
):
    if user_uuid == current_user.get("uuid"):
        raise HTTPException(status_code=400, detail="You cannot change your own role")

    target_res = _admin_get_user(user_uuid, current_user)
    if not target_res.data:
        raise HTTPException(status_code=404, detail="User not found in your company")

    if req.role is not None:
        if req.role not in ("user", "admin"):
            raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")

        target = target_res.data[0]
        if req.role == "admin" and target.get("role") != "admin":
            cid = current_user.get("company_id")
            existing_admin = supabase.table("users") \
                .select("uuid") \
                .eq("company_id", target.get("company_id") or cid) \
                .eq("role", "admin") \
                .execute()
            for a in (existing_admin.data or []):
                if a["uuid"] != user_uuid:
                    supabase.table("users").update({
                        "role": "user", "is_admin": False,
                    }).eq("uuid", a["uuid"]).execute()

        supabase.table("users").update({
            "role":     req.role,
            "is_admin": req.role == "admin",
        }).eq("uuid", user_uuid).execute()

    if req.username is not None:
        req.username = req.username.strip()
        if req.username:
            existing = supabase.table("users").select("uuid").eq("username", req.username).execute()
            if existing.data and existing.data[0].get("uuid") != user_uuid:
                raise HTTPException(status_code=400, detail="Username already taken")
            supabase.table("users").update({"username": req.username}).eq("uuid", user_uuid).execute()

    return {"message": "User updated successfully"}


@app.patch("/api/admin/users/{user_uuid}/deactivate")
def admin_deactivate_user(user_uuid: str, current_user: dict = Depends(auth.require_admin)):
    if user_uuid == current_user.get("uuid"):
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    if not _admin_get_user(user_uuid, current_user, "uuid").data:
        raise HTTPException(status_code=404, detail="User not found")
    supabase.table("users").update({"status": "inactive"}).eq("uuid", user_uuid).execute()
    return {"message": "User deactivated."}


@app.patch("/api/admin/users/{user_uuid}/reactivate")
def admin_reactivate_user(user_uuid: str, current_user: dict = Depends(auth.require_admin)):
    if not _admin_get_user(user_uuid, current_user, "uuid").data:
        raise HTTPException(status_code=404, detail="User not found")
    supabase.table("users").update({"status": "active"}).eq("uuid", user_uuid).execute()
    return {"message": "User reactivated."}


def _delete_auth_user(uuid: str, email: str = None):
    """Delete a Supabase Auth user.  Tries by UUID first; falls back to email
    scan so stale / pre-fix UUIDs don't leave ghost auth accounts behind."""
    deleted = False

    if uuid:
        try:
            supabase.auth.admin.delete_user(uuid)
            deleted = True
            print(f"[cascade] auth user deleted by UUID: {uuid}")
        except Exception as e:
            print(f"[cascade] auth delete by UUID {uuid} failed (will try email fallback): {e}")

    # Email fallback — covers old registrations where the stored UUID was a
    # random placeholder that was never linked to a real Supabase Auth account.
    if not deleted and email:
        try:
            page = 1
            while True:
                resp = supabase.auth.admin.list_users(page=page, per_page=1000)
                users = resp if isinstance(resp, list) else getattr(resp, "users", [])
                if not users:
                    break
                match = next((u for u in users if getattr(u, "email", "") == email), None)
                if match:
                    supabase.auth.admin.delete_user(match.id)
                    print(f"[cascade] auth user deleted by email fallback: {email}")
                    deleted = True
                    break
                if len(users) < 1000:
                    break
                page += 1
        except Exception as e2:
            print(f"[cascade] auth delete by email {email} failed: {e2}")

    if not deleted:
        print(f"[cascade] WARNING: could not delete auth account for uuid={uuid} email={email}")


def _cascade_delete_user_row(user_row: dict):
    user_int_id = user_row.get("id")
    user_uuid   = user_row.get("uuid")

    if user_uuid:
        supabase.table("users").delete().eq("uuid", user_uuid).execute()
    elif user_int_id:
        supabase.table("users").delete().eq("id", user_int_id).execute()


def _cascade_delete_company(company_id: int):
    members_res = supabase.table("users").select("*").eq("company_id", company_id).execute()
    for member in (members_res.data or []):
        _delete_auth_user(member.get("uuid"), member.get("email"))
        _cascade_delete_user_row(member)

    for tbl in ("bugs", "feedback", "training_batches", "company_model_log"):
        try:
            supabase.table(tbl).delete().eq("company_id", company_id).execute()
        except Exception as e:
            print(f"[cascade] clearing {tbl} for company {company_id}: {e}")

    co_info = supabase.table("companies").select("data_table").eq("id", company_id).execute()
    co_table = (co_info.data or [{}])[0].get("data_table") if co_info.data else None

    supabase.table("companies").delete().eq("id", company_id).execute()

    if co_table and co_table not in ("bugs", "firefox_table"):
        try:
            db_provision.drop_company_table(co_table)
            print(f"[cascade] dropped company table: {co_table}")
        except Exception as drop_err:
            print(f"[cascade] could not drop table {co_table}: {drop_err}")

    models_dir = os.path.join(BASE_DIR, "models", f"company_{company_id}")
    if os.path.isdir(models_dir):
        shutil.rmtree(models_dir, ignore_errors=True)
        print(f"[cascade] removed ML artifacts: {models_dir}")


@app.delete("/api/admin/users/{user_uuid}")
def admin_delete_user(
        user_uuid: str,
        delete_company: bool = False,
        current_user: dict = Depends(auth.require_admin),
):
    if user_uuid == current_user.get("uuid"):
        raise HTTPException(status_code=400, detail="You cannot remove your own account")

    target = _admin_get_user(user_uuid, current_user)
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found")

    target_user    = target.data[0]
    target_company = target_user.get("company_id")
    display_name   = target_user.get("username") or target_user.get("email")

    if delete_company and current_user.get("role") == "super_admin" and target_company:
        _cascade_delete_company(target_company)
        return {
            "message":         f"User '{display_name}' and their entire company deleted.",
            "company_deleted": True,
            "uuid":            user_uuid,
        }

    _cascade_delete_user_row(target_user)
    _delete_auth_user(user_uuid, target_user.get("email"))

    return {
        "message":         f"User '{display_name}' deleted.",
        "company_deleted": False,
        "uuid":            user_uuid,
    }


@app.get("/api/superadmin/company_detail/{company_id}")
def superadmin_company_detail(
        company_id: int,
        current_user: dict = Depends(auth.require_developer_or_above),
):
    co = supabase.table("companies").select("id, name").eq("id", company_id).single().execute()
    if not co.data:
        raise HTTPException(status_code=404, detail="Company not found")

    users_res = supabase.table("users").select("id", count="exact") \
        .eq("company_id", company_id).execute()

    return {
        "id": co.data["id"],
        "name": co.data["name"],
        "user_count": users_res.count or 0,
    }


def _resolution_source(current_user: dict):
    """
    Returns (table: str, is_mozilla: bool, company_id: int|None).

    Routing rules:
      - super_admin (no company)  → resolution_knowledge_full_5000 (mozilla=True)
      - Firefox / Mozilla company → resolution_knowledge_full_5000 (mozilla=True)
      - Any other company         → their own data_table  (mozilla=False)
      - User with no company yet  → empty data            (mozilla=False)
    """
    role = current_user.get("role")
    company_id = current_user.get("company_id")

    if role == "super_admin" or company_id is None:
        return "resolution_knowledge_full_5000", True, None

    table = get_company_table(company_id)
    if table == "firefox_table":
        return "resolution_knowledge_full_5000", True, company_id

    return table, False, company_id


def _fetch_resolved_rows(
    table: str,
    company_id,
    select: str = "*",
    limit: int = 1000,
    start_offset: int = 0,
) -> list:
    try:
        end_offset = start_offset + limit - 1
        q = supabase.table(table).select(select).range(start_offset, end_offset)

        if table != "resolution_knowledge_full_5000":
            if not is_shared_table(table):
                q = q.eq("company_id", company_id)
            
            # Dynamically fetch company's resolved statuses
            resolved_statuses = ["RESOLVED", "VERIFIED", "FIXED", "PROCESSED"]
            if company_id:
                co_res = supabase.table("companies").select("resolved_statuses").eq("id", company_id).execute()
                if co_res.data and co_res.data[0].get("resolved_statuses"):
                    resolved_statuses = co_res.data[0]["resolved_statuses"]
            
            q = q.in_("status", [s.upper() for s in resolved_statuses])

        return q.execute().data or []
    except Exception as e:
        print(f"_fetch_resolved_rows error: {e}")
        return []


@app.post("/api/resolution-support/search")
def search_resolution_support(
    payload:      ResolutionSearchRequest,
    current_user: dict = Depends(auth.require_active),
):
    query = payload.summary.strip()
    resolution_filter = (payload.resolution_filter or "").strip().lower()
    component_filter = (payload.component_filter or "").strip().lower()
    severity_filter = (payload.severity_filter or "").strip().upper()
    min_days = payload.min_days
    max_days = payload.max_days

    if not query:
        return {"results": [], "source": "company"}

    table, is_mozilla, company_id = _resolution_source(current_user)

    # Users with no company assignment yet get an empty result set
    if not is_mozilla and current_user.get("company_id") is None:
        return {"results": [], "source": "company"}

    words       = [w.lower() for w in re.split(r"\s+", query) if len(w) >= 3]
    rows        = _fetch_resolved_rows(table, company_id, limit=1000, start_offset=1200)
    scored      = []

    for row in rows:
        summary = (row.get("summary") or "").lower()
        component = (row.get("component") or "").lower()
        resolution_text = (row.get("resolution_text") or "").lower()
        resolution_value = (row.get("resolution") or "").lower()
        severity_value = (row.get("severity") or "").strip().upper()
        resolved_in_days = row.get("resolved_in_days")

        # Apply filters
        if resolution_filter and resolution_value != resolution_filter:
            continue
        if component_filter and component_filter not in component:
            continue
        if severity_filter and severity_value != severity_filter:
            continue

        resolved_days_int = None
        if resolved_in_days is not None:
            try:
                resolved_days_int = int(resolved_in_days)
            except (TypeError, ValueError):
                pass

        if min_days is not None and (resolved_days_int is None or resolved_days_int < min_days):
            continue
        if max_days is not None and (resolved_days_int is None or resolved_days_int > max_days):
            continue

        # Match logic
        matched_summary_keywords = []
        matched_resolution_keywords = []

        for word in words:
            in_summary = word in summary
            in_resolution = word in resolution_text

            if in_summary:
                matched_summary_keywords.append(word)

            if in_resolution:
                matched_resolution_keywords.append(word)

        # If the search keyword is not in the summary, do not show this result.
        if not matched_summary_keywords:
            continue

        # Strong match = same keyword appears in both summary and resolution details.
        common_words = [
            word for word in matched_summary_keywords
            if word in matched_resolution_keywords
        ]

        if common_words:
            row["match_level"] = "strong"
            row["match_reasons"] = [
                "Search keyword matched both the bug summary and resolution details"
            ]
        else:
            row["match_level"] = "match"
            row["match_reasons"] = [
                "Search keyword matched the bug summary"
            ]

        row["matched_keywords"] = {
            "summary": matched_summary_keywords,
            "resolution_text": matched_resolution_keywords,
            "component": [],
            "severity": [],
        }

        scored.append(row)

    scored.sort(key=lambda x: 0 if x.get("match_level") == "strong" else 1)
    return {"results": scored[:5], "source": "mozilla" if is_mozilla else "company"}



@app.get("/api/resolution-support/component-trends")
def get_resolution_component_trends(current_user: dict = Depends(auth.require_active)):
    table, is_mozilla, company_id = _resolution_source(current_user)

    if not is_mozilla and current_user.get("company_id") is None:
        return {"trends": [], "source": "company"}

    rows   = _fetch_resolved_rows(table, company_id, select="component", limit=5000)
    counts: dict = {}
    for row in rows:
        comp = (row.get("component") or "Unknown").strip() or "Unknown"
        counts[comp] = counts.get(comp, 0) + 1

    trends = sorted(
        [{"component": k, "count": v} for k, v in counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:8]
    return {"trends": trends, "source": "mozilla" if is_mozilla else "company"}


@app.get("/api/resolution-support/component-resolution-correlation")
def get_component_resolution_correlation(current_user: dict = Depends(auth.require_active)):
    table, is_mozilla, company_id = _resolution_source(current_user)

    if not is_mozilla and current_user.get("company_id") is None:
        return {"correlations": [], "source": "company"}

    rows    = _fetch_resolved_rows(table, company_id, select="component, resolved_in_days", limit=5000)
    grouped: dict = {}
    for row in rows:
        comp = (row.get("component") or "Unknown").strip() or "Unknown"
        try:
            days = int(row.get("resolved_in_days"))
        except (TypeError, ValueError):
            continue
        if comp not in grouped:
            grouped[comp] = {"total_days": 0, "count": 0}
        grouped[comp]["total_days"] += days
        grouped[comp]["count"]      += 1

    correlations = [
        {"component": comp, "average_resolved_days": round(v["total_days"] / v["count"], 1), "count": v["count"]}
        for comp, v in grouped.items() if v["count"] > 0
    ]
    correlations.sort(key=lambda x: x["average_resolved_days"], reverse=True)
    return {"correlations": correlations[:8], "source": "mozilla" if is_mozilla else "company"}


@app.get("/api/resolution-support/severity-vs-resolved-days-correlation")
def get_severity_vs_resolved_days_correlation(
    current_user: dict = Depends(auth.require_active)
):
    table, is_mozilla, company_id = _resolution_source(current_user)

    if not is_mozilla and current_user.get("company_id") is None:
        return {"points": [], "source": "company"}

    rows = _fetch_resolved_rows(
        table,
        company_id,
        select="source_bug_id, severity, resolved_in_days",
        limit=5000,
        start_offset=1200
    )

    severity_map = {"S1": 1, "S2": 2, "S3": 3, "S4": 4}
    valid_points = []

    for row in rows:
        severity = (row.get("severity") or "").strip().upper()
        raw_days = row.get("resolved_in_days")

        if severity not in severity_map:
            continue

        try:
            days = float(raw_days)
        except (TypeError, ValueError):
            continue

        valid_points.append({
            "x": severity_map[severity],
            "y": days,
            "label": f"{row.get('source_bug_id') or 'Bug'} ({severity})",
        })

    return {
        "points": valid_points[:1000],
        "source": "mozilla" if is_mozilla else "company",
    }


@app.get("/api/resolution-support/component-severity-distribution")
def get_component_severity_distribution(
    current_user: dict = Depends(auth.require_active)
):
    table, is_mozilla, company_id = _resolution_source(current_user)

    if not is_mozilla and current_user.get("company_id") is None:
        return {"rows": [], "source": "company"}

    rows = _fetch_resolved_rows(
        table,
        company_id,
        select="component, severity",
        limit=5000,
        start_offset=1200
    )

    severity_order = {"S1", "S2", "S3", "S4"}
    counts = {}

    for row in rows:
        component = (row.get("component") or "").strip()
        severity = (row.get("severity") or "").strip().upper()

        if not component or severity not in severity_order:
            continue

        key = (component, severity)
        counts[key] = counts.get(key, 0) + 1

    component_totals = {}
    for (component, severity), count in counts.items():
        component_totals[component] = component_totals.get(component, 0) + count

    top_components = sorted(
        component_totals.items(),
        key=lambda x: x[1],
        reverse=True
    )[:8]

    top_component_names = {name for name, _ in top_components}

    result_rows = []
    for (component, severity), count in counts.items():
        if component in top_component_names:
            result_rows.append({
                "component": component,
                "severity": severity,
                "count": count,
            })

    result_rows.sort(
        key=lambda r: (
            next((i for i, (name, _) in enumerate(top_components) if name == r["component"]), 999),
            r["severity"]
        )
    )

    return {
        "rows": result_rows,
        "source": "mozilla" if is_mozilla else "company",
    }


# Koshi Resolution Support
@app.get("/api/resolution-support/summary-length-correlation")
def get_summary_length_correlation(current_user: dict = Depends(auth.require_active)):
    table, is_mozilla, company_id = _resolution_source(current_user)

    if not is_mozilla and current_user.get("company_id") is None:
        return {"points": [], "source": "company"}

    rows = _fetch_resolved_rows(
        table,
        company_id,
        select="source_bug_id, summary, resolved_in_days",
        limit=5000
    )

    points = []

    for row in rows:
        summary = (row.get("summary") or "").strip()
        raw_days = row.get("resolved_in_days")

        if not summary:
            continue

        try:
            days = float(raw_days)
        except (TypeError, ValueError):
            continue

        points.append({
            "x": len(summary),
            "y": days,
            "label": str(row.get("source_bug_id") or "Bug"),
        })

    return {"points": points[:150], "source": "mozilla" if is_mozilla else "company"}


@app.get("/api/resolution-support/resolution-text-length-correlation")
def get_resolution_text_length_correlation(current_user: dict = Depends(auth.require_active)):
    table, is_mozilla, company_id = _resolution_source(current_user)

    if not is_mozilla and current_user.get("company_id") is None:
        return {"points": [], "source": "company"}

    rows = _fetch_resolved_rows(
        table,
        company_id,
        select="source_bug_id, resolution_text, resolved_in_days",
        limit=5000
    )

    points = []

    for row in rows:
        resolution_text = (row.get("resolution_text") or "").strip()
        raw_days = row.get("resolved_in_days")

        if not resolution_text:
            continue

        try:
            days = float(raw_days)
        except (TypeError, ValueError):
            continue

        points.append({
            "x": len(resolution_text),
            "y": days,
            "label": str(row.get("source_bug_id") or "Bug"),
        })

    return {"points": points[:150], "source": "mozilla" if is_mozilla else "company"}


@app.get("/api/resolution-support/summary-vs-resolution-length-correlation")
def get_summary_vs_resolution_length_correlation(current_user: dict = Depends(auth.require_active)):
    table, is_mozilla, company_id = _resolution_source(current_user)

    if not is_mozilla and current_user.get("company_id") is None:
        return {"points": [], "source": "company"}

    rows = _fetch_resolved_rows(
        table,
        company_id,
        select="source_bug_id, summary, resolution_text",
        limit=5000
    )

    points = []

    for row in rows:
        summary = (row.get("summary") or "").strip()
        resolution_text = (row.get("resolution_text") or "").strip()

        if not summary or not resolution_text:
            continue

        points.append({
            "x": len(resolution_text),
            "y": len(summary),
            "label": str(row.get("source_bug_id") or "Bug"),
        })

    return {"points": points[:150], "source": "mozilla" if is_mozilla else "company"}
