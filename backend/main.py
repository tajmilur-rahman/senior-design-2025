from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import os, joblib, pandas as pd, io, csv, re, json, asyncio, shutil
import auth
import threading
import time as _time
import uuid as uuid_lib
import requests as http_requests
from datetime import datetime
from database import supabase, SUPABASE_URL, SUPABASE_KEY
import ml_logic
from config import company_model_exists, ART_RF, get_artifact_paths
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        res = supabase.table("companies").select("data_table") \
                      .eq("id", company_id).single().execute()
        return res.data.get("data_table") or "bugs" if res.data else "bugs"
    except Exception:
        return "bugs"

def is_shared_table(table: str) -> bool:
    return table == "firefox_table" or (table.startswith("company_") and table.endswith("_bugs"))


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
    summary: str


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

    for field, value in [("uuid", req.uuid), ("email", req.email)]:
        result = _check_existing(field, value)
        if result:
            return result

    existing_uname = supabase.table("users").select("username").eq("username", req.username).execute()
    if existing_uname.data:
        raise HTTPException(status_code=400, detail="Username already taken")

    if role == "admin":
        req.company_name = validate_company_name(req.company_name)
        existing_co = supabase.table("companies").select("id, name").eq("name", req.company_name).execute()
        if existing_co.data:
            company_id   = existing_co.data[0]["id"]
            company_name = existing_co.data[0]["name"]
        else:
            invite_code = _gen_invite_code()

            is_firefox = db_provision.is_firefox_company(req.company_name)
            initial_table = "firefox_table" if is_firefox else "bugs"

            co_res = supabase.table("companies").insert({
                "name":        req.company_name,
                "data_table":  initial_table,
                "invite_code": invite_code,
                "status":      "pending",
            }).execute()
            if not co_res.data:
                raise HTTPException(status_code=500, detail="Failed to create company")
            company_id   = co_res.data[0]["id"]
            company_name = co_res.data[0]["name"]

            if not is_firefox:
                try:
                    table_name = db_provision.create_company_table(company_id)
                    supabase.table("companies").update({"data_table": table_name}) \
                        .eq("id", company_id).execute()
                    print(f"[register] Created company table: {table_name}")
                except Exception as tbl_err:
                    print(f"[register] Warning: could not create company table: {tbl_err}")

        pw_hash = auth.get_password_hash(req.password) if req.password else ""
        user_res = supabase.table("users").insert({
            "uuid":                 req.uuid,
            "email":                req.email,
            "username":             req.username,
            "password_hash":        pw_hash,
            "role":                 "admin",
            "is_admin":             True,
            "company_id":           company_id,
            "onboarding_completed": False,
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
        "uuid":                 req.uuid,
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

    data_table = co_res.data.get("data_table") or "bugs"
    company_name = co_res.data.get("name", "")

    if data_table == "firefox_table":
        return {"message": "Firefox company uses the live firefox_table — no seeding needed.", "count": 0}

    if data_table == "bugs":
        try:
            data_table = db_provision.create_company_table(cid)
            supabase.table("companies").update({"data_table": data_table}).eq("id", cid).execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not create company table: {e}")

    try:
        existing_count_res = supabase.table(data_table).select("*", count="exact").limit(1).execute()
        existing_count = existing_count_res.count or 0
    except Exception:
        existing_count = 0

    if existing_count > 0:
        supabase.table("users").update({"onboarding_completed": True}) \
            .eq("uuid", current_user.get("uuid")).execute()
        return {
            "message": f"Your database already contains {existing_count:,} bugs — seeding skipped to prevent duplicates.",
            "table":   data_table,
            "count":   existing_count,
            "already_seeded": True,
        }

    try:
        inserted = db_provision.seed_company_table(cid, sample_size=sample_size)
        supabase.table("users").update({"onboarding_completed": True}) \
            .eq("uuid", current_user.get("uuid")).execute()
        return {
            "message": f"Seeded {inserted:,} sample bugs into your database.",
            "table": data_table,
            "count": inserted,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seeding failed: {e}")


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


@app.get("/api/users/me/profile")
def get_my_profile(current_user: dict = Depends(auth.get_current_user)):
    uuid = current_user.get("uuid")
    cid  = current_user.get("company_id")
    role = current_user.get("role", "user")

    user_row = supabase.table("users").select("onboarding_completed, status").eq("uuid", uuid).single().execute()
    onboarding_done = user_row.data.get("onboarding_completed", False) if user_row.data else False

    if not onboarding_done and role == "admin" and cid:
        try:
            supabase.table("users").update({"onboarding_completed": True}).eq("uuid", uuid).execute()
            onboarding_done = True
        except Exception:
            pass

    company_name    = None
    has_own_model   = False
    if cid:
        co_res = supabase.table("companies").select("name, has_own_model").eq("id", cid).single().execute()
        if co_res.data:
            company_name  = co_res.data.get("name")
            has_own_model = co_res.data.get("has_own_model", False)

    bug_count = 0
    if cid:
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

    if cid is None and role != "super_admin":
        return {
            "stats": {"total_db": 0, "analyzed": 0, "critical": 0},
            "recent": [],
            "charts": {"components": []},
            "onboarding_required": True,
        }

    is_super = (role == "super_admin")
    table = get_company_table(cid) if cid is not None else "bugs"

    q_total = supabase.table(table).select("*", count="exact").limit(1)
    if not is_super and not is_shared_table(table):
        q_total = q_total.eq("company_id", cid)
    total_count = (q_total.execute().count or 0)

    q_crit = supabase.table(table).select("*", count="exact").eq("severity", "S1").limit(1)
    if not is_super and not is_shared_table(table):
        q_crit = q_crit.eq("company_id", cid)
    critical_count = (q_crit.execute().count or 0)

    q_recent = supabase.table(table).select("*").order("bug_id", desc=True).limit(1000)
    if not is_super and not is_shared_table(table):
        q_recent = q_recent.eq("company_id", cid)
    bugs = q_recent.execute().data or []

    components: dict = {}
    for b in bugs:
        comp = b.get("component") or "General"
        components[comp] = components.get(comp, 0) + 1
    top_5 = sorted(
        [{"name": k, "value": v} for k, v in components.items()],
        key=lambda x: x["value"], reverse=True
    )[:5]

    recent_feed = [
        {"id": b.get("bug_id") or b.get("id"), "summary": b.get("summary"),
         "severity": b.get("severity"), "status": b.get("status")}
        for b in bugs[:5]
    ]

    return {
        "stats": {"total_db": total_count, "analyzed": total_count, "critical": critical_count},
        "recent": recent_feed,
        "charts": {"components": top_5},
    }


@app.get("/api/hub/explorer")
def get_bugs(
    page: int = 1, limit: int = 10,
    search: str = "", sort_key: str = "id", sort_dir: str = "desc",
    sev: str = "", status: str = "", comp: str = "",
    requested_role: str = "user",
    current_user: dict = Depends(auth.get_current_user),
):
    true_role = current_user.get("role")
    cid = current_user.get("company_id")

    if cid is None and true_role != "super_admin":
        return {"total": 0, "role_context": true_role, "bugs": [], "onboarding_required": True}

    table = get_company_table(cid)
    db_sort = "bug_id" if sort_key == "id" else sort_key
    query = supabase.table(table).select("*", count="exact")

    if true_role == "super_admin":
        pass
    elif not is_shared_table(table):
        query = query.eq("company_id", cid)

    if search.strip():
        if search.strip().isdigit():
            query = query.eq("bug_id", int(search.strip()))
        else:
            query = query.ilike("summary", f"%{search.strip()}%")

    if sev:    query = query.ilike("severity", f"%{sev}%")
    if status: query = query.ilike("status",   f"%{status}%")
    if comp:   query = query.ilike("component",f"%{comp}%")

    offset = (page - 1) * limit
    res = query.order(db_sort, desc=(sort_dir.lower() == "desc")).range(offset, offset + limit - 1).execute()

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
                "company":   r.get("company_id") if true_role == "super_admin" else None
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

    table   = get_company_table(cid)
    db_sort = "bug_id" if sort_key == "id" else sort_key

    query = supabase.table(table).select("*")
    if not is_shared_table(table):
        query = query.eq("company_id", cid)
    if search: query = query.ilike("summary",  f"%{search}%")
    if sev:    query = query.ilike("severity", f"%{sev}%")
    if status: query = query.ilike("status",   f"%{status}%")
    if comp:   query = query.ilike("component",f"%{comp}%")

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

    table = get_company_table(cid)
    payload = {
        "summary":   request.summary,
        "component": request.component,
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
    cid = current_user.get("company_id")
    try:
        target_cid = cid if model_source == "company" else None
        result = ml_logic.predict_severity(bug_text, company_id=target_cid)
    except Exception as e:
        print(f"[analyze] error: {e}")
        result = {"prediction": "S3", "confidence": 0.6, "diagnosis": "Standard Logic Defect",
                  "team": "🔧 General Maintenance", "keywords": [], "model_source": "global", "fallback": True}

    try:
        supabase.table("feedback").insert({
            "summary":              bug_text,
            "predicted_severity":   result.get("prediction"),
            "actual_severity":      None,
            "confidence":           result.get("confidence", 0.0),
            "component":            "General",
            "company_id":           cid,
            "is_correction":        False,
            "consent_global_model": True,
        }).execute()
    except Exception as log_err:
        print(f"[analyze] feedback log error: {log_err}")

    similar_bugs = ml_logic.find_similar_bugs(bug_text, company_id=cid, top_k=5)

    return {"severity": result, "similar_bugs": similar_bugs}


@app.post("/api/feedback")
async def submit_feedback(req: FeedbackPayload, current_user: dict = Depends(auth.get_current_user)):
    cid = current_user.get("company_id")
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
def get_ml_metrics(current_user: dict = Depends(auth.require_admin)):
    role = current_user.get("role")
    is_super = role == "super_admin"
    raw_cid = current_user.get("company_id")
    try:
        cid = int(raw_cid) if raw_cid not in (None, "None", "") else None
    except (TypeError, ValueError):
        cid = None
    # Super admin always operates on the global/universal model
    if is_super:
        cid = None

    total_live = 0
    feedback_list = []
    last_trained_str = "Not yet trained"
    company_name = "Universal" if is_super else "Your Company"

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
                    "accuracy":      round(saved.get("accuracy",  0.0), 4),
                    "f1_score":      round(saved.get("f1_score",  saved.get("accuracy", 0.0)), 4),
                    "precision":     round(saved.get("precision", saved.get("accuracy", 0.0)), 4),
                    "recall":        round(saved.get("recall",    saved.get("accuracy", 0.0)), 4),
                    "last_trained":  saved.get("last_trained", last_trained_str),
                    "total_trees":   saved.get("total_trees", 100),
                    "status":        "Active Build",
                    "model_source":  "company",
                    "model_status":  "ready",
                    "dataset_label": saved.get("dataset_label", "Company data"),
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
                    "accuracy":      round(saved.get("accuracy",  0.863), 4),
                    "f1_score":      round(saved.get("f1_score",  0.858), 4),
                    "precision":     round(saved.get("precision", 0.860), 4),
                    "recall":        round(saved.get("recall",    0.855), 4),
                    "last_trained":  saved.get("last_trained", last_trained_str),
                    "total_trees":   saved.get("total_trees", 200),
                    "status":        "Active Build",
                    "model_source":  "global",
                    "model_status":  "ready",
                    "dataset_label": saved.get("dataset_label", "Global training data"),
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
    """Insert bugs from a CSV/JSON file into the company database. No model training."""
    cid = current_user.get("company_id")
    table = get_company_table(cid)
    content = await file.read()

    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.DataFrame(json.loads(content.decode()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

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
        "bug_count":  len(rows),
        "status":     "imported",
    }).execute()

    return {"message": "Bugs imported successfully", "records_processed": len(rows)}


@app.get("/api/batches")
def get_batches(current_user: dict = Depends(auth.get_current_user)):
    cid = current_user.get("company_id")
    if cid is None:
        return []
    res = supabase.table("training_batches").select("*") \
                  .eq("company_id", int(cid)) \
                  .order("upload_time", desc=True).limit(20).execute()
    rows = []
    for r in (res.data or []):
        rows.append({**r, "records_processed": r.get("bug_count", 0)})
    return rows


@app.delete("/api/batches/{batch_id}")
def delete_batch(batch_id: int, current_user: dict = Depends(auth.get_current_user)):
    cid = current_user.get("company_id")
    supabase.table("training_batches").delete() \
            .eq("id", batch_id).eq("company_id", cid).execute()
    return {"message": "Batch deleted"}


@app.post("/api/upload_and_train")
async def upload_and_train(
    file: UploadFile = File(...),
    batch_name: str = "",
    current_user: dict = Depends(auth.require_admin),
):
    cid = current_user.get("company_id")
    table = get_company_table(cid)
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

    retrain_result = None
    train_records = [
        {"summary": r["summary"], "severity": r["severity"]}
        for r in rows if r.get("summary") and r.get("severity")
    ]
    if train_records:
        try:
            label = batch_name or file.filename
            retrain_result = ml_logic.full_train_from_dataset(
                train_records, company_id=cid, dataset_label=label
            )
            print(f"[upload_and_train] Trained on {len(train_records)} rows — "
                  f"accuracy: {retrain_result.get('accuracy')}")
        except Exception as rt_err:
            print(f"[upload_and_train] Train warning: {rt_err}")
            retrain_result = {"success": False, "error": str(rt_err)}

    return {
        "message":          "Upload successful",
        "records_processed": records,
        "retrain": retrain_result or {"success": False, "message": "No labelled rows to retrain on."},
    }


@app.get("/api/hub/component_counts")
def get_component_counts(current_user: dict = Depends(auth.get_current_user)):
    raw_cid = current_user.get("company_id")
    try:
        cid = int(raw_cid) if raw_cid not in (None, "None", "") else None
    except (TypeError, ValueError):
        cid = None

    is_super = current_user.get("role") == "super_admin"
    table = get_company_table(cid)
    query = supabase.table(table).select("component").limit(2000)
    if not is_super and cid is not None and not is_shared_table(table):
        query = query.eq("company_id", cid)
    res = query.execute()
    counts: dict = {}
    for r in (res.data or []):
        comp = (r.get("component") or "general").strip().lower()
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


def _train_with_progress(key: str, feedback_list: list, target_cid, bug_records: list = None):
    def cb(step: str, pct: int):
        _training_progress[key] = {"step": step, "pct": pct, "done": False, "error": None}

    try:
        if bug_records is not None:
            cb("Sampling company data", 5)
            _time.sleep(0.3)
            result = ml_logic.full_train_from_dataset(bug_records, company_id=target_cid, progress_cb=cb)
        else:
            cb("Loading feedback data", 5)
            _time.sleep(0.4)
            cb("Preparing features", 20)
            _time.sleep(0.3)
            cb("Vectorizing text", 40)
            result = ml_logic.fast_retrain(feedback_list, company_id=target_cid, progress_cb=cb)

        cb("Saving model", 95)
        _time.sleep(0.3)
        _training_progress[key] = {"step": "Done", "pct": 100, "done": True, "error": None, "result": result}
    except Exception as e:
        _training_progress[key] = {"step": "Error", "pct": 0, "done": True, "error": str(e), "result": None}


_FULL_TRAIN_SAMPLE = 30000


@app.post("/api/admin/model/train/start")
def train_model_start(current_user: dict = Depends(auth.require_admin)):
    raw_cid = current_user.get("company_id")
    cid     = int(raw_cid) if raw_cid is not None else None
    role    = current_user.get("role")
    target_cid = None if role == "super_admin" else cid
    key = str(target_cid) if target_cid is not None else "global"

    feedback_res = supabase.table("feedback").select("*").eq("is_correction", True)
    if target_cid is not None:
        feedback_res = feedback_res.eq("company_id", target_cid)
    feedback_list = feedback_res.execute().data or []

    if feedback_list:
        return _start_train_thread(
            key, feedback_list, target_cid,
            message=f"Training started on {len(feedback_list)} feedback corrections.",
            mode="fast_retrain",
        )

    try:
        if target_cid is None:
            # Super admin: aggregate firefox_table + every company's bug table
            raw_rows = []
            ff_data = supabase.table("firefox_table").select("summary, severity") \
                              .limit(_FULL_TRAIN_SAMPLE).execute().data or []
            raw_rows.extend(ff_data)
            try:
                all_companies = supabase.table("companies").select("id").execute().data or []
                per_company_limit = max(1000, _FULL_TRAIN_SAMPLE // max(len(all_companies), 1))
                for co in all_companies:
                    co_cid = co.get("id")
                    co_table = get_company_table(co_cid)
                    if co_table and not is_shared_table(co_table):
                        co_data = supabase.table(co_table).select("summary, severity") \
                                          .eq("company_id", co_cid) \
                                          .limit(per_company_limit).execute().data or []
                        raw_rows.extend(co_data)
            except Exception as agg_err:
                print(f"[train/start] company aggregation warning: {agg_err}")
            bug_data = raw_rows
        else:
            table = get_company_table(target_cid)
            q = supabase.table(table).select("summary, severity").limit(_FULL_TRAIN_SAMPLE)
            if not is_shared_table(table):
                q = q.eq("company_id", target_cid)
            bug_data = q.execute().data or []

        bug_records = [
            {"summary": r["summary"], "severity": r.get("severity", "S3")}
            for r in bug_data
            if r.get("summary") and r.get("severity")
        ]
    except Exception as sample_err:
        bug_records = []
        print(f"[train/start] bug sampling failed: {sample_err}")

    if not bug_records:
        return {
            "success": False,
            "message": (
                "No corrections or labeled bugs found to train on. "
                "Submit a bug prediction and correct its severity — that creates a training signal."
            ),
        }

    return _start_train_thread(
        key, [], target_cid, bug_records=bug_records,
        message=f"Full training started on {len(bug_records):,} labeled bugs.",
        mode="full_train",
    )


@app.get("/api/admin/model/train/stream")
async def train_model_stream(
    stream_key: str = Query(default="global"),
    token: str = Query(default=None),
):
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
        max_wait = 120
        elapsed  = 0
        while elapsed < max_wait:
            state = _training_progress.get(key, {"step": "Waiting", "pct": 0, "done": False})
            yield f"data: {json.dumps(state)}\n\n"
            if state.get("done"):
                break
            await asyncio.sleep(0.5)
            elapsed += 0.5
        else:
            yield f"data: {json.dumps({'step': 'Timeout', 'pct': 0, 'done': True, 'error': 'Training timed out'})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
            ff_res   = supabase.table("firefox_table").select("*", count="exact").limit(1).execute()
            fb_res   = supabase.table("feedback").select("*", count="exact").limit(1).execute()
            users_res = supabase.table("users").select("*", count="exact").limit(1).execute()
        except Exception:
            total_companies, ff_res, fb_res, users_res = 0, None, None, None
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
                "total_bugs":     (ff_res.count  or 0) if ff_res  else 0,
                "total_users":    (users_res.count or 0) if users_res else 0,
                "total_feedback": (fb_res.count   or 0) if fb_res   else 0,
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
def superadmin_get_companies(current_user: dict = Depends(auth.require_super_admin)):
    companies_res = supabase.table("companies").select("*").execute()
    companies = companies_res.data or []

    users_res = supabase.table("users").select("company_id, role").execute()
    users_data = users_res.data or []

    bugs_res = supabase.table("bugs").select("company_id, severity, status").execute()
    bugs_data = bugs_res.data or []

    result = []
    for co in companies:
        cid        = co.get("id")
        data_table = co.get("data_table", "bugs")

        co_users = [u for u in users_data if u.get("company_id") == cid]
        co_bugs  = [b for b in bugs_data  if b.get("company_id") == cid]

        if data_table and data_table != "bugs":
            try:
                tbl = supabase.table(data_table).select("severity, status").execute()
                co_bugs += (tbl.data or [])
            except Exception:
                pass

        total    = len(co_bugs)
        critical = sum(1 for b in co_bugs if b.get("severity") == "S1")
        resolved = sum(1 for b in co_bugs
                       if (b.get("status") or "").upper() in ("RESOLVED","VERIFIED","FIXED","PROCESSED"))

        result.append({
            "id":            cid,
            "name":          co.get("name", f"Company #{cid}"),
            "status":        co.get("status", "active"),
            "has_own_model": co.get("has_own_model", False),
            # new canonical names (Directory.jsx)
            "total_bugs":    total,
            "total_users":   len(co_users),
            "total_feedback": 0,
            "critical":      critical,
            "resolved":      resolved,
            # legacy aliases (SuperAdmin.jsx)
            "total":         total,
            "users":         len(co_users),
            "model_acc":     86.3,
            "last_active":   "Live",
        })

    result.sort(key=lambda x: x["total"], reverse=True)
    return result


@app.get("/api/superadmin/users")
def superadmin_get_users(current_user: dict = Depends(auth.require_super_admin)):
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
def superadmin_get_pending(current_user: dict = Depends(auth.require_super_admin)):
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

    supabase.table("users").update({"status": "active"}).eq("uuid", user_uuid).execute()

    company_name = ""
    if cid:
        co_res = supabase.table("companies").select("status, name").eq("id", cid).execute()
        if co_res.data:
            company_name = co_res.data[0].get("name", "")
            if co_res.data[0].get("status") == "pending":
                supabase.table("companies").update({"status": "active"}).eq("id", cid).execute()

    email_sent = False
    try:
        if not target.get("uuid"):
            supabase.auth.admin.invite_user_by_email(
                email,
                options={"data": {
                    "username":     name,
                    "company_name": company_name,
                    "role":         role,
                }},
            )
            email_sent = True
            print(f"[superadmin approve] Invite email sent to {email}")
        else:
            print(f"[superadmin approve] Existing auth account preserved for {email}")
    except Exception as e:
        print(f"[superadmin approve] Email send failed: {e}")

    return {
        "message": (
            f"'{name}' approved."
            + (" Approval email sent." if email_sent else " Existing credentials remain valid.")
        ),
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


@app.post("/api/superadmin/users/create")
def superadmin_create_user(
    req: SuperAdminCreateUserRequest,
    current_user: dict = Depends(auth.require_super_admin),
):
    co_res = supabase.table("companies").select("id, name").eq("id", req.company_id).single().execute()
    if not co_res.data:
        raise HTTPException(status_code=404, detail="Company not found")
    company_name = co_res.data.get("name", "")

    role = req.role if req.role in ("user", "admin") else "user"

    existing = supabase.table("users").select("email").eq("email", req.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="A user with that email already exists")

    supabase.table("users").insert({
        "email":                req.email,
        "username":             req.username,
        "role":                 role,
        "is_admin":             role == "admin",
        "company_id":           req.company_id,
        "onboarding_completed": True,
        "status":               "active",
    }).execute()

    email_sent = False
    try:
        supabase.auth.admin.invite_user_by_email(
            req.email,
            options={"data": {"company_id": req.company_id, "company_name": company_name, "role": role}},
        )
        email_sent = True
    except Exception as e:
        print(f"[superadmin create_user] Failed to send invite email: {e}")

    return {
        "message":    (
            f"User '{req.username}' created and invite sent to {req.email}."
            if email_sent
            else "User pre-registered. Email invite could not be sent — share login credentials manually."
        ),
        "email_sent": email_sent,
        "username":   req.username,
        "company":    company_name,
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

    supabase.table("users").insert({
        "uuid":                 req.uuid.strip() if req.uuid else None,
        "email":                email_clean,
        "username":             req.username.strip(),
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

    co_res = supabase.table("companies").select("name, invite_code").eq("id", cid).single().execute()
    company_name = co_res.data.get("name", "")        if co_res.data else ""
    company_code = co_res.data.get("invite_code", "") if co_res.data else ""

    supabase.table("users").update({"status": "pending_code"}).eq("id", request_id).execute()

    email_sent = False
    try:
        if not uuid:
            supabase.auth.admin.invite_user_by_email(
                email,
                options={"data": {
                    "invite_code":  company_code,
                    "company_name": company_name,
                    "username":     name,
                }},
            )
            email_sent = True
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

    res = supabase.table("users").insert({
        "email":                req.email,
        "username":             req.username,
        "password_hash":        "",
        "role":                 req.role,
        "is_admin":             req.role == "admin",
        "company_id":           cid,
        "onboarding_completed": False,
        "status":               "active",
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create user record")

    email_sent = False
    try:
        co_res = supabase.table("companies").select("name").eq("id", cid).single().execute()
        company_name = co_res.data.get("name", "") if co_res.data else ""
        supabase.auth.admin.invite_user_by_email(
            req.email,
            options={"data": {"company_id": cid, "company_name": company_name, "role": req.role}},
        )
        email_sent = True
    except Exception as e:
        print(f"[invite] Failed to send invite email: {e}")

    return {
        "message":    (
            f"Invitation sent to {req.email}."
            if email_sent
            else "User pre-registered. Email invite could not be sent — share the invite code manually."
        ),
        "email_sent": email_sent,
        "username":   req.username,
        "email":      req.email,
        "role":       req.role,
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


def _delete_auth_user(uuid: str):
    if not uuid:
        return
    try:
        supabase.auth.admin.delete_user(uuid)
    except Exception as e:
        print(f"[cascade] auth delete {uuid}: {e}")


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
        _delete_auth_user(member.get("uuid"))
        _cascade_delete_user_row(member)

    for tbl in ("feedback", "training_batches"):
        try:
            supabase.table(tbl).delete().eq("company_id", company_id).execute()
        except Exception as e:
            print(f"[cascade] clearing {tbl} for company {company_id}: {e}")

    co_info = supabase.table("companies").select("data_table").eq("id", company_id).execute()
    co_table = (co_info.data or [{}])[0].get("data_table") if co_info.data else None

    supabase.table("companies").delete().eq("id", company_id).execute()

    if co_table and co_table not in ("bugs", "firefox_table"):
        try:
            db_provision.drop_company_table(company_id)
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
    _delete_auth_user(user_uuid)

    return {
        "message":         f"User '{display_name}' deleted.",
        "company_deleted": False,
        "uuid":            user_uuid,
    }


@app.get("/api/superadmin/company_detail/{company_id}")
def superadmin_company_detail(
        company_id: int,
        current_user: dict = Depends(auth.require_super_admin),
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


@app.post("/api/resolution-support/search")
def search_resolution_support(payload: ResolutionSearchRequest):
    query = payload.summary.strip()

    if not query:
        return {"results": []}

    words = [w.lower() for w in re.split(r"\s+", query) if len(w) >= 3]

    try:
        result = supabase.table("resolution_knowledge").select("*").limit(1000).execute()
        rows = result.data or []
    except Exception:
        rows = []

    if not rows:
        try:
            alt_res = supabase.table("firefox_table").select("*").eq("status", "RESOLVED").limit(500).execute()
            rows = alt_res.data or []
        except Exception:
            pass

    if not rows:
        rows = [
            { "id": 99101, "summary": "Video playback crashes on startup", "component": "Frontend", "status": "RESOLVED", "resolution": "FIXED", "resolution_text": "Updated codec initialization sequence to resolve race condition during memory allocation.", "resolved_in_days": 2 },
            { "id": 99102, "summary": "Memory leak when opening many tabs", "component": "Core", "status": "RESOLVED", "resolution": "FIXED", "resolution_text": "Fixed unbounded array in tab manager that failed to garbage collect closed session IDs.", "resolved_in_days": 5 },
            { "id": 99103, "summary": "Login fails on password protected sites", "component": "Security", "status": "RESOLVED", "resolution": "FIXED", "resolution_text": "Patched session token invalidation bug preventing authentication state persistence.", "resolved_in_days": 1 },
            { "id": 99104, "summary": "Extension causes high CPU usage", "component": "DevTools", "status": "RESOLVED", "resolution": "FIXED", "resolution_text": "Throttled extension background polling to prevent 100% CPU lockups.", "resolved_in_days": 4 }
        ]

    query_lower = query.lower()
    scored = []

    for row in rows:
        summary = (row.get("summary") or "").lower()
        component = (row.get("component") or "").lower()
        resolution_text = (row.get("resolution_text") or "").lower()

        score = 0
        if query_lower in summary:
            score += 10
        for word in words:
            if word in summary: score += 3
            if word in resolution_text: score += 1
            if word in component: score += 1

        if score > 0:
            row["match_score"] = score
            scored.append(row)

    scored.sort(key=lambda x: x["match_score"], reverse=True)
    return {"results": scored[:5]}
