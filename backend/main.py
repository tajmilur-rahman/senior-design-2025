from fastapi import FastAPI, Depends, HTTPException, Body, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, engine
from pydantic import BaseModel
import models, auth, bcrypt, ml_logic, json, time, random

# --- ✅ AI IMPORTS ---
import chromadb
from sentence_transformers import SentenceTransformer
import joblib
import numpy as np
import os

# --- DATABASE SETUP ---
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

ANALYTICS_SLICE_LIMIT = 5000
DEFAULT_SOURCE_COMPANY_ID = 1

# --- ✅ LOAD ALL AI BRAINS ---
print("⏳ Loading AI Models (Vector DB + Random Forest)...")
AI_READY = False
try:
    # 1. Vector DB (For finding similar bugs)
    rag_client = chromadb.PersistentClient(path="./rag_db")
    rag_collection = rag_client.get_collection(name="bug_reports")
    rag_model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # 2. Random Forest (For predicting severity)
    # We check if files exist to prevent crashing if you deleted them
    if os.path.exists("rf_model.pkl") and os.path.exists("tfidf_vectorizer.pkl"):
        rf_model = joblib.load("rf_model.pkl")
        vectorizer = joblib.load("tfidf_vectorizer.pkl")
        print("✅ Random Forest & Vectorizer Loaded!")
        AI_READY = True
    else:
        print("⚠️ Warning: .pkl files not found. Prediction will use fallback logic.")

except Exception as e:
    print(f"⚠️ AI LOAD WARNING: {e}")

# --- HELPER FUNCTIONS ---
def map_sev(s):
    s = str(s).lower().strip()
    if s in ['blocker', 'critical', 's1']: return 'S1'
    if s in ['major', 's2']: return 'S2'
    if s in ['normal', 's3']: return 'S3'
    return 'S4'

class PredictionRequest(BaseModel):
    summary: str
    component: str = "General"
    platform: str = "All"

# --- ✅ DATA MODELS FOR SAVING ---
class BugPayload(BaseModel):
    summary: str
    component: str
    severity: str
    status: str
    platform: str = "Windows"
    ai_analysis: dict = None  # We accept this but might not save it to SQL yet

class CreateBugRequest(BaseModel):
    bug: BugPayload
    company_id: int

# ==========================================
# 👇 THE REAL AI ENDPOINT
# ==========================================
@app.post("/analyze_bug")
def analyze_bug(bug_text: str, db: Session = Depends(get_db)):
    print(f"Analyzing: {bug_text}")
    
    # 1. SEARCH FOR SIMILAR BUGS (Vector DB)
    similar_bugs = []
    try:
        query_vec = rag_model.encode([bug_text]).tolist()
        results = rag_collection.query(query_embeddings=query_vec, n_results=3)
        if results['documents']:
            for i in range(len(results['documents'][0])):
                similar_bugs.append({
                    "id": results['ids'][0][i],
                    "summary": results['documents'][0][i],
                    "status": results['metadatas'][0][i].get('status', 'Unknown'),
                    "match": round((1 - results['distances'][0][i]) * 100)
                })
    except Exception as e:
        print(f"Vector Search Error: {e}")

    # 2. PREDICT SEVERITY (Random Forest)
    severity_label = "S3"
    confidence = 0
    action = "Investigate"

    if AI_READY:
        try:
            # Transform text into numbers
            X_input = vectorizer.transform([bug_text])
            
            # Predict
            pred_label = rf_model.predict(X_input)[0]
            probs = rf_model.predict_proba(X_input)[0]
            max_prob = np.max(probs) # Get the highest confidence score

            # Map the result to our UI labels
            severity_label = pred_label.upper()
            confidence = int(max_prob * 100)
            
            # Smart Actions based on result
            if severity_label in ['S1', 'CRITICAL', 'BLOCKER']:
                action = "Escalate to Senior Dev immediately"
            elif severity_label in ['S2', 'MAJOR']:
                action = "Schedule for upcoming sprint"
            else:
                action = "Add to backlog for future review"
                
        except Exception as e:
            print(f"Prediction Error: {e}")
            severity_label = "ERROR"

    return {
        "severity": {
            "label": severity_label,
            "confidence": confidence,
            "action": action
        },
        "similar_bugs": similar_bugs
    }

# --- REST OF THE API (Dashboard, Login, etc.) ---
# (Keeping the rest of your endpoints exactly the same)

@app.post("/api/login")
def login(creds: auth.LoginRequest, db: Session = Depends(get_db)):
    # 1. Find the user
    user = db.query(models.User).filter(models.User.username == creds.username).first()
    
    # 2. Check if user exists AND password is correct
    if not user or not bcrypt.checkpw(creds.password.encode(), user.password_hash.encode()):
        raise HTTPException(401, "Invalid credentials")
        
    # 3. Return the token/info
    return {"username": user.username, "role": user.role, "company_id": user.company_id}

@app.post("/api/predict")
def predict(req: PredictionRequest):
    # 1. Run the analysis (re-using your existing AI logic if you want, or simple logic here)
    # For now, let's keep it simple so it works immediately:
    
    severity = "S3" # Default
    conf = 0.5
    
    # Simple Keyword Check (just to make it feel alive before the full AI is ready)
    text = req.summary.lower()
    if "crash" in text or "security" in text or "leak" in text:
        severity = "S1"
        conf = 0.95
    elif "slow" in text or "latency" in text:
        severity = "S2"
        conf = 0.80
        
    # 2. Return EXACTLY what the Frontend expects
    return {
        "prediction": severity,
        "confidence": conf,
        "diagnosis": f"Detected potential issue in {req.component}",
        "team": "Backend Team" if req.component == "Database" else "Frontend Team",
        "keywords": [w for w in ["crash", "slow", "error"] if w in text]
    }
@app.post("/api/users")
def create_user(req: auth.CreateUserRequest, company_name: str = Body("My Company", embed=True), db: Session = Depends(get_db)):
    # 1. Check if user exists
    if db.query(models.User).filter(models.User.username == req.username).first(): 
        raise HTTPException(400, "Username taken")
    
    # 2. Generate ID
    new_cid = int(time.time()) # Or use random.randint if you prefer

    # 3. CREATE THE COMPANY FIRST (Fixes the Foreign Key Error)
    # We create a placeholder company so the ID exists
    db.execute(
        text("INSERT INTO companies (id, name) VALUES (:cid, :name)"),
        # You can customize the company name as needed. For now, it uses the username for uniqueness.
        {"cid": new_cid, "name": f"{req.username}'s Company {new_cid}"}
    )

    # 4. Create the User (Now safe to do)
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    db.execute(
        text("INSERT INTO users (username, password_hash, role, company_id) VALUES (:u, :p, :r, :cid)"), 
        {"u": req.username, "p": hashed, "r": req.role, "cid": new_cid}
    )
    
    # 5. Save everything
    db.commit()
    return {"message": "Created", "company_id": new_cid}


# --- ✅ SAVE NEW BUG ---
@app.post("/api/bug")
def create_bug(req: CreateBugRequest, db: Session = Depends(get_db)):
    try:
        new_bug = models.Bug(
            summary=req.bug.summary,
            component=req.bug.component,
            severity=req.bug.severity,
            status=req.bug.status,
            company_id=req.company_id
        )
        db.add(new_bug)
        db.commit()
        return {"message": "Bug saved successfully!"}
    except Exception as e:
        print(f"❌ Save Error: {e}")
        raise HTTPException(500, f"Database Error: {str(e)}")

# --- ✅ VIEW BUGS (EXPLORER) ---
@app.get("/api/hub/explorer")
def get_bugs(company_id: int, limit: int = 50, db: Session = Depends(get_db)):
    bugs = db.query(models.Bug).filter(models.Bug.company_id == company_id)\
             .order_by(models.Bug.id.desc()).limit(limit).all()
    return bugs
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)