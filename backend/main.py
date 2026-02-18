from fastapi import FastAPI, HTTPException, Depends, status, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, defer
from sqlalchemy import text
from database import get_db, engine
from pydantic import BaseModel
import models, auth, time, os, json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from auth import get_current_user
from database import get_db, engine
from models import Base, User, Bug, Company, TrainingBatch, Feedback
from fastapi import Query
from database import supabase


# --- AI & CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "rf_model.pkl")
VECTOR_PATH = os.path.join(BASE_DIR, "tfidf_vectorizer.pkl")
DB_PATH = os.path.join(BASE_DIR, "rag_db")

rf_model, tfidf_vectorizer, rag_collection, rag_model, rag_client = None, None, None, None, None

def get_ai_models():
    global rf_model, tfidf_vectorizer, rag_collection, rag_model, rag_client
    if rf_model is not None: return
    import joblib, chromadb
    from sentence_transformers import SentenceTransformer
    try:
        if os.path.exists(MODEL_PATH):
            rf_model = joblib.load(MODEL_PATH)
            tfidf_vectorizer = joblib.load(VECTOR_PATH)
        rag_model = SentenceTransformer('all-MiniLM-L6-v2')
        if os.path.exists(DB_PATH):
            rag_client = chromadb.PersistentClient(path=DB_PATH)
            rag_collection = rag_client.get_collection(name="bug_reports")
    except Exception as e:
        print(f"AI Load Error: {e}")

#models.Base.metadata.create_all(bind=engine)
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- DATA MODELS ---
class BugPayload(BaseModel):
    summary: str
    component: str
    severity: str
    status: str
    platform: str = "Windows"

class CreateBugRequest(BaseModel):
    bug: BugPayload
    company_id: int

class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "admin"
    company_name: str


@app.post("/api/analyze_bug")
@app.post("/api/predict")
async def analyze_bug(
    bug_text: str = Query(...), # Explicitly define as a query parameter
    current_user = Depends(auth.get_current_user)
):
    # Ensure models are loaded
    # get_ai_models() 
    
    # Your Logic
    sev, conf = "S3", 80 
    if any(k in bug_text.lower() for k in ["crash", "leak"]): 
        sev, conf = "S1", 95
    
    return {
        "severity": {
            "label": sev, 
            "confidence": conf, 
            "action": "Investigate"
        }, 
        "similar_bugs": []
    }
# --- AUTH ENDPOINTS ---
@app.post("/api/login")
def login(creds: auth.LoginRequest):
    # Notice I removed the 'db: Session' dependency since we aren't using SQLAlchemy anymore
    
    response = supabase.table("users").select("*").eq("username", creds.username).execute()
    
    # Supabase returns a list. If empty, user is None.
    user = response.data[0] if response.data else None
    
    # Use brackets [] because 'user' is now a Dictionary
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
def create_user(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == req.username).first():
        raise HTTPException(400, "Username taken")
    cid = int(time.time())
    db.execute(text("INSERT INTO companies (id, name) VALUES (:c, :n)"), {"c": cid, "n": req.company_name})
    h = auth.get_password_hash(req.password)
    db.execute(text("INSERT INTO users (username, password_hash, role, company_id) VALUES (:u, :p, :r, :c)"),
               {"u": req.username, "p": h, "r": req.role, "c": cid})
    db.commit()
    return {"message": "Created", "company_id": cid}

# --- BUG OPERATIONS ---
@app.post("/api/bug")
async def create_bug(bug_data: dict, current_user = Depends(auth.get_current_user)):
    # 1. Prepare the data for Supabase (using brackets for current_user)
    bug_to_insert = {
        "summary": bug_data.get("bug_text") or bug_data.get("summary"),
        "component": bug_data.get("component"),
        "severity": bug_data.get("severity"),
        "status": "pending",
        "company_id": current_user["company_id"], # Bracket fix
        "data": bug_data.get("extra_info", {})
    }

    # 2. Save via HTTPS (Firewall-proof)
    # This replaces db.add() and db.commit()
    response = supabase.table("bugs").insert(bug_to_insert).execute()
    
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to save to Supabase")
        
    return response.data[0]

@app.get("/api/hub/overview")
def get_overview(current_user = Depends(auth.get_current_user)):
    cid = current_user["company_id"]
    
    # 1. Fetch all bugs for this company via Supabase
    response = supabase.table("bugs").select("*").eq("company_id", cid).execute()
    bugs = response.data # This is a list of dictionaries
    
    # 2. Calculate Stats manually since we have the data
    total = len(bugs)
    critical = len([b for b in bugs if b.get("severity") == "critical" or b.get("severity") == "high"])
    processed = len([b for b in bugs if b.get("status") == "resolved"])
    
    # 3. Get recent bugs (last 5)
    recent_data = bugs[-5:] if total > 0 else []

    return {
        "stats": {
            "total_db": total, 
            "analyzed": processed, 
            "critical": critical
        },
        "recent": [
            {
                "id": b["bug_id"], 
                "summary": b["summary"], 
                "severity": b["severity"]
            } for b in recent_data
        ],
        "charts": {"components": []} 
    }

@app.get("/api/hub/explorer")
def get_bugs(current_user = Depends(auth.get_current_user)):
    # 1. Get company_id using BRACKETS (since current_user is a dict)
    cid = current_user["company_id"]
    
    # 2. FIREWALL-PROOF: Use Supabase client instead of .query().all()
    response = supabase.table("bugs").select("*").eq("company_id", cid).execute()
    
    # 3. Return the data directly
    return response.data

@app.get("/api/batches")
def get_training_batches(current_user = Depends(auth.get_current_user)):
    # 1. Use the dictionary bracket for the company_id
    cid = current_user["company_id"]
    
    # 2. Query the new table via Supabase API (Port 443)
    response = supabase.table("training_batches") \
        .select("*") \
        .eq("company_id", cid) \
        .order("upload_time", desc=True) \
        .execute()
    
    return response.data

@app.post("/api/upload_and_train")
async def upload_and_train(
    batch_name: str, 
    file: UploadFile = File(...), 
    current_user = Depends(auth.get_current_user)
):
    # 1. Read and parse your file (CSV/JSON logic here)
    import pandas as pd
    import io
    content = await file.read()
    df = pd.read_csv(io.StringIO(content.decode('utf-8')))
    
    # 2. Create the Batch Entry in Supabase
    batch_data = {
        "batch_name": batch_name,
        "company_id": current_user["company_id"],
        "bug_count": len(df),
        "status": "completed"
    }
    batch_res = supabase.table("training_batches").insert(batch_data).execute()
    
    # 3. Prepare the Bulk Bug List
    bugs_to_insert = []
    for _, row in df.iterrows():
        bugs_to_insert.append({
            "summary": row.get('summary', 'No summary'),
            "component": row.get('component', 'General'),
            "severity": row.get('severity', 'medium'),
            "company_id": current_user["company_id"],
            "status": "pending"
        })

    # 4. FIREWALL-PROOF: Bulk Insert into Supabase (Max 1000 rows at once)
    supabase.table("bugs").insert(bugs_to_insert).execute()

    return {"message": f"Successfully processed {len(df)} bugs in batch '{batch_name}'"}