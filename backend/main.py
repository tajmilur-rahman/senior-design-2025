from fastapi import FastAPI, Depends, HTTPException, File, UploadFile
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
async def create_bug(payload: dict, db: Session = Depends(get_db)):
    # Extract only the data, let the DB handle the ID
    new_bug = Bug(
        summary=payload['bug']['summary'],
        component=payload['bug']['component'],
        severity=payload['bug']['severity'],
        status="NEW",
        company_id=payload['company_id']
    )
    db.add(new_bug)
    db.commit()
    return {"status": "success"}
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

@app.get("/api/batches")
def get_training_batches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) # Secure: identifies the company
):
    """
    Returns the 'Model Ledger' history for the logged-in user's company.
    """
    batches = db.query(TrainingBatch).filter(
        TrainingBatch.company_id == current_user.company_id
    ).order_by(TrainingBatch.upload_time.desc()).all()
    
    # Format the data for the frontend
    return [
        {
            "batch_id": b.id,
            "filename": b.filename,
            "record_count": b.record_count,
            "accuracy": b.accuracy,
            "upload_time": b.upload_time.strftime("%b %d, %Y %H:%M")
        } for b in batches
    ]

@app.post("/api/upload_and_train")
async def upload_and_train(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Read the CSV/File
    # 2. Retrain your Random Forest model
    # 3. Calculate Accuracy
    
    new_acc = 0.89 # Placeholder for your model.score()
    
    # 4. SAVE TO THE LEDGER
    new_batch = TrainingBatch(
        company_id=current_user.company_id,
        filename=file.filename,
        record_count=150, # Example count
        accuracy=new_acc * 100
    )
    db.add(new_batch)
    db.commit()

    return {
        "status": "success",
        "added": 150,
        "training": {"metrics": {"accuracy": round(new_acc * 100, 2)}}
    }