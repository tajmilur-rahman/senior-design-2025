from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, defer
from sqlalchemy import text
from database import get_db, engine
from pydantic import BaseModel
import models, auth, bcrypt, time, os
import json

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


# --- LAZY LOADING FUNCTION ---
def get_ai_models():
    global rf_model, tfidf_vectorizer, rag_collection, rag_model, rag_client
    if rf_model is not None: return
    print("⏳ LAZY LOAD: Importing & Initializing AI Models...")
    import joblib, numpy as np, chromadb
    from sentence_transformers import SentenceTransformer
    try:
        if os.path.exists(MODEL_PATH):
            rf_model = joblib.load(MODEL_PATH)
            tfidf_vectorizer = joblib.load(VECTOR_PATH)
    except:
        pass
    try:
        rag_model = SentenceTransformer('all-MiniLM-L6-v2')
        if os.path.exists(DB_PATH):
            rag_client = chromadb.PersistentClient(path=DB_PATH)
            rag_collection = rag_client.get_collection(name="bug_reports")
    except:
        pass


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


class DeleteUserRequest(BaseModel):
    username: str
    password: str


class DeleteBugRequest(BaseModel):
    company_id: int


# [FIX] Added Missing Model for Password Reset
class ResetPasswordRequest(BaseModel):
    username: str
    new_password: str


# --- AI ENDPOINTS ---
@app.post("/analyze_bug")
def analyze_bug(bug_text: str, db: Session = Depends(get_db)):
    get_ai_models()
    import numpy as np

    similar_bugs = []
    if rag_collection and rag_model:
        try:
            vec = rag_model.encode([bug_text]).tolist()
            res = rag_collection.query(query_embeddings=vec, n_results=3)
            if res['documents']:
                for i in range(len(res['documents'][0])):
                    score = max(0, min(100, int((1.5 - res['distances'][0][i]) * 100)))
                    similar_bugs.append({
                        "id": res['ids'][0][i],
                        "summary": res['documents'][0][i],
                        "status": res['metadatas'][0][i].get('status', 'Unknown'),
                        "match": score
                    })
        except:
            pass

    sev, conf, act = "S3", 0, "Investigate"
    if rf_model and tfidf_vectorizer:
        try:
            x = tfidf_vectorizer.transform([bug_text])
            sev = rf_model.predict(x)[0].upper()
            conf = int(np.max(rf_model.predict_proba(x)[0]) * 100)
        except:
            pass

    if any(k in bug_text.lower() for k in ["crash", "security", "leak"]): sev, conf = "S1", 95
    return {"severity": {"label": sev, "confidence": conf, "action": "Check"}, "similar_bugs": similar_bugs}


# --- AUTH ENDPOINTS ---

@app.post("/api/login")
def login(creds: auth.LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(text("SELECT username, password_hash, role, company_id FROM users WHERE username = :u"),
                      {"u": creds.username}).fetchone()
    if not user or not bcrypt.checkpw(creds.password.encode(), user.password_hash.encode()):
        raise HTTPException(401, "Invalid credentials")
    return {"username": user.username, "role": user.role, "company_id": user.company_id}


@app.post("/api/users")
def create_user(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.execute(text("SELECT 1 FROM users WHERE username=:u"), {"u": req.username}).fetchone():
        raise HTTPException(400, "Taken")
    cid = int(time.time())
    db.execute(text("INSERT INTO companies (id, name) VALUES (:c, :n)"), {"c": cid, "n": req.company_name})
    h = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    db.execute(text("INSERT INTO users (username, password_hash, role, company_id) VALUES (:u, :p, :r, :c)"),
               {"u": req.username, "p": h, "r": req.role, "c": cid})
    db.commit()
    return {"message": "Created", "company_id": cid}


# [FIX] Added Reset Password Endpoint
@app.put("/api/users")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    # 1. Verify user exists
    user = db.execute(text("SELECT 1 FROM users WHERE username=:u"), {"u": req.username}).fetchone()
    if not user:
        raise HTTPException(404, "User not found")

    # 2. Hash new password
    hashed = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode()

    # 3. Update DB
    db.execute(text("UPDATE users SET password_hash = :p WHERE username = :u"), {"p": hashed, "u": req.username})
    db.commit()

    return {"message": "Password updated successfully"}


@app.delete("/api/users")
def delete_user(req: DeleteUserRequest, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM users WHERE username = :u"), {"u": req.username})
    db.commit()
    return {"message": "Deleted"}


# --- BUG OPERATIONS ---

@app.post("/api/bug")
def create_bug(req: CreateBugRequest, db: Session = Depends(get_db)):
    try:
        new_id = int(time.time())
        # Populate BOTH JSON and Columns
        data_json = {"id": new_id, "summary": req.bug.summary, "component": req.bug.component,
                     "severity": req.bug.severity}

        db.execute(text(
            "INSERT INTO bugs (bug_id, summary, component, severity, status, company_id, data) VALUES (:b, :s, :c, :sev, :stat, :cid, :d)"),
                   {"b": new_id, "s": req.bug.summary, "c": req.bug.component, "sev": req.bug.severity,
                    "stat": req.bug.status, "cid": req.company_id, "d": json.dumps(data_json)})
        db.commit()
        return {"message": "Saved", "id": new_id}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.delete("/api/bug/{bid}")
def delete_bug(bid: int, req: DeleteBugRequest, db: Session = Depends(get_db)):
    # Robust Delete: Checks both 'bug_id' and 'id'
    res = db.execute(text("DELETE FROM bugs WHERE (bug_id=:b OR id=:b) AND company_id=:c"),
                     {"b": bid, "c": req.company_id})
    db.commit()
    if res.rowcount == 0: raise HTTPException(404, "Not found")
    return {"message": "Deleted"}


@app.get("/api/hub/explorer")
def get_bugs(company_id: int, limit: int = 50, db: Session = Depends(get_db)):
    # Optimized: Uses defer() to skip loading heavy JSON 'data' column
    return db.query(models.Bug) \
        .filter(models.Bug.company_id == company_id) \
        .options(defer(models.Bug.data)) \
        .order_by(models.Bug.id.desc()) \
        .limit(limit) \
        .all()


@app.get("/api/hub/overview")
def get_overview(company_id: int, db: Session = Depends(get_db)):
    # 1. Counts
    total = db.execute(text("SELECT COUNT(*) FROM bugs WHERE company_id=:c"), {"c": company_id}).scalar()
    critical = db.execute(text("SELECT COUNT(*) FROM bugs WHERE severity='S1' AND company_id=:c"),
                          {"c": company_id}).scalar()
    processed = db.execute(text("SELECT COUNT(*) FROM bugs WHERE status != 'NEW' AND company_id=:c"),
                           {"c": company_id}).scalar()

    # 2. Charts (Top 5 Components)
    comps = db.execute(text("""
                            SELECT component, COUNT(*) as c
                            FROM bugs
                            WHERE company_id = :c
                            GROUP BY component
                            ORDER BY c DESC
                            LIMIT 5
                            """), {"c": company_id}).fetchall()
    chart_data = [{"name": r[0] or "Unknown", "count": r[1]} for r in comps]

    # 3. Stream (Recent 20)
    recent = db.execute(text("""
                             SELECT bug_id, id, summary, severity
                             FROM bugs
                             WHERE company_id = :c
                             ORDER BY id DESC
                             LIMIT 20
                             """), {"c": company_id}).fetchall()

    recent_data = [{"id": r[0] or r[1], "summary": r[2], "severity": r[3]} for r in recent]

    return {
        "stats": {"total_db": total, "analyzed": processed, "critical": critical},
        "charts": {"components": chart_data},
        "recent": recent_data
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)