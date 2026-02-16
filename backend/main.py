from fastapi import FastAPI, Depends, HTTPException, Body, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, defer
from sqlalchemy import text
from database import get_db, engine, SessionLocal
from pydantic import BaseModel
import models, auth, bcrypt, time, os, shutil, uuid, datetime
import json
import pandas as pd
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from random_forest_ml.ml_trainer import retrain_model

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
            print("✅ Random Forest & Vectorizer Loaded")
    except Exception as e:
        print(f"⚠️ Failed to load RF Model: {e}")

    try:
        rag_model = SentenceTransformer('all-MiniLM-L6-v2')
        if os.path.exists(DB_PATH):
            rag_client = chromadb.PersistentClient(path=DB_PATH)
            rag_collection = rag_client.get_collection(name="bug_reports")
            print("✅ RAG Memory Loaded")
    except Exception as e:
        print(f"⚠️ Failed to load RAG: {e}")


# --- ADMIN AUTO-CREATE ---
def ensure_admin_exists():
    session = SessionLocal()
    try:
        admin = session.query(models.User).filter_by(username="admin").first()
        if not admin:
            print("👤 Creating default admin...")
            company = session.query(models.Company).filter_by(id=1).first()
            if not company:
                session.add(models.Company(id=1, name="Default Corp"))
                session.commit()

            h = bcrypt.hashpw(b"admin", bcrypt.gensalt()).decode('utf-8')
            session.add(models.User(username="admin", password_hash=h, role="admin", company_id=1))
            session.commit()
            print("✅ Admin created: admin / admin")
    except Exception as e:
        print(f"⚠️ Admin check failed: {e}")
    finally:
        session.close()


models.Base.metadata.create_all(bind=engine)
ensure_admin_exists()
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


class LoginRequest(BaseModel):
    username: str
    password: str


class DeleteUserRequest(BaseModel):
    username: str
    password: str


class DeleteBugRequest(BaseModel):
    company_id: int


class ResetPasswordRequest(BaseModel):
    username: str
    new_password: str


# --- NEW: RETRAIN & UPLOAD ENDPOINT ---
@app.post("/api/upload_and_train")
def upload_and_train(
        file: UploadFile = File(...),
        company_id: int = 1,
        db: Session = Depends(get_db)
):
    # 1. Generate Batch ID
    batch_id = str(uuid.uuid4())[:8]

    # 2. Save file temporarily
    temp_path = f"temp_{batch_id}.csv"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # 3. Parse CSV/JSON
        if file.filename.endswith('.json'):
            new_df = pd.read_json(temp_path)
        else:
            new_df = pd.read_csv(temp_path)

        # Normalize Columns
        new_df.columns = [c.lower().strip() for c in new_df.columns]
        rename_map = {'description': 'summary', 'short_desc': 'summary', 'priority': 'severity'}
        new_df.rename(columns=rename_map, inplace=True)

        if 'summary' not in new_df.columns:
            raise HTTPException(400, "File must contain 'summary' column")

        # 4. Append to Database
        added_count = 0
        for _, row in new_df.iterrows():
            sev = row.get('severity', 'S3')
            if '1' in str(sev):
                sev = 'S1'
            elif '2' in str(sev):
                sev = 'S2'
            elif '4' in str(sev):
                sev = 'S4'
            else:
                sev = 'S3'

            bug_id = int(time.time() * 1000) + added_count

            db_bug = models.Bug(
                bug_id=bug_id,
                summary=row['summary'],
                severity=sev,
                component=row.get('component', 'General'),
                status="NEW",
                company_id=company_id,
                batch_id=batch_id,
                data={}
            )
            db.add(db_bug)
            added_count += 1

        db.commit()  # Commit bugs first

        # 5. RETRAIN MODEL
        train_df = new_df[['summary', 'severity']].copy() if 'severity' in new_df.columns else new_df[
            ['summary']].assign(severity='S3')
        train_result = retrain_model(new_data_df=train_df)

        # [NEW] Extract Accuracy
        final_accuracy = train_result.get("metrics", {}).get("accuracy", 0.0)

        # 6. Save Batch Record WITH Accuracy
        new_batch = models.Batch(
            batch_id=batch_id,
            filename=file.filename,
            upload_time=datetime.datetime.now().strftime("%I:%M %p"),
            record_count=added_count,
            accuracy=final_accuracy,  # <--- Saving accuracy here
            company_id=company_id
        )
        db.add(new_batch)
        db.commit()

        # 7. Reload Models
        global rf_model, tfidf_vectorizer
        rf_model = None

        os.remove(temp_path)

        return {
            "message": "Success",
            "added": added_count,
            "batch_id": batch_id,
            "training": train_result
        }

    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        print(e)
        raise HTTPException(500, str(e))


# --- UNDO BATCH ENDPOINT ---
@app.post("/api/undo_batch")
def undo_batch(payload: dict = Body(...), db: Session = Depends(get_db)):
    batch_id = payload.get("batch_id")
    if not batch_id: raise HTTPException(400, "Missing batch_id")

    # 1. Delete Bugs
    res = db.execute(text("DELETE FROM bugs WHERE batch_id = :b"), {"b": batch_id})
    # 2. Delete Batch Record
    db.execute(text("DELETE FROM batches WHERE batch_id = :b"), {"b": batch_id})

    db.commit()
    deleted_count = res.rowcount
    return {"message": "Undone", "deleted": deleted_count}


# --- GET BATCH HISTORY ---
@app.get("/api/batches")
def get_batches(company_id: int, db: Session = Depends(get_db)):
    return db.query(models.Batch) \
        .filter(models.Batch.company_id == company_id) \
        .order_by(models.Batch.id.desc()) \
        .limit(10) \
        .all()


# --- AI ENDPOINTS ---
@app.post("/analyze_bug")
def analyze_bug(bug_text: str = Body(..., embed=True), db: Session = Depends(get_db)):
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

    sev, conf = "S3", 0
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
def login(creds: LoginRequest, db: Session = Depends(get_db)):
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


@app.put("/api/users")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    hashed = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode()
    db.execute(text("UPDATE users SET password_hash = :p WHERE username = :u"), {"p": hashed, "u": req.username})
    db.commit()
    return {"message": "Password updated"}


@app.delete("/api/users")
def delete_user(req: DeleteUserRequest, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM users WHERE username = :u"), {"u": req.username})
    db.commit()
    return {"message": "Deleted"}


# --- BUG OPERATIONS ---
@app.post("/api/bug")
def create_bug(req: CreateBugRequest, db: Session = Depends(get_db)):
    new_id = int(time.time())
    data_json = {"id": new_id, "summary": req.bug.summary, "component": req.bug.component, "severity": req.bug.severity}
    db.execute(text(
        "INSERT INTO bugs (bug_id, summary, component, severity, status, company_id, data) VALUES (:b, :s, :c, :sev, :stat, :cid, :d)"),
               {"b": new_id, "s": req.bug.summary, "c": req.bug.component, "sev": req.bug.severity,
                "stat": req.bug.status, "cid": req.company_id, "d": json.dumps(data_json)})
    db.commit()
    return {"message": "Saved", "id": new_id}


@app.delete("/api/bug/{bid}")
def delete_bug(bid: int, req: DeleteBugRequest, db: Session = Depends(get_db)):
    res = db.execute(text("DELETE FROM bugs WHERE (bug_id=:b OR id=:b) AND company_id=:c"),
                     {"b": bid, "c": req.company_id})
    db.commit()
    if res.rowcount == 0: raise HTTPException(404, "Not found")
    return {"message": "Deleted"}


@app.get("/api/hub/explorer")
def get_bugs(company_id: int, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(models.Bug).filter(models.Bug.company_id == company_id).options(defer(models.Bug.data)).order_by(
        models.Bug.id.desc()).limit(limit).all()


@app.get("/api/hub/overview")
def get_overview(company_id: int, db: Session = Depends(get_db)):
    total = db.execute(text("SELECT COUNT(*) FROM bugs WHERE company_id=:c"), {"c": company_id}).scalar()
    critical = db.execute(text("SELECT COUNT(*) FROM bugs WHERE severity='S1' AND company_id=:c"),
                          {"c": company_id}).scalar()
    processed = db.execute(text("SELECT COUNT(*) FROM bugs WHERE status != 'NEW' AND company_id=:c"),
                           {"c": company_id}).scalar()
    comps = db.execute(text(
        "SELECT component, COUNT(*) as c FROM bugs WHERE company_id = :c GROUP BY component ORDER BY c DESC LIMIT 5"),
                       {"c": company_id}).fetchall()
    chart_data = [{"name": r[0] or "Unknown", "count": r[1]} for r in comps]
    recent = db.execute(
        text("SELECT bug_id, id, summary, severity FROM bugs WHERE company_id = :c ORDER BY id DESC LIMIT 20"),
        {"c": company_id}).fetchall()
    recent_data = [{"id": r[0] or r[1], "summary": r[2], "severity": r[3]} for r in recent]
    return {"stats": {"total_db": total, "analyzed": processed, "critical": critical},
            "charts": {"components": chart_data}, "recent": recent_data}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)