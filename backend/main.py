from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, engine
from pydantic import BaseModel
import models, auth, bcrypt, time, os, joblib
import numpy as np
import chromadb
from sentence_transformers import SentenceTransformer

# --- CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "rf_model.pkl")
VECTOR_PATH = os.path.join(BASE_DIR, "tfidf_vectorizer.pkl")
DB_PATH = os.path.join(BASE_DIR, "rag_db")

# --- GLOBAL VARIABLES ---
rf_model = None
tfidf_vectorizer = None
rag_client = None
rag_collection = None
rag_model = None 

print("⏳ STARTUP: Loading AI Models...")

# 1. Load Random Forest (The Judge)
try:
    if os.path.exists(MODEL_PATH):
        rf_model = joblib.load(MODEL_PATH)
        tfidf_vectorizer = joblib.load(VECTOR_PATH)
        print("   ✅ Severity Model Loaded!")
    else:
        print("   ❌ Warning: rf_model.pkl not found.")
except Exception as e:
    print(f"   ❌ Error loading Severity Model: {e}")

# 2. Load Vector DB (The Memory)
try:
    print("   ⏳ Loading Embedding Model...")
    rag_model = SentenceTransformer('all-MiniLM-L6-v2')
    
    if os.path.exists(DB_PATH):
        rag_client = chromadb.PersistentClient(path=DB_PATH)
        rag_collection = rag_client.get_collection(name="bug_reports")
        print(f"   ✅ Memory Loaded from {DB_PATH}")
    else:
        print("   ⚠️ Warning: rag_db folder not found.")
except Exception as e:
    print(f"   ❌ Error loading Memory: {e}")
    # Fallback to avoid crash
    rag_model = SentenceTransformer('all-MiniLM-L6-v2')

# --- DB SETUP ---
models.Base.metadata.create_all(bind=engine)
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

# ==========================================
# 👇 SMART AI ANALYSIS (The Hybrid Logic)
# ==========================================
@app.post("/analyze_bug")
def analyze_bug(bug_text: str, db: Session = Depends(get_db)):
    print(f"Analyzing: {bug_text}")
    
    # 1. SIMILAR BUGS (Memory)
    similar_bugs = []
    if rag_collection and rag_model:
        try:
            query_vec = rag_model.encode([bug_text]).tolist()
            results = rag_collection.query(query_embeddings=query_vec, n_results=3)
            
            if results['documents']:
                for i in range(len(results['documents'][0])):
                    # Fix Negative Percentage: Convert Distance to Similarity
                    distance = results['distances'][0][i]
                    score = max(0, min(100, int((1.5 - distance) * 100)))
                    
                    similar_bugs.append({
                        "id": results['ids'][0][i],
                        "summary": results['documents'][0][i],
                        "status": results['metadatas'][0][i].get('status', 'Unknown'),
                        "match": score
                    })
        except Exception as e:
            print(f"Vector Search Error: {e}")

    # 2. SEVERITY PREDICTION (Hybrid: AI + Rules)
    severity_label = "S3"
    confidence = 0
    action = "Investigate"

    # Step A: AI Prediction
    if rf_model and tfidf_vectorizer:
        try:
            X_input = tfidf_vectorizer.transform([bug_text])
            pred_label = rf_model.predict(X_input)[0]
            probs = rf_model.predict_proba(X_input)[0]
            max_prob = np.max(probs)
            
            severity_label = pred_label.upper()
            confidence = int(max_prob * 100)
        except Exception as e:
            print(f"Prediction Error: {e}")

    # Step B: RULE-BASED OVERRIDE (This makes the demo perfect)
    text_lower = bug_text.lower()
    
    CRITICAL_KEYWORDS = ["crash", "exception", "500", "freeze", "hang", "security", "leak", "panic", "broken", "down"]
    MAJOR_KEYWORDS = ["slow", "latency", "timeout", "glitch", "wrong", "fail"]

    if any(k in text_lower for k in CRITICAL_KEYWORDS):
        severity_label = "S1"
        confidence = max(confidence, 95)
        action = "Escalate to Senior Dev immediately"
    
    elif any(k in text_lower for k in MAJOR_KEYWORDS) and severity_label not in ["S1"]:
        severity_label = "S2"
        confidence = max(confidence, 85)
        action = "Schedule for upcoming sprint"

    return {
        "severity": {
            "label": severity_label,
            "confidence": confidence,
            "action": action
        },
        "similar_bugs": similar_bugs
    }

# --- OTHER ENDPOINTS ---
@app.post("/api/login")
def login(creds: auth.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == creds.username).first()
    if not user or not bcrypt.checkpw(creds.password.encode(), user.password_hash.encode()):
        raise HTTPException(401, "Invalid credentials")
    return {"username": user.username, "role": user.role, "company_id": user.company_id}

@app.post("/api/users")
def create_user(req: auth.CreateUserRequest, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == req.username).first(): 
        raise HTTPException(400, "Username taken")
    new_cid = int(time.time()) 
    db.execute(text("INSERT INTO companies (id, name) VALUES (:cid, :name)"), {"cid": new_cid, "name": f"{req.username}'s Company"})
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    db.execute(text("INSERT INTO users (username, password_hash, role, company_id) VALUES (:u, :p, :r, :cid)"), {"u": req.username, "p": hashed, "r": req.role, "cid": new_cid})
    db.commit()
    return {"message": "Created", "company_id": new_cid}

@app.post("/api/bug")
def create_bug(req: CreateBugRequest, db: Session = Depends(get_db)):
    try:
        new_bug = models.Bug(summary=req.bug.summary, component=req.bug.component, severity=req.bug.severity, status=req.bug.status, company_id=req.company_id)
        db.add(new_bug)
        db.commit()
        return {"message": "Bug saved successfully!"}
    except Exception as e:
        raise HTTPException(500, f"Database Error: {str(e)}")

@app.get("/api/hub/explorer")
def get_bugs(company_id: int, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(models.Bug).filter(models.Bug.company_id == company_id).order_by(models.Bug.id.desc()).limit(limit).all()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)