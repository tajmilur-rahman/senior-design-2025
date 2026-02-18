from fastapi import FastAPI, HTTPException, Depends, status, Form, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, engine, supabase
from pydantic import BaseModel
import models, auth, time, os, json
from collections import Counter
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "rf_model.pkl")
VECTOR_PATH = os.path.join(BASE_DIR, "tfidf_vectorizer.pkl")
DB_PATH = os.path.join(BASE_DIR, "rag_db")

rf_model, tfidf_vectorizer, rag_collection, rag_model, rag_client = None, None, None, None, None

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# --- DATA MODELS ---
class BugPayload(BaseModel):
    summary: str
    component: str = "General"
    severity: str = "S3"
    status: str = "New"
    platform: str = "Windows"


class CreateBugRequest(BaseModel):
    bug: BugPayload
    company_id: int


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "admin"
    company_name: str


# --- AUTH ENDPOINTS ---
@app.post("/api/login")
def login(creds: auth.LoginRequest):
    response = supabase.table("users").select("*").eq("username", creds.username).execute()
    user = response.data[0] if response.data else None

    if not user or not auth.verify_password(creds.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    token = auth.create_access_token(data={"sub": user["username"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user["username"],
        "company_id": user["company_id"]
    }


@app.post("/api/users")
def create_user(req: RegisterRequest):
    existing = supabase.table("users").select("*").eq("username", req.username).execute()
    if existing.data: raise HTTPException(400, "Username taken")
    cid = int(time.time())
    h_pass = auth.get_password_hash(req.password)
    supabase.table("companies").insert({"id": cid, "name": req.company_name}).execute()
    supabase.table("users").insert(
        {"username": req.username, "password_hash": h_pass, "role": req.role, "company_id": cid}).execute()
    return {"message": "Created", "company_id": cid}


# --- BUG OPERATIONS ---
@app.post("/api/bug")
async def create_bug(bug_data: dict, current_user=Depends(auth.get_current_user)):
    bug_to_insert = {
        "summary": bug_data.get("bug_text") or bug_data.get("summary"),
        "component": bug_data.get("component", "General"),
        "severity": bug_data.get("severity", "S3"),
        "status": "pending",
        "company_id": current_user["company_id"],
        "data": bug_data.get("extra_info", {})
    }
    response = supabase.table("firefox_table").insert(bug_to_insert).execute()
    if not response.data: raise HTTPException(500, "Failed to save")
    return response.data[0]


# --- NEW: DELETE ENDPOINTS ---
@app.delete("/api/bug/{bug_id}")
def delete_bug(bug_id: int, current_user=Depends(auth.get_current_user)):
    # Delete from firefox_table
    supabase.table("firefox_table").delete().eq("bug_id", bug_id).execute()
    return {"message": "Deleted"}


@app.delete("/api/batch/{batch_id}")
def delete_batch(batch_id: int, current_user=Depends(auth.get_current_user)):
    # Delete from training_batches
    supabase.table("training_batches").delete().eq("id", batch_id).execute()
    return {"message": "Batch removed"}


@app.get("/api/hub/overview")
def get_overview(current_user=Depends(auth.get_current_user)):
    cid = current_user["company_id"]
    stats_res = supabase.table("firefox_table").select("component, severity, status").eq("company_id", cid).limit(
        3000).execute()
    rows = stats_res.data
    total = len(rows)
    critical = len([r for r in rows if "s1" in r.get("severity", "").lower()])
    processed = len([r for r in rows if "fix" in r.get("status", "").lower() or "resol" in r.get("status", "").lower()])

    comp_counts = Counter(r['component'] for r in rows if r.get('component'))
    top_components = [{"name": k, "count": v} for k, v in comp_counts.most_common(5)]

    recent_res = supabase.table("firefox_table").select("bug_id, summary, severity").eq("company_id", cid).order(
        "bug_id", desc=True).limit(5).execute()

    return {
        "stats": {"total_db": total, "analyzed": processed, "critical": critical},
        "recent": [{"id": b.get("bug_id"), "summary": b.get("summary"), "severity": b.get("severity")} for b in
                   recent_res.data],
        "charts": {"components": top_components}
    }


@app.get("/api/hub/explorer")
def get_bugs(current_user=Depends(auth.get_current_user)):
    cid = current_user["company_id"]
    response = supabase.table("firefox_table").select("*").eq("company_id", cid).limit(500).order("bug_id",
                                                                                                  desc=True).execute()
    return response.data


@app.get("/api/batches")
def get_training_batches(current_user=Depends(auth.get_current_user)):
    cid = current_user["company_id"]
    response = supabase.table("training_batches").select("*").eq("company_id", cid).order("upload_time",
                                                                                          desc=True).execute()
    return response.data


@app.post("/api/upload_and_train")
async def upload_and_train(batch_name: str = Query(...), file: UploadFile = File(...),
                           current_user=Depends(auth.get_current_user)):
    import pandas as pd
    import io
    content = await file.read()
    df = pd.read_csv(io.StringIO(content.decode('utf-8')))

    batch_data = {"batch_name": batch_name or "Upload", "company_id": current_user["company_id"], "bug_count": len(df),
                  "status": "completed"}
    supabase.table("training_batches").insert(batch_data).execute()

    bugs_to_insert = []
    for _, row in df.head(1000).iterrows():
        bugs_to_insert.append({
            "summary": str(row.get('summary', 'No summary')),
            "component": str(row.get('component', 'General')),
            "severity": str(row.get('severity', 'S3')),
            "company_id": current_user["company_id"],
            "status": "pending"
        })
    if bugs_to_insert: supabase.table("firefox_table").insert(bugs_to_insert).execute()
    return {"message": f"Processed {len(bugs_to_insert)} bugs."}