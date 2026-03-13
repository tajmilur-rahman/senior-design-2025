from fastapi import FastAPI, HTTPException, Depends, status, Form, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, joblib, pandas as pd, io, time
import auth
from database import supabase
from sqlalchemy import text
from fastapi.responses import StreamingResponse
import ml_logic

# --- AI & CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "rf_model.pkl")
VECTOR_PATH = os.path.join(BASE_DIR, "tfidf_vectorizer.pkl")

rf_model = None
vectorizer = None

def load_models():
    global rf_model, vectorizer
    try:
        if os.path.exists(MODEL_PATH) and os.path.exists(VECTOR_PATH):
            rf_model = joblib.load(MODEL_PATH)
            vectorizer = joblib.load(VECTOR_PATH)
            print("AI Models loaded successfully.")
        else:
            print("AI Models not found. Training needed.")
    except Exception as e:
        print(f"AI Load Error: {e}")


app = FastAPI()
load_models()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# --- HELPER FUNCTIONS ---
def get_company_table(cid: int) -> str:
    # Looks up which table this company's data lives in from the companies table.
    try:
        res = supabase.table("companies").select("data_table").eq("id", cid).single().execute()
        return res.data.get("data_table", "bugs") if res.data else "bugs"
    except Exception:
        return "bugs"  # Safe fallback — always default to bugs table


# --- DATA MODELS ---
class BugPayload(BaseModel):
    summary: str
    component: str = "General"
    severity: str = "S3"
    status: str = "pending"


class CreateBugRequest(BaseModel):
    bug: BugPayload


class CompanyCreate(BaseModel):
    name: str


class RegisterRequest(BaseModel):
    company_name: str
    username: str
    password: str


# ADDED: Data Model for Password Resets
class PasswordResetRequest(BaseModel):
    username: str
    new_password: str


class FeedbackRequest(BaseModel):
    summary: str
    predicted_severity: str
    actual_severity: str
    confidence: float = 0.0
    component: str = "General"


# --- ANALYSIS (The Brain) ---
@app.post("/api/analyze_bug")
async def analyze_bug(bug_text: str = Query(...), current_user=Depends(auth.get_current_user)):
    try:
        # 1. ACTUAL ML PREDICTION
        sev_label = "S3"
        confidence = 0.85
        if rf_model is not None and vectorizer is not None:
            vectorized_text = vectorizer.transform([bug_text])
            prediction = rf_model.predict(vectorized_text)[0]
            sev_label = str(prediction)

        # 2. RAG Logic (Fuzzy Search in Cloud)
        similar_bugs = []
        cid = current_user.get("company_id")
        search_table = get_company_table(cid)

        try:
            search_query = bug_text.strip()
            if len(search_query) > 2:
                response = supabase.table(search_table) \
                    .select("*") \
                    .ilike('summary', f'%{search_query[:20]}%') \
                    .limit(5) \
                    .execute()
                similar_bugs = response.data
        except Exception as e:
            print(f"RAG Search failed: {e}")

        return {
            "severity": {"label": sev_label, "confidence": confidence, "action": "Investigate"},
            "similar_bugs": similar_bugs,
            "analysis_context": {"method": "Random Forest + RAG"}
        }
    except Exception as e:
        print(f"Analysis failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- AUTH ENDPOINTS ---
@app.post("/api/login")
def login(creds: auth.LoginRequest):
    response = supabase.table("users").select("*").eq("username", creds.username).execute()
    user = response.data[0] if response.data else None
    if not user or not auth.verify_password(creds.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    token = auth.create_access_token(
        data={"sub": user["username"], "company_id": user["company_id"], "role": user.get("role", "user")})
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user["username"],
        "company_id": user["company_id"],
        "role": user.get("role", "user"),
        "onboarding_completed": user.get("onboarding_completed", False)
    }


@app.post("/api/feedback")
def submit_feedback(req: FeedbackRequest, current_user=Depends(auth.get_current_user)):
    cid = current_user.get("company_id")

    if req.predicted_severity == req.actual_severity:
        return {"message": "Prediction was correct, no feedback stored"}

    supabase.table("feedback").insert({
        "summary": req.summary,
        "predicted_severity": req.predicted_severity,
        "actual_severity": req.actual_severity,
        "confidence": req.confidence,
        "component": req.component,
        "company_id": cid,
    }).execute()

    retrain_result = {"success": False, "message": "Retrain skipped"}
    try:
        all_feedback = supabase.table("feedback").select("*") \
            .eq("company_id", cid).execute()

        if all_feedback.data:
            retrain_result = ml_logic.fast_retrain(all_feedback.data)
    except Exception as e:
        print(f"Auto retrain failed: {e}")
        retrain_result = {"success": False, "error": str(e)}

    return {
        "message": "Feedback saved.",
        "retrain": retrain_result
    }


@app.post("/api/model/retrain")
def manual_retrain(current_user=Depends(auth.get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    cid = current_user.get("company_id")

    res = supabase.table("feedback").select("*").eq("company_id", cid).execute()
    feedback_list = res.data or []

    if not feedback_list:
        return {
            "success": False,
            "message": "No feedback corrections found for your company. Submit some corrections first."
        }

    result = ml_logic.fast_retrain(feedback_list)

    return {
        "success": result.get("success", False),
        "message": result.get("message", "Retrain failed"),
        "total_trees": result.get("total_trees", 0),
        "records_used": result.get("records_used", 0),
        "feedback_count": len(feedback_list)
    }


@app.post("/api/users")
def create_user(req: auth.UserCreate):
    hashed_pwd = auth.get_password_hash(req.password)
    new_user = {
        "username": req.username,
        "password_hash": hashed_pwd,
        "role": "user",
        "company_id": req.company_id
    }
    supabase.table("users").insert(new_user).execute()
    return {"message": "User created successfully"}


# ADDED: Password Reset Endpoint
@app.put("/api/users")
def reset_password(req: PasswordResetRequest):
    response = supabase.table("users").select("*").eq("username", req.username).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="User not found.")

    hashed_pwd = auth.get_password_hash(req.new_password)

    try:
        supabase.table("users").update({"password_hash": hashed_pwd}).eq("username", req.username).execute()
        return {"message": "Password reset successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/api/users/complete_onboarding")
def complete_onboarding(current_user=Depends(auth.get_current_user)):
    supabase.table("users").update({"onboarding_completed": True}) \
        .eq("username", current_user.get("username")).execute()
    return {"message": "Onboarding complete"}


# --- COMPANY & REGISTRATION ---
@app.post("/api/companies")
def create_company(req: CompanyCreate):
    existing = supabase.table("companies").select("id").eq("name", req.name).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Company name already exists")

    res = supabase.table("companies").insert({"name": req.name}).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create company")

    company = res.data[0]
    return {"message": "Company created", "company_id": company["id"], "company_name": company["name"]}


@app.post("/api/register")
def register(req: RegisterRequest):
    existing_user = supabase.table("users").select("id").eq("username", req.username).execute()
    if existing_user.data:
        raise HTTPException(status_code=400, detail="Username already taken")

    existing_company = supabase.table("companies").select("id").eq("name", req.company_name).execute()
    if existing_company.data:
        raise HTTPException(status_code=400, detail="Company name already exists")

    company_res = supabase.table("companies").insert({"name": req.company_name}).execute()
    if not company_res.data:
        raise HTTPException(status_code=500, detail="Failed to create company")
    company_id = company_res.data[0]["id"]

    hashed_pwd = auth.get_password_hash(req.password)
    user_res = supabase.table("users").insert({
        "username": req.username,
        "password_hash": hashed_pwd,
        "role": "admin",
        "company_id": company_id
    }).execute()

    if not user_res.data:
        supabase.table("companies").delete().eq("id", company_id).execute()
        raise HTTPException(status_code=500, detail="Failed to create user")

    return {
        "message": "Registration successful",
        "company_id": company_id,
        "company_name": req.company_name,
        "username": req.username,
        "role": "admin"
    }


# --- DASHBOARD & OVERVIEW ---
@app.get("/api/hub/overview")
def get_overview(current_user=Depends(auth.get_current_user)):
    cid = current_user.get("company_id")
    table = get_company_table(cid)

    if table == "firefox_table":
        count_res = supabase.table("firefox_table").select("*", count="exact") \
            .eq("company_id", cid).limit(1).execute()
        total_count = count_res.count or 0
        res = supabase.table("firefox_table").select("*") \
            .eq("company_id", cid).limit(1000).execute()
    else:
        res = supabase.table("bugs").select("*").eq("company_id", cid).execute()
        total_count = len(res.data) if res.data else 0

    bugs = res.data or []
    critical_count = len([b for b in bugs if b.get("severity") in ["S1", "CRITICAL"]])
    components = {}
    for b in bugs:
        comp = b.get("component", "General")
        components[comp] = components.get(comp, 0) + 1

    top_5 = sorted([{"name": k, "value": v} for k, v in components.items()], key=lambda x: x['value'], reverse=True)[:5]
    return {
        "stats": {"total_db": total_count, "analyzed": total_count, "critical": critical_count},
        "recent": [{"id": b.get("bug_id") or b.get("id"), "summary": b.get("summary"), "severity": b.get("severity"),
                    "status": b.get("status")} for b in bugs[:5]],
        "charts": {"components": top_5}
    }


@app.get("/api/hub/component_counts")
def get_component_counts(current_user=Depends(auth.get_current_user)):
    cid = current_user.get("company_id")
    table = get_company_table(cid)
    res = supabase.table(table).select("component") \
        .eq("company_id", cid).limit(2000).execute()
    counts = {}
    for r in (res.data or []):
        comp = str(r.get("component")).strip().lower() if r.get("component") else "general"
        counts[comp] = counts.get(comp, 0) + 1
    return counts


@app.get("/api/hub/explorer")
def get_bugs(page: int = 1, limit: int = 10, search: str = "", sort_key: str = "id", sort_dir: str = "desc",
             sev: str = "", status: str = "", comp: str = "", current_user=Depends(auth.get_current_user)):
    cid = current_user.get("company_id")
    table = get_company_table(cid)
    db_sort = "bug_id" if sort_key == "id" else sort_key
    offset = (page - 1) * limit

    query = supabase.table(table).select("*", count="exact")
    if table == "bugs":
        query = query.eq("company_id", cid)

    if search: query = query.ilike("summary", f"%{search}%")
    if sev:    query = query.ilike("severity", f"%{sev}%")
    if status: query = query.ilike("status", f"%{status}%")
    if comp:   query = query.ilike("component", f"%{comp}%")

    res = query.order(db_sort, desc=(sort_dir.lower() == "desc")).range(offset, offset + limit - 1).execute()

    return {
        "total": res.count or 0,
        "bugs": [
            {
                "id": r.get("bug_id"),
                "summary": r.get("summary"),
                "component": r.get("component"),
                "severity": r.get("severity"),
                "status": r.get("status")
            } for r in (res.data or [])
        ]
    }


# --- BUG OPERATIONS ---
@app.post("/api/bug")
async def create_bug(request: CreateBugRequest, current_user=Depends(auth.get_current_user)):
    cid = current_user.get("company_id")
    new_bug = {
        "summary": request.bug.summary,
        "component": request.bug.component,
        "severity": request.bug.severity,
        "status": request.bug.status,
        "company_id": cid,
        "user_id": current_user.get("id")
    }

    res = supabase.table("bugs").insert(new_bug).execute()
    return res.data


@app.delete("/api/bug/{bug_id}")
async def delete_bug(bug_id: int, current_user=Depends(auth.get_current_user)):
    try:
        cid = current_user.get("company_id")
        supabase.table("bugs").delete().eq("bug_id", bug_id).eq("company_id", cid).execute()
        return {"message": "Purged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- BATCH & BULK ---
@app.get("/api/batches")
def get_batches(current_user=Depends(auth.get_current_user)):
    res = supabase.table("training_batches").select("*").eq("company_id", current_user.get("company_id")).order(
        "upload_time", desc=True).execute()
    return res.data


@app.post("/api/upload_and_train")
async def upload_and_train(
        batch_name: str = Form(...),
        file: UploadFile = File(...),
        current_user=Depends(auth.get_current_user)
):
    try:
        content = await file.read()
        cid = current_user.get("company_id")
        import json
        try:
            data = json.loads(content)
        except Exception as parse_err:
            raise HTTPException(status_code=400, detail="Invalid JSON format")

        batch_entry = {
            "batch_name": batch_name,
            "company_id": cid,
            "bug_count": len(data),
            "status": "completed"
        }
        supabase.table("training_batches").insert(batch_entry).execute()

        bugs_to_insert = []
        feedback_to_insert = []

        for item in data:
            summary = item.get('summary', 'No summary')
            pred_sev = str(item.get('predicted_severity', 'S3')).upper()
            act_sev = str(item.get('actual_severity', 'S3')).upper()
            comp = item.get('component', 'General')

            bugs_to_insert.append({
                "summary": summary,
                "component": comp,
                "severity": act_sev,
                "company_id": cid,
                "status": "processed"
            })

            feedback_to_insert.append({
                "company_id": cid,
                "summary": summary,
                "component": comp,
                "predicted_severity": pred_sev,
                "actual_severity": act_sev,
                "is_correction": (pred_sev != act_sev)
            })

        if bugs_to_insert:
            supabase.table("bugs").insert(bugs_to_insert).execute()

        if feedback_to_insert:
            supabase.table("feedback").insert(feedback_to_insert).execute()

        return {"message": "Success", "records_processed": len(data)}

    except Exception as e:
        print(f"UPLOAD ERROR: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/hub/ml_metrics")
def get_ml_metrics(current_user=Depends(auth.get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    cid = current_user.get("company_id")
    last_trained_str = "Recently"
    total_live_volume = 1000
    feedback_list = []
    total_feedback = 0

    try:
        bug_res = supabase.table("firefox_table").select("bug_id", count="exact").execute()
        base_count = bug_res.count if bug_res.count else 0

        fb_res = supabase.table("feedback").select("*").eq("company_id", cid).order("created_at", desc=True).execute()
        feedback_list = fb_res.data or []
        total_feedback = len(feedback_list)
        total_live_volume = base_count + total_feedback

        if feedback_list:
            from datetime import datetime
            import calendar

            raw_date = feedback_list[0].get('created_at')
            if raw_date:
                dt_obj = datetime.fromisoformat(raw_date.replace('Z', '+00:00'))
                local_ts = calendar.timegm(dt_obj.utctimetuple())
                local_dt = datetime.fromtimestamp(local_ts)
                last_trained_str = local_dt.strftime("%b %d, %I:%M %p")

    except Exception as e:
        print(f"Database count failed: {e}")

    current_metrics = {
        "accuracy": 0.86, "f1_score": 0.85, "precision": 0.86, "recall": 0.85,
        "dataset_size": total_live_volume,
        "status": "Active Build",
        "last_trained": last_trained_str
    }

    try:
        from config import ART_RF
        import json
        met_path = ART_RF.get("met", "")
        if met_path and os.path.exists(met_path):
            with open(met_path) as f:
                saved = json.load(f)
            current_metrics.update({
                "accuracy": saved.get("accuracy", 0.86),
                "f1_score": saved.get("weighted_f1", saved.get("f1_score", 0.85)),
                "precision": saved.get("precision", 0.86),
                "recall": saved.get("recall", 0.85),
                "dataset_size": total_live_volume,
                "status": "Dynamic Production Build",
                "last_trained": last_trained_str
            })
    except Exception as e:
        print(f"Could not load JSON metrics: {e}")

    severities = ["S1", "S2", "S3", "S4"]
    confusion = {s: {p: 0 for p in severities} for s in severities}

    for f in feedback_list:
        actual = str(f.get("actual_severity") or "S3").upper()
        predicted = str(f.get("predicted_severity") or "S3").upper()
        if actual in severities and predicted in severities:
            confusion[actual][predicted] += 1

    confusion_matrix = [
        {"actual": s, "S1": confusion[s]["S1"], "S2": confusion[s]["S2"],
         "S3": confusion[s]["S3"], "S4": confusion[s]["S4"]}
        for s in severities
    ]

    correction_rate = round(total_feedback / max(total_live_volume, 1), 3)

    component_errors = {}
    for f in feedback_list:
        comp = f.get("component", "General")
        component_errors[comp] = component_errors.get(comp, 0) + 1

    weak_components = sorted(
        [{"component": k, "corrections": v} for k, v in component_errors.items()],
        key=lambda x: x["corrections"], reverse=True
    )[:5]

    return {
        "current": current_metrics,
        "baseline": current_metrics,
        "previous": current_metrics,
        "confusion_matrix": confusion_matrix,
        "feedback_stats": {
            "total_corrections": total_feedback,
            "correction_rate": correction_rate,
            "weak_components": weak_components
        }
    }