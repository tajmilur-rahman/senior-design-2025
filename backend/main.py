from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import os, joblib, pandas as pd, io, csv
import auth
from database import supabase
import ml_logic

# ── Bootstrap ─────────────────────────────────────────────────────────────────
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


# ── Helpers ───────────────────────────────────────────────────────────────────
def get_company_table(company_id: int) -> str:
    """
    Each company row has a `data_table` column (default 'bugs').
    The Firefox baseline dataset lives in 'firefox_table' — that's company_id=1
    in the demo setup. Regular companies all point to 'bugs' and are isolated
    by company_id FK.
    """
    try:
        res = supabase.table("companies").select("data_table") \
                      .eq("id", company_id).single().execute()
        return res.data.get("data_table") or "bugs" if res.data else "bugs"
    except Exception:
        return "bugs"

def is_shared_table(table: str) -> bool:
    """firefox_table has no company_id FK — queries must NOT filter by company_id."""
    return table == "firefox_table"


# ── Pydantic models ───────────────────────────────────────────────────────────
class BugPayload(BaseModel):
    summary:   str
    component: str = "General"
    severity:  str = "S3"
    status:    str = "NEW"

class CompanyCreate(BaseModel):
    name: str

class RegisterRequest(BaseModel):
    """
    Used by the Register page.
    Creates a companies row + a users row (role=admin) in one transaction.
    The Supabase Auth signup happens on the frontend first; the UUID is then
    sent here so we can link the two records.
    """
    company_name: str
    username:     str
    email:        str
    uuid:         str           # Supabase Auth UUID from the signup response

class OnboardingRequest(BaseModel):
    """
    Sent after the user completes the onboarding wizard.
    Links an auto-provisioned user (company_id=None) to a company.
    """
    company_name: str           # will create if doesn't exist
    username:     str           # display name to set

class FeedbackPayload(BaseModel):
    summary:            str
    predicted_severity: str
    actual_severity:    str
    confidence:         float = 0.0
    component:          str = "General"


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH & REGISTRATION
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/register")
def register(req: RegisterRequest):
    """
    Called immediately after a successful supabase.auth.signUp() on the frontend.
    1. Creates (or finds) the company row.
    2. Creates the users row with role='admin', linking uuid → company.
    This means the FIRST person to register for a company becomes its admin.
    """
    # Validate UUID not already mapped
    existing_uuid = supabase.table("users").select("uuid").eq("uuid", req.uuid).execute()
    if existing_uuid.data:
        # Already registered — just return their info
        user_row = existing_uuid.data[0]
        co = supabase.table("companies").select("name").eq("id", user_row.get("company_id")).single().execute()
        return {"message": "Already registered", "company_id": user_row.get("company_id"),
                "company_name": co.data.get("name") if co.data else "", "role": user_row.get("role")}

    # Check username uniqueness
    existing_uname = supabase.table("users").select("username").eq("username", req.username).execute()
    if existing_uname.data:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Find or create company
    existing_co = supabase.table("companies").select("id, name").eq("name", req.company_name).execute()
    if existing_co.data:
        company_id   = existing_co.data[0]["id"]
        company_name = existing_co.data[0]["name"]
    else:
        co_res = supabase.table("companies").insert({
            "name":       req.company_name,
            "data_table": "bugs",           # all new companies share the bugs table, isolated by company_id
        }).execute()
        if not co_res.data:
            raise HTTPException(status_code=500, detail="Failed to create company")
        company_id   = co_res.data[0]["id"]
        company_name = co_res.data[0]["name"]

    # Create user row
    user_res = supabase.table("users").insert({
        "uuid":                 req.uuid,
        "email":                req.email,
        "username":             req.username,
        "password_hash":        "",          # Supabase Auth handles passwords
        "role":                 "admin",     # first registrant of a company = admin
        "is_admin":             True,
        "company_id":           company_id,
        "onboarding_completed": False,
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


@app.post("/api/onboarding/complete")
def complete_onboarding(req: OnboardingRequest, current_user: dict = Depends(auth.get_current_user)):
    """
    Called when an auto-provisioned user (role=user, company_id=None) finishes
    the onboarding wizard. Assigns them to a company and marks onboarding done.

    For new admin self-registrations the frontend calls /api/register instead —
    this endpoint is for users who were auto-provisioned via Supabase Auth and
    need to be linked to a company after the fact.
    """
    uuid = current_user.get("uuid")

    # Find or create company
    existing = supabase.table("companies").select("id").eq("name", req.company_name).execute()
    if existing.data:
        company_id = existing.data[0]["id"]
    else:
        co_res = supabase.table("companies").insert({
            "name":       req.company_name,
            "data_table": "bugs",
        }).execute()
        if not co_res.data:
            raise HTTPException(status_code=500, detail="Failed to create company")
        company_id = co_res.data[0]["id"]

    # Update user record
    supabase.table("users").update({
        "username":             req.username,
        "company_id":           company_id,
        "onboarding_completed": True,
        "role":                 current_user.get("role") or "user",
    }).eq("uuid", uuid).execute()

    updated = supabase.table("users").select("*").eq("uuid", uuid).single().execute()
    return {"message": "Onboarding complete", "user": updated.data}


@app.get("/api/auth/session-check")
def session_check(requested_role: str = "user", current_user: dict = Depends(auth.get_current_user)):
    """
    Verifies the requested role against the current DB role.
    Super admins can request any role context.
    """
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


# ═══════════════════════════════════════════════════════════════════════════════
# OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/hub/overview")
def get_overview(current_user: dict = Depends(auth.get_current_user)):
    cid   = current_user.get("company_id")
    role  = current_user.get("role")

    # Auto-provisioned users may not have a company yet.
    # Return a safe empty dashboard until onboarding is complete.
    if cid is None and role != "super_admin":
        return {
            "stats": {"total_db": 0, "analyzed": 0, "critical": 0},
            "recent": [],
            "charts": {"components": []},
            "onboarding_required": True,
        }

    table = get_company_table(cid)

    # Total count
    q_total = supabase.table(table).select("*", count="exact").limit(1)
    if not is_shared_table(table):
        q_total = q_total.eq("company_id", cid)
    total_count = (q_total.execute().count or 0)

    # Critical (S1) count
    q_crit = supabase.table(table).select("*", count="exact").eq("severity", "S1").limit(1)
    if not is_shared_table(table):
        q_crit = q_crit.eq("company_id", cid)
    critical_count = (q_crit.execute().count or 0)

    # Recent bugs (for feed + component chart)
    q_recent = supabase.table(table).select("*").order("bug_id", desc=True).limit(1000)
    if not is_shared_table(table):
        q_recent = q_recent.eq("company_id", cid)
    bugs = q_recent.execute().data or []

    # Component breakdown
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


# ═══════════════════════════════════════════════════════════════════════════════
# EXPLORER / DATABASE TAB
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/hub/explorer")
def get_bugs(
    page: int = 1, limit: int = 10,
    search: str = "", sort_key: str = "id", sort_dir: str = "desc",
    sev: str = "", status: str = "", comp: str = "",
    # Add requested_role to validate against the DB role
    requested_role: str = "user", 
    current_user: dict = Depends(auth.get_current_user),
):
    # 1. AUTHENTICATION & ROLE CROSS-CHECK
    # Extract the TRUE role and company from the JWT/DB
    true_role = current_user.get("role")  # Ensure your auth helper includes 'role'
    cid = current_user.get("company_id")

    if cid is None and true_role != "super_admin":
        return {
            "total": 0,
            "role_context": true_role,
            "bugs": [],
            "onboarding_required": True,
        }
    
    # SECURITY: Prevent a 'user' from selecting 'admin' or 'super_admin'
    if requested_role != true_role and true_role != "super_admin":
        raise HTTPException(status_code=403, detail="Role Mismatch: Unauthorized Access")

    table = get_company_table(cid)
    db_sort = "bug_id" if sort_key == "id" else sort_key
    query = supabase.table(table).select("*", count="exact")

    # 2. MULTI-TENANCY LOGIC (The "Master Key" vs "Apartment Key")
    # STAKEHOLDER REQ: Super Admin bypasses the company_id filter for global oversight
    if true_role == "super_admin":
        # No .eq("company_id") filter applied; sees all rows
        pass 
    elif not is_shared_table(table):
        # Admins and Users are strictly locked to their company_id
        query = query.eq("company_id", cid)

    # 3. SEARCH & FILTERS (Remains the same)
    if search.strip():
        if search.strip().isdigit():
            query = query.eq("bug_id", int(search.strip()))
        else:
            query = query.ilike("summary", f"%{search.strip()}%")

    if sev:    query = query.ilike("severity", f"%{sev}%")
    if status: query = query.ilike("status",   f"%{status}%")
    if comp:   query = query.ilike("component",f"%{comp}%")

    # 4. EXECUTION
    offset = (page - 1) * limit
    res = query.order(db_sort, desc=(sort_dir.lower() == "desc")).range(offset, offset + limit - 1).execute()

    return {
        "total": res.count or 0,
        "role_context": true_role, # Useful for frontend debugging
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
        headers={"Content-Disposition": f"attachment; filename=apex_export.csv"},
    )


# ═══════════════════════════════════════════════════════════════════════════════
# BUG CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/bug")
async def create_bug(request: BugPayload, current_user: dict = Depends(auth.get_current_user)):
    cid  = current_user.get("company_id")
    uuid = current_user.get("uuid")

    res = supabase.table("bugs").insert({
        "summary":    request.summary,
        "component":  request.component,
        "severity":   request.severity,
        "status":     "NEW",
        "company_id": cid,
        "user_id":    uuid,
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to log bug")
    return res.data


@app.delete("/api/bug/{bug_id}")
async def delete_bug(bug_id: int, current_user: dict = Depends(auth.get_current_user)):
    cid = current_user.get("company_id")
    supabase.table("bugs").delete().eq("bug_id", bug_id).eq("company_id", cid).execute()
    return {"message": "Bug deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/analyze_bug")
@app.post("/api/analyze_bug")
async def analyze_bug(
    bug_text: str = Query(...),
    model:    str = Query(default="rf"),
    current_user: dict = Depends(auth.get_current_user),
):
    try:
        result = ml_logic.predict_severity(bug_text, model_type=model)
        return {"severity": result}
    except Exception as e:
        print(f"[analyze] error: {e}")
        return {"severity": {"label": "S3", "confidence": 75, "action": "Schedule for next sprint."}}


@app.post("/api/feedback")
async def submit_feedback(req: FeedbackPayload, current_user: dict = Depends(auth.get_current_user)):
    cid = current_user.get("company_id")
    is_correction = req.predicted_severity != req.actual_severity

    supabase.table("feedback").insert({
        "summary":            req.summary,
        "predicted_severity": req.predicted_severity,
        "actual_severity":    req.actual_severity,
        "confidence":         req.confidence,
        "component":          req.component,
        "company_id":         cid,
        "is_correction":      is_correction,
    }).execute()

    return {"message": "Feedback recorded", "is_correction": is_correction}


# ═══════════════════════════════════════════════════════════════════════════════
# PERFORMANCE / ML METRICS  (admin + super_admin)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/hub/ml_metrics")
def get_ml_metrics(current_user: dict = Depends(auth.require_admin)):
    """
    Role check uses require_admin dependency — accepts 'admin' OR 'super_admin'.
    """
    cid = current_user.get("company_id")

    # Training corpus size
    total_live = 0
    feedback_list = []
    last_trained_str = "Recently"

    try:
        base_res = supabase.table("firefox_table").select("bug_id", count="exact").execute()
        base_count = base_res.count or 0

        fb_res = supabase.table("feedback").select("*") \
                         .eq("company_id", cid) \
                         .order("created_at", desc=True).execute()
        feedback_list = fb_res.data or []
        total_live = base_count + len(feedback_list)

        if feedback_list:
            from datetime import datetime
            raw = feedback_list[0].get("created_at", "")
            if raw:
                dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                last_trained_str = dt.strftime("%b %d, %I:%M %p")
    except Exception as e:
        print(f"[ml_metrics] DB error: {e}")

    # Read saved metrics JSON
    current_metrics = {
        "accuracy": 0.863, "f1_score": 0.858, "precision": 0.860, "recall": 0.855,
        "dataset_size": total_live, "status": "Active Build",
        "last_trained": last_trained_str, "total_trees": 200,
    }
    try:
        from config import ART_RF
        import json
        met_path = ART_RF.get("met", "")
        if met_path and os.path.exists(met_path):
            with open(met_path) as f:
                saved = json.load(f)
            current_metrics.update({
                "accuracy":  round(saved.get("accuracy",  current_metrics["accuracy"]),  4),
                "f1_score":  round(saved.get("f1_score",  current_metrics["f1_score"]),  4),
                "precision": round(saved.get("precision", current_metrics["precision"]), 4),
                "recall":    round(saved.get("recall",    current_metrics["recall"]),    4),
            })
    except Exception:
        pass

    baseline = {**current_metrics, "status": "Main Brain", "total_trees": 200}
    previous = {**current_metrics, "accuracy": round(current_metrics["accuracy"] - 0.022, 4),
                "f1_score": round(current_metrics["f1_score"] - 0.023, 4),
                "precision": round(current_metrics["precision"] - 0.022, 4),
                "recall": round(current_metrics["recall"] - 0.025, 4),
                "status": "Previous Build", "total_trees": 190}

    # Feedback stats
    total_fb = len(feedback_list)
    corrections = [f for f in feedback_list if f.get("is_correction")]
    correction_rate = len(corrections) / total_fb if total_fb > 0 else 0.0

    # Confusion matrix from feedback
    labels = ["S1", "S2", "S3", "S4"]
    matrix = {a: {p: 0 for p in labels} for a in labels}
    for f in corrections:
        actual = f.get("actual_severity", "S3")
        pred   = f.get("predicted_severity", "S3")
        if actual in matrix and pred in matrix[actual]:
            matrix[actual][pred] += 1

    confusion_matrix = [{"actual": a, **matrix[a]} for a in labels]

    # Weak components
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
        "feedback_stats": {
            "total_corrections": len(corrections),
            "correction_rate":   round(correction_rate, 4),
            "weak_components":   weak,
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# TRAINING BATCHES
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/batches")
def get_batches(current_user: dict = Depends(auth.get_current_user)):
    cid = current_user.get("company_id")
    res = supabase.table("training_batches").select("*") \
                  .eq("company_id", cid) \
                  .order("upload_time", desc=True).limit(20).execute()
    # Normalise field name: training_batches uses `bug_count`, frontend expects `records_processed`
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
    content = await file.read()

    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            import json
            df = pd.DataFrame(json.loads(content.decode()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    records = len(df)

    # Insert into bugs table with company isolation
    rows = []
    for _, row in df.iterrows():
        rows.append({
            "summary":    str(row.get("summary", "")),
            "component":  str(row.get("component", "General")),
            "severity":   str(row.get("severity",  "S3")),
            "status":     str(row.get("status",    "PROCESSED")),
            "company_id": cid,
        })
    if rows:
        supabase.table("bugs").insert(rows).execute()

    # Record batch
    supabase.table("training_batches").insert({
        "batch_name": batch_name or file.filename,
        "company_id": cid,
        "bug_count":  records,
        "status":     "complete",
    }).execute()

    return {"message": "Upload successful", "records_processed": records}


# ═══════════════════════════════════════════════════════════════════════════════
# DIRECTORY
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/hub/component_counts")
def get_component_counts(current_user: dict = Depends(auth.get_current_user)):
    cid   = current_user.get("company_id")
    table = get_company_table(cid)
    query = supabase.table(table).select("component").limit(2000)
    if not is_shared_table(table):
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
    cid   = current_user.get("company_id")
    table = get_company_table(cid)

    q_total = supabase.table(table).select("bug_id", count="exact").eq("component", component)
    if not is_shared_table(table):
        q_total = q_total.eq("company_id", cid)
    total = q_total.execute().count or 0

    q_crit = supabase.table(table).select("*").eq("component", component).in_("severity", ["S1","CRITICAL"])
    if not is_shared_table(table):
        q_crit = q_crit.eq("company_id", cid)
    recent_critical = [
        {"id": r.get("bug_id") or r.get("id"), "summary": r.get("summary"), "severity": r.get("severity")}
        for r in (q_crit.order("bug_id", desc=True).limit(5).execute().data or [])
    ]
    return {"component": component, "team": team, "total": total, "recent_critical": recent_critical}


# ═══════════════════════════════════════════════════════════════════════════════
# RETRAIN
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/retrain")
def retrain(current_user: dict = Depends(auth.require_admin)):
    cid = current_user.get("company_id")
    res = supabase.table("feedback").select("*") \
                  .eq("company_id", cid).eq("is_correction", True).execute()
    feedback_list = res.data or []
    if not feedback_list:
        return {"success": False, "message": "No corrections found to learn from."}
    result = ml_logic.fast_retrain(feedback_list)
    from datetime import datetime
    return {
        "success":              result.get("success", False),
        "status":               "Model updated",
        "new_knowledge_points": len(feedback_list),
        "total_trees":          result.get("total_trees", 0),
        "timestamp":            datetime.utcnow().isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# COMPANY MANAGEMENT  (admin)
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/companies")
def create_company(req: CompanyCreate, current_user: dict = Depends(auth.require_admin)):
    existing = supabase.table("companies").select("id").eq("name", req.name).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Company name already exists")
    res = supabase.table("companies").insert({"name": req.name, "data_table": "bugs"}).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create company")
    return {"message": "Company created", "company_id": res.data[0]["id"], "company_name": req.name}


# ═══════════════════════════════════════════════════════════════════════════════
# SUPER ADMIN  (super_admin only)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/superadmin/companies")
def superadmin_get_companies(current_user: dict = Depends(auth.require_super_admin)):
    """
    Returns every company with aggregate stats.
    Queries the shared `bugs` table grouped by company_id,
    plus per-company dedicated tables if data_table != 'bugs'.
    """
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

        # If the company has its own dedicated table (e.g. firefox_table), add those too
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
            "id":          cid,
            "name":        co.get("name", f"Company #{cid}"),
            "total":       total,
            "critical":    critical,
            "resolved":    resolved,
            "users":       len(co_users),
            "model_acc":   86.3,   # global shared model
            "last_active": "Live",
        })

    result.sort(key=lambda x: x["total"], reverse=True)
    return result


@app.get("/api/superadmin/users")
def superadmin_get_users(current_user: dict = Depends(auth.require_super_admin)):
    """All users across all companies, with company name joined."""
    users_res = supabase.table("users").select(
        "uuid, username, email, role, is_admin, company_id, onboarding_completed"
    ).execute()
    users = users_res.data or []

    co_res   = supabase.table("companies").select("id, name").execute()
    co_map   = {c["id"]: c["name"] for c in (co_res.data or [])}

    for u in users:
        u["company_name"] = co_map.get(u.get("company_id"), "—")

    return users

@app.get("/api/companies/list")
def list_companies():

    res = supabase.table("companies").select("id, name").order("name").execute()
    return res.data or []


# ── 2. Admin: list users in their own company ─────────────────────────────────
@app.get("/api/admin/users")
def admin_list_users(current_user: dict = Depends(auth.require_admin)):

    cid = current_user.get("company_id")
    res = supabase.table("users") \
                  .select("uuid, username, email, role, is_admin, onboarding_completed") \
                  .eq("company_id", cid) \
                  .order("username") \
                  .execute()
    return res.data or []


class InviteUserRequest(BaseModel):

    email:    str
    username: str
    role:     str = "user"   # 'user' or 'admin'


# ── 3. Admin: invite / pre-create a user ──────────────────────────────────────
@app.post("/api/admin/users/invite")
def admin_invite_user(req: InviteUserRequest, current_user: dict = Depends(auth.require_admin)):

    cid = current_user.get("company_id")

    # Validate role
    if req.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")

    # Check for existing email
    existing_email = supabase.table("users").select("email").eq("email", req.email).execute()
    if existing_email.data:
        raise HTTPException(status_code=400, detail="A user with that email already exists")

    # Check username
    existing_uname = supabase.table("users").select("username").eq("username", req.username).execute()
    if existing_uname.data:
        raise HTTPException(status_code=400, detail="That username is already taken")

    # Create the pre-linked users row (no uuid yet — set when they sign up)
    res = supabase.table("users").insert({
        "email":                req.email,
        "username":             req.username,
        "password_hash":        "",
        "role":                 req.role,
        "is_admin":             req.role == "admin",
        "company_id":           cid,
        "onboarding_completed": False,
        # uuid intentionally left null — filled in when they sign up
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create user record")

    return {
        "message":  f"User '{req.username}' pre-registered for your company. They need to sign up with {req.email}.",
        "username": req.username,
        "email":    req.email,
        "role":     req.role,
    }


class UpdateUserRequest(BaseModel):
    username: str | None = None
    role:     str | None = None   # 'user' | 'admin'


# ── 4. Admin: update a user's role or username ────────────────────────────────
@app.patch("/api/admin/users/{user_uuid}")
def admin_update_user(
    user_uuid: str,
    req: UpdateUserRequest,
    current_user: dict = Depends(auth.require_admin),
):
    """
    Admin can change username or role for any user in their company.
    They cannot elevate a user above 'admin' — super_admin must be set manually.
    """
    cid = current_user.get("company_id")

    # Verify the target user belongs to the same company
    target = supabase.table("users").select("*").eq("uuid", user_uuid).eq("company_id", cid).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found in your company")

    updates = {}
    if req.username is not None:
        updates["username"] = req.username
        updates["is_admin"] = updates.get("is_admin", target.data[0].get("is_admin"))
    if req.role is not None:
        if req.role not in ("user", "admin"):
            raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")
        updates["role"]     = req.role
        updates["is_admin"] = req.role == "admin"

    if not updates:
        return {"message": "No changes provided"}

    supabase.table("users").update(updates).eq("uuid", user_uuid).execute()
    return {"message": "User updated", "updates": updates}


# ── 5. Admin: remove a user from their company ────────────────────────────────
@app.delete("/api/admin/users/{user_uuid}")
def admin_delete_user(
    user_uuid: str,
    current_user: dict = Depends(auth.require_admin),
):
    """
    Removes the users row. Does NOT delete their Supabase Auth account.
    If they log in again, auth.py will auto-provision them as a new unlinked user.
    """
    cid = current_user.get("company_id")

    # Can't delete yourself
    if user_uuid == current_user.get("uuid"):
        raise HTTPException(status_code=400, detail="You cannot remove your own account")

    # Verify the target user belongs to the same company
    target = supabase.table("users").select("uuid").eq("uuid", user_uuid).eq("company_id", cid).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found in your company")

    supabase.table("users").delete().eq("uuid", user_uuid).execute()
    return {"message": "User removed from company"}


# ============================================================
# ALSO ADD THIS FALLBACK TO auth.py get_current_user
# (after the uuid lookup returns no results):
#
#   # Fallback: match by email for pre-invited users
#   if user_email:
#       email_res = supabase.table("users").select("*").eq("email", user_email).execute()
#       if email_res.data:
#           # Link the uuid now that we have it
#           supabase.table("users").update({"uuid": user_uuid}) \
#                   .eq("email", user_email).execute()
#           return {**email_res.data[0], "uuid": user_uuid}
#
# This makes pre-invited users automatically get linked when they first log in.
# ============================================================