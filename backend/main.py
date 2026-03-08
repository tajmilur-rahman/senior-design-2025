from fastapi import FastAPI, HTTPException, Depends, status, Form, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, joblib, pandas as pd, io, time
import auth
from database import supabase
from sqlalchemy import text
from fastapi.responses import StreamingResponse

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
    # Replaces all hardcoded 'cid == 2' checks throughout the app.
    # Requires: ALTER TABLE companies ADD COLUMN data_table text DEFAULT 'bugs';
    #           UPDATE companies SET data_table = 'firefox_table' WHERE id = 2;
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
    # company_id removed — always comes from JWT, never trusted from frontend

class CreateBugRequest(BaseModel):
    bug: BugPayload
    # company_id removed — JWT is the source of truth

class CompanyCreate(BaseModel):
    name: str  # matches the 'name' column in companies table

class RegisterRequest(BaseModel):
    # One-shot registration: creates company + first admin user together
    company_name: str
    username: str
    password: str

# --- ANALYSIS (The Brain) ---
@app.post("/api/analyze_bug")
async def analyze_bug(bug_text: str = Query(...), current_user = Depends(auth.get_current_user)):
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
        search_table = get_company_table(cid)  # replaces hardcoded 'cid == 2' check

        try:
            search_query = bug_text.strip()
            if len(search_query) > 2:
                response = supabase.table(search_table)\
                    .select("*")\
                    .ilike('summary', f'%{search_query[:20]}%')\
                    .limit(5)\
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

    token = auth.create_access_token(data={"sub": user["username"], "company_id": user["company_id"], "role": user.get("role", "user")})
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user["username"],
        "company_id": user["company_id"],
        "onboarding_completed": user.get("onboarding_completed", False)  # frontend uses this to decide whether to show onboarding
    }

@app.post("/api/users")
def create_user(req: auth.UserCreate):
    # Adds a new user to an EXISTING company (used by admin to invite teammates)
    hashed_pwd = auth.get_password_hash(req.password)
    new_user = {
        "username": req.username,
        "password_hash": hashed_pwd,
        "role": "user",
        "company_id": req.company_id  # from request, not hardcoded
    }
    supabase.table("users").insert(new_user).execute()
    return {"message": "User created successfully"}

@app.post("/api/users/complete_onboarding")
def complete_onboarding(current_user = Depends(auth.get_current_user)):
    # Called when a user finishes or skips the onboarding flow.
    # Flips the flag to true so they never see it again on future logins.
    supabase.table("users").update({"onboarding_completed": True})\
        .eq("username", current_user.get("username")).execute()
    return {"message": "Onboarding complete"}

# --- COMPANY & REGISTRATION ---
@app.post("/api/companies")
def create_company(req: CompanyCreate):
    # Step 1: Check if a company with this name already exists
    existing = supabase.table("companies").select("id").eq("name", req.name).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Company name already exists")

    # Step 2: Insert into companies table — only 'name' needed, 'id' is auto-generated
    res = supabase.table("companies").insert({"name": req.name}).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create company")

    company = res.data[0]
    return {"message": "Company created", "company_id": company["id"], "company_name": company["name"]}

@app.post("/api/register")
def register(req: RegisterRequest):
    # One-shot onboarding: creates the company AND the first admin user
    # in a single request so the frontend doesn't need two round trips.

    # Step 1: Check username is not already taken
    existing_user = supabase.table("users").select("id").eq("username", req.username).execute()
    if existing_user.data:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Step 2: Check company name is not already taken
    existing_company = supabase.table("companies").select("id").eq("name", req.company_name).execute()
    if existing_company.data:
        raise HTTPException(status_code=400, detail="Company name already exists")

    # Step 3: Create the company first to get the auto-generated company_id
    company_res = supabase.table("companies").insert({"name": req.company_name}).execute()
    if not company_res.data:
        raise HTTPException(status_code=500, detail="Failed to create company")
    company_id = company_res.data[0]["id"]

    # Step 4: Create the first user, assigned as admin of the new company
    hashed_pwd = auth.get_password_hash(req.password)
    user_res = supabase.table("users").insert({
        "username": req.username,
        "password_hash": hashed_pwd,
        "role": "admin",          # First user of a company is always admin
        "company_id": company_id  # Tied to the newly created company
    }).execute()

    if not user_res.data:
        # Rollback: delete the company if user creation failed
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
def get_overview(current_user = Depends(auth.get_current_user)):
    cid = current_user.get("company_id")
    table = get_company_table(cid)  # replaces hardcoded 'cid == 2' check

    if table == "firefox_table":
        count_res = supabase.table("firefox_table").select("*", count="exact").limit(1).execute()
        total_count = count_res.count or 0
        res = supabase.table("firefox_table").select("*").limit(1000).execute()
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
        "recent": [{"id": b.get("bug_id") or b.get("id"), "summary": b.get("summary"), "severity": b.get("severity"), "status": b.get("status")} for b in bugs[:5]],
        "charts": {"components": top_5}
    }

# --- DIRECTORY & EXPLORER ---
@app.get("/api/hub/component_counts")
def get_component_counts(current_user=Depends(auth.get_current_user)):
    cid = current_user.get("company_id")
    table = get_company_table(cid)  # replaces hardcoded firefox_table
    res = supabase.table(table).select("component").limit(2000).execute()
    counts = {}
    for r in (res.data or []):
        comp = str(r.get("component")).strip().lower() if r.get("component") else "general"
        counts[comp] = counts.get(comp, 0) + 1
    return counts

@app.get("/api/hub/explorer")
def get_bugs(page: int = 1, limit: int = 10, search: str = "", sort_key: str = "id", sort_dir: str = "desc",
             sev: str = "", status: str = "", comp: str = "", current_user=Depends(auth.get_current_user)):

    cid = current_user.get("company_id")
    # Determine the table dynamically from the companies record — no hardcoding
    table = get_company_table(cid)

    # Both tables use bug_id as the primary key.
    # If the frontend asks for "id", we map it to "bug_id" for the database query.
    db_sort = "bug_id" if sort_key == "id" else sort_key

    offset = (page - 1) * limit
    query = supabase.table(table).select("*", count="exact")
    if table == "bugs":
        query = query.eq("company_id", cid)  # tenant isolation

    # Filtering logic
    if search: query = query.ilike("summary", f"%{search}%")
    if sev:    query = query.ilike("severity", f"%{sev}%")
    if status: query = query.ilike("status", f"%{status}%")
    if comp:   query = query.ilike("component", f"%{comp}%")

    # Execute query
    res = query.order(db_sort, desc=(sort_dir.lower() == "desc")).range(offset, offset + limit - 1).execute()

    # Map the response back to a unified "id" field for the frontend
    return {
        "total": res.count or 0,
        "bugs": [
            {
                "id": r.get("bug_id"),  # unified key
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
    # Use the company_id from the token instead of trusting the frontend
    cid = current_user.get("company_id")

    new_bug = {
        "summary": request.bug.summary,
        "component": request.bug.component,
        "severity": request.bug.severity,
        "status": request.bug.status,
        "company_id": cid,                 # Secured from the JWT
        "user_id": current_user.get("id")  # Also tag the specific user
    }

    res = supabase.table("bugs").insert(new_bug).execute()
    return res.data

@app.delete("/api/bug/{bug_id}")
async def delete_bug(bug_id: int, current_user = Depends(auth.get_current_user)):
    try:
        cid = current_user.get("company_id")
        # Ownership check: only deletes if bug belongs to caller's company
        supabase.table("bugs").delete().eq("bug_id", bug_id).eq("company_id", cid).execute()
        return {"message": "Purged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- BATCH & BULK ---
@app.get("/api/batches")
def get_batches(current_user = Depends(auth.get_current_user)):
    res = supabase.table("training_batches").select("*").eq("company_id", current_user.get("company_id")).order("upload_time", desc=True).execute()
    return res.data

@app.post("/api/upload_and_train")
async def upload_and_train(batch_name: str = Form(...), file: UploadFile = File(...), current_user = Depends(auth.get_current_user)):
    try:
        content = await file.read()
        df = pd.read_csv(io.StringIO(content.decode('utf-8'))) if file.filename.endswith('.csv') else pd.read_json(io.BytesIO(content))
        batch_data = {"batch_name": batch_name, "company_id": current_user.get("company_id"), "bug_count": len(df), "status": "completed"}
        supabase.table("training_batches").insert(batch_data).execute()

        bugs = []
        for _, row in df.iterrows():
            bugs.append({
                "summary": row.get('summary'),
                "component": row.get('component', 'General'),
                "severity": row.get('severity', 'S3'),
                "company_id": current_user.get("company_id"),
                "status": "pending"
            })
        supabase.table("bugs").insert(bugs).execute()
        return {"message": "Batch processed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))