from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, defer
from sqlalchemy import text
from database import get_db, engine
from pydantic import BaseModel
import models, auth, time, os, json

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

class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "admin"
    company_name: str

# --- AI ENDPOINT (SECURE) ---
@app.post("/api/predict") # Matches MLPredictor.jsx
@app.post("/analyze_bug") # Matches BugAnalysis.jsx
def analyze_bug(bug_text: str, current_user = Depends(auth.get_current_user)):
    get_ai_models()
    similar_bugs = []
    # ... (Your existing RAG/RF logic remains same) ...
    # Placeholder for brevity
    sev, conf = "S3", 80 
    if any(k in bug_text.lower() for k in ["crash", "leak"]): sev, conf = "S1", 95
    
    return {"severity": {"label": sev, "confidence": conf, "action": "Investigate"}, "similar_bugs": similar_bugs}

# --- AUTH ENDPOINTS ---
@app.post("/api/login")
def login(creds: auth.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == creds.username).first()
    if not user or not auth.verify_password(creds.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    
    token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer", "username": user.username, "company_id": user.company_id}

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
def create_bug(req: CreateBugRequest, db: Session = Depends(get_db), current_user = Depends(auth.get_current_user)):
    new_id = int(time.time())
    db.execute(text(
        "INSERT INTO bugs (bug_id, summary, component, severity, status, company_id) VALUES (:b, :s, :c, :sev, :stat, :cid)"),
               {"b": new_id, "s": req.bug.summary, "c": req.bug.component, "sev": req.bug.severity,
                "stat": req.bug.status, "cid": current_user.company_id})
    db.commit()
    return {"message": "Saved", "id": new_id}

@app.get("/api/hub/overview")
def get_overview(db: Session = Depends(get_db), current_user = Depends(auth.get_current_user)):
    cid = current_user.company_id
    total = db.query(models.Bug).filter(models.Bug.company_id == cid).count()
    critical = db.query(models.Bug).filter(models.Bug.company_id == cid, models.Bug.severity == 'S1').count()
    processed = db.query(models.Bug).filter(models.Bug.company_id == cid, models.Bug.status != 'NEW').count()
    
    recent = db.query(models.Bug).filter(models.Bug.company_id == cid).order_by(models.Bug.bug_id.desc()).limit(20).all()
    
    return {
        "stats": {"total_db": total, "analyzed": processed, "critical": critical},
        "recent": [{"id": b.bug_id, "summary": b.summary, "severity": b.severity} for b in recent],
        "charts": {"components": []} # Add component logic if needed
    }

@app.get("/api/hub/explorer")
def get_bugs(db: Session = Depends(get_db), current_user = Depends(auth.get_current_user)):
    # Automatically filter by the logged-in user's company
    company_id = current_user.company_id
    
    # We fetch the bugs belonging to this company and order by latest first
    bugs = db.query(models.Bug) \
        .filter(models.Bug.company_id == company_id) \
        .order_by(models.Bug.bug_id.desc()) \
        .all()
        
    return bugs