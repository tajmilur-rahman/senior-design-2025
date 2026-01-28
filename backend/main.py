from fastapi import FastAPI, Depends, HTTPException, Body, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, engine
from pydantic import BaseModel
import models, auth, bcrypt, ml_logic, json, time, random

# --- CRITICAL: Creates tables (Companies, Users, Bugs) automatically ---
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURATION ---
ANALYTICS_SLICE_LIMIT = 5000
DEFAULT_SOURCE_COMPANY_ID = 1


def trigger_retrain_task(company_id: int):
    # CURRENTLY: Simulates training (Safety for Demos)
    # To make real: Import RF_model and call RF_model.train_model()
    print(f"Triggering retraining for Company {company_id}...")
    time.sleep(2)
    print("Retraining simulation complete.")


def map_sev(s):
    s = str(s).lower().strip()
    if s in ['blocker', 'critical', 's1']: return 'S1'
    if s in ['major', 's2']: return 'S2'
    if s in ['normal', 's3']: return 'S3'
    return 'S4'


# --- API MODELS ---
class PredictionRequest(BaseModel):
    summary: str
    component: str = "General"
    platform: str = "All"


@app.get("/api/hub/overview")
def get_overview(company_id: int, db: Session = Depends(get_db)):
    total_db = db.execute(text("SELECT COUNT(*) FROM bugs WHERE company_id = :cid"), {"cid": company_id}).scalar() or 0

    if total_db == 0:
        return {"stats": {"total_db": 0, "analyzed": 0, "critical": 0, "components": 0},
                "charts": {"severity": [], "components": []}, "recent": []}

    critical_query = text("""
                          SELECT COUNT(*)
                          FROM bugs
                          WHERE company_id = :cid
                            AND (LOWER(data ->> 'severity') IN ('blocker', 'critical', 's1'))
                          """)
    critical_count = db.execute(critical_query, {"cid": company_id}).scalar() or 0

    snapshot_query = f"""
        SELECT data FROM bugs 
        WHERE company_id = :cid 
        ORDER BY id DESC 
        LIMIT {ANALYTICS_SLICE_LIMIT}
    """
    raw_rows = db.execute(text(snapshot_query), {"cid": company_id}).fetchall()

    comp_map = {}
    sev_map = {}
    recent_feed = []

    for i, r in enumerate(raw_rows):
        if not r[0]: continue
        d = r[0]
        sev = map_sev(d.get('severity', 's4'))
        comp = d.get('component', 'Unknown')
        if not comp or str(comp).strip() == "": comp = "Unknown"

        sev_map[sev] = sev_map.get(sev, 0) + 1
        comp_map[comp] = comp_map.get(comp, 0) + 1

        if i < 10:
            recent_feed.append({
                "id": d.get('id', '???'),
                "summary": d.get('summary', 'No summary'),
                "severity": sev,
                "component": comp
            })

    sev_chart = [{"name": k, "count": v} for k, v in sev_map.items()]
    sorted_comps = sorted(comp_map.items(), key=lambda x: x[1], reverse=True)[:5]
    comp_chart = [{"name": k[:20], "count": v} for k, v in sorted_comps]

    return {
        "stats": {
            "total_db": total_db,
            "analyzed": min(total_db, ANALYTICS_SLICE_LIMIT),
            "critical": critical_count,
            "components": len(comp_map)
        },
        "charts": {"severity": sev_chart, "components": comp_chart},
        "recent": recent_feed
    }


@app.get("/api/hub/explorer")
def get_explorer(company_id: int, limit: int = 5000, db: Session = Depends(get_db)):
    query = text("""
                 SELECT bug_id, data ->> 'summary', data ->> 'severity', data ->> 'component', data ->> 'status'
                 FROM bugs
                 WHERE company_id = :cid
                 ORDER BY id DESC
                 LIMIT :lim
                 """)
    res = db.execute(query, {"cid": company_id, "lim": limit}).fetchall()

    cleaned_data = []
    for r in res:
        cleaned_data.append({
            "id": r[0],
            "summary": r[1],
            "severity": map_sev(r[2]),
            "component": r[3],
            "status": r[4]
        })
    return cleaned_data


# --- NEW: UPDATED PREDICTOR ---
@app.post("/api/predict")
def predict(req: PredictionRequest):
    return ml_logic.predict_severity(req.summary, req.component, req.platform)


# --- NEW: FEEDBACK ENDPOINT ---
@app.post("/api/feedback")
def submit_feedback(
    summary: str = Body(...),
    predicted: str = Body(...),
    actual: str = Body(...),
    company_id: int = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    fb = models.Feedback(summary=summary, predicted_severity=predicted, actual_severity=actual, company_id=company_id)
    db.add(fb)
    db.commit()
    return {"message": "Feedback saved."}


@app.get("/api/hub/search_hints")
def search_hints(q: str, db: Session = Depends(get_db)):
    if not q or len(q) < 2: return []
    res = db.execute(text("SELECT data->>'summary' FROM bugs WHERE data->>'summary' ILIKE :q LIMIT 5"),
                     {"q": f"%{q}%"}).fetchall()
    return [r[0] for r in res]


@app.post("/api/bug")
def submit_single_bug(bug: dict = Body(...), company_id: int = Body(..., embed=True),
                      background_tasks: BackgroundTasks = None, db: Session = Depends(get_db)):
    new_id = int(time.time() * 1000)
    bug['id'] = new_id
    db.execute(text("INSERT INTO bugs (bug_id, data, company_id) VALUES (:bid, :data, :cid)"),
               {"bid": new_id, "data": json.dumps(bug), "cid": company_id})
    db.commit()
    return {"message": "Saved", "id": new_id, "summary": bug.get('summary', 'Bug Report')}


@app.delete("/api/bug/{bug_id}")
def delete_bug(bug_id: int, company_id: int = Body(..., embed=True), db: Session = Depends(get_db)):
    result = db.execute(text("DELETE FROM bugs WHERE bug_id = :bid AND company_id = :cid RETURNING bug_id"),
                        {"bid": bug_id, "cid": company_id})
    deleted = result.fetchone()
    db.commit()
    if not deleted: raise HTTPException(status_code=404, detail="Bug not found")
    return {"message": "Deleted", "id": bug_id}


# --- NEW: BATCH DELETE ---
@app.post("/api/bugs/batch_delete")
def delete_batch_bugs(ids: list[int] = Body(...), company_id: int = Body(..., embed=True),
                      db: Session = Depends(get_db)):
    if not ids: return {"message": "No IDs provided"}

    # Convert list to tuple for SQL IN clause
    id_tuple = tuple(ids)
    if len(ids) == 1:
        id_tuple = f"({ids[0]})"  # Handle single item tuple formatting
    else:
        id_tuple = str(id_tuple)

    query = f"DELETE FROM bugs WHERE company_id = :cid AND bug_id IN {id_tuple}"
    db.execute(text(query), {"cid": company_id})
    db.commit()
    return {"message": f"Deleted {len(ids)} records"}


# --- UPDATED: BULK UPLOAD RETURNS IDs ---
@app.post("/api/upload")
async def bulk_upload(file: UploadFile = File(...), company_id: int = Body(...),
                      background_tasks: BackgroundTasks = None, db: Session = Depends(get_db)):
    try:
        content = await file.read()
        bugs = json.loads(content)
        if not isinstance(bugs, list): bugs = [bugs]

        inserted_ids = []
        for b in bugs:
            b_id = b.get('id', int(time.time() * 1000) + bugs.index(b))  # Generate ID if missing
            b['id'] = b_id

            db.execute(text(
                "INSERT INTO bugs (bug_id, data, company_id) VALUES (:bid, :data, :cid) ON CONFLICT (bug_id) DO NOTHING"),
                {"bid": b_id, "data": json.dumps(b), "cid": company_id})
            inserted_ids.append(b_id)

        db.commit()
        if background_tasks: background_tasks.add_task(trigger_retrain_task, company_id)

        # Return the IDs so the frontend can "Undo" later
        return {"message": "Uploaded", "count": len(inserted_ids), "ids": inserted_ids}
    except Exception as e:
        print(e)
        raise HTTPException(400, "Failed to parse JSON")


# --- AUTH ROUTES ---
@app.post("/api/users")
def create_user(req: auth.CreateUserRequest, company_name: str = Body(..., embed=True), db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == req.username).first():
        raise HTTPException(400, "Username taken")
    new_cid = int(time.time())
    db.execute(text("INSERT INTO companies (id, name) VALUES (:id, :name)"), {"id": new_cid, "name": company_name})
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    db.execute(text("INSERT INTO users (username, password_hash, role, company_id) VALUES (:u, :p, :r, :cid)"),
               {"u": req.username, "p": hashed, "r": req.role, "cid": new_cid})
    try:
        offset = new_cid * 1000
        db.execute(text("""
                        INSERT INTO bugs (bug_id, data, company_id)
                        SELECT bug_id + :offset, data, :new_cid
                        FROM bugs
                        WHERE company_id = :source_cid
                        LIMIT 50
                        ON CONFLICT DO NOTHING
                        """), {"offset": offset, "new_cid": new_cid, "source_cid": DEFAULT_SOURCE_COMPANY_ID})
    except Exception as e:
        print(f"Seed warning: {e}")
    db.commit()
    return {"message": "Created"}


@app.post("/api/login")
def login(creds: auth.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == creds.username).first()
    if not user or not bcrypt.checkpw(creds.password.encode(), user.password_hash.encode()):
        raise HTTPException(401, "Invalid credentials")
    return {"username": user.username, "role": user.role, "company_id": user.company_id}


@app.post("/api/reset-password")
def reset_password(req: auth.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user: raise HTTPException(404, "User not found")
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    user.password_hash = hashed
    db.commit()
    return {"message": "Updated"}


@app.delete("/api/users")
def delete_user(creds: auth.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == creds.username).first()
    if not user: raise HTTPException(404, "User not found")
    if not bcrypt.checkpw(creds.password.encode(), user.password_hash.encode()): raise HTTPException(401,
                                                                                                     "Invalid password")
    db.delete(user)
    db.commit()
    return {"message": "Account deleted successfully"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)