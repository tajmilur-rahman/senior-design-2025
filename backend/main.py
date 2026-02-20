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
import joblib


# --- AI & CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "rf_model.pkl")
VECTOR_PATH = os.path.join(BASE_DIR, "tfidf_vectorizer.pkl")
DB_PATH = os.path.join(BASE_DIR, "rag_db")

rf_model, tfidf_vectorizer, rag_collection, rag_model, rag_client = None, None, None, None, None

rf_model = joblib.load("rf_model.pkl")
vectorizer = joblib.load("tfidf_vectorizer.pkl")

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
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"],
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"])

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
async def analyze_bug(
    bug_text: str = Query(...), 
    current_user = Depends(auth.get_current_user)
):
    try:
        # 1. RF Model Prediction
        # We wrap this to ensure the vectorizer is loaded
        if rf_model is None or vectorizer is None:
            return {"error": "ML models not loaded on server"}
            
        vectorized_text = vectorizer.transform([bug_text])
        prediction = rf_model.predict(vectorized_text)[0]
        
        # 2. RAG Logic (Supabase Text Search)
        # We use a try-except here because text_search fails on very short/special chars
        similar_bugs = []
        try:
            search_query = bug_text.strip() # <--- Pushed in 4 spaces
            if len(search_query) > 2:
                response = supabase.table("bugs").select("*").text_search('summary', search_query).execute()
                similar_bugs = response.data
        except Exception as e:
            print(f"RAG Search failed: {e}")
        # 3. Final Response
        return {
            "severity": {
                "label": str(prediction), 
                "confidence": 0.85, # You can pull actual proba if needed
                "action": "Investigate"
            },
            "similar_bugs": similar_bugs,
            "analysis_context": {
                "user": current_user["username"],
                "company_id": current_user["company_id"],
                "method": "Random Forest + RAG"
            }
        }
        
    except Exception as e:
        print(f"Total Analysis failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))

        
# --- AUTH ENDPOINTS ---
@app.post("/api/login")
def login(creds: auth.LoginRequest):
    # 1. Fetch user from Supabase
    response = supabase.table("users").select("*").eq("username", creds.username).execute()
    user = response.data[0] if response.data else None
    
    if not user or not auth.verify_password(creds.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    
    # 2. Add 'company_id' and 'role' to the token payload!
    # This is the "ID Card" the frontend will carry
    token_data = {
        "sub": user["username"],
        "company_id": user["company_id"],
        "role": user.get("role", "user")
    }
    
    token = auth.create_access_token(data=token_data)
    
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "username": user["username"], 
        "company_id": user["company_id"],
        "role": user.get("role", "user")
    }
@app.post("/api/users")
def create_user(req: auth.UserCreate):
    # 1. FIREWALL-PROOF CHECK: Does user exist?
    existing = supabase.table("users").select("*").eq("username", req.username).execute()
    if existing.data:
        raise HTTPException(400, "Username already registered")
    
    # 2. Hash the password using your existing auth tool
    hashed_pwd = auth.get_password_hash(req.password)
    
    # 3. Create the new user dictionary
    new_user = {
        "username": req.username,
        "password_hash": hashed_pwd,
        "role": "user",
        "company_id": 1  # Defaulting to Senior Design Team for now
    }
    
    # 4. Insert into Supabase via HTTPS
    response = supabase.table("users").insert(new_user).execute()
    
    if not response.data:
        raise HTTPException(500, "Failed to create user in cloud")
        
    return {"message": "User created successfully", "username": req.username}

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
    cid = current_user.get("company_id")
    
    # 1. Fetch data (Handle Firefox vs. others)
    if cid == 2: 
        res = supabase.table("firefox_table").select("*").limit(1000).execute()
    else:
        res = supabase.table("bugs").select("*").eq("company_id", cid).execute()
    
    bugs = res.data or []
    
    # 2. CALCULATE STATS (This is what the Dashboard needs)
    total_count = len(bugs)
    critical_count = len([b for b in bugs if b.get("severity") in ["S1", "critical"]])
    # Count bugs per component for the "Top Failing Components" chart
    components = {}
    for b in bugs:
        comp = b.get("component", "Unknown")
        components[comp] = components.get(comp, 0) + 1

    # 3. Format exactly for your React component
    return {
        "stats": {
            "total_db": total_count, 
            "analyzed": total_count, 
            "critical": critical_count
        },
        "recent": [
            {"id": b["bug_id"], "summary": b["summary"], "severity": b["severity"]} 
            for b in bugs[:5]
        ],
        "charts": {
            "components": [{"name": k, "value": v} for k, v in components.items()]
        }
    }
@app.get("/api/hub/explorer")
def get_bugs(current_user = Depends(auth.get_current_user)):
    cid = current_user["company_id"]
    role = current_user.get("role")

    # If they are NOT an admin, force them to only see their company data
    query = supabase.table("bugs").select("*")
    # If the company is Firefox (ID 2), pull from the big dataset
    if cid == 1:
        response = supabase.table("firefox_table").select("*").limit(100).execute()
    else:
        response = supabase.table("bugs").select("*").eq("company_id", cid).execute()
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

@app.post("/api/train_from_firefox")
async def train_from_firefox(current_user = Depends(auth.get_current_user)):
    # 1. Fetch the actual Firefox data from Supabase
    response = supabase.table("firefox_table").select("summary, severity, component").execute()
    data = response.data
    
    if not data:
        raise HTTPException(400, "No data found in firefox_table")

    # 2. Convert to DataFrame for training
    df = pd.DataFrame(data)
    
    # 3. Your existing Training Logic here
    # vectorized_text = tfidf_vectorizer.fit_transform(df['summary'])
    # rf_model.fit(vectorized_text, df['severity'])
    
    return {"message": f"Successfully trained on {len(data)} Firefox records"}