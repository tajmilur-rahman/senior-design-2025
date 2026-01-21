from fastapi import FastAPI, Depends, HTTPException, Body, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, engine
import models, auth, bcrypt, ml_logic, json, time

models.Base.metadata.create_all(bind=engine)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURATION ---
OPTIMAL_ANALYTICS_LIMIT = 1000


def trigger_retrain_task():
    # Simulates ML retraining
    time.sleep(1)


@app.get("/api/hub/overview")
def get_overview(db: Session = Depends(get_db)):
    # 1. TOTAL DB COUNT
    total_db = db.execute(text("SELECT COUNT(*) FROM bugs")).scalar() or 0

    # 2. ANALYZED SUBSET
    analyzed_limit = min(total_db, OPTIMAL_ANALYTICS_LIMIT)

    if analyzed_limit == 0:
        return {"stats": {"total_db": 0, "analyzed": 0, "critical": 0, "components": 0},
                "charts": {"severity": [], "components": []}}

    # FAST CTE QUERY (No company_id filter)
    snapshot_query = f"""
        WITH optimal_slice AS (
            SELECT data FROM bugs 
            ORDER BY id DESC 
            LIMIT {analyzed_limit}
        )
    """

    # Critical Count
    critical = db.execute(text(f"""
        {snapshot_query}
        SELECT COUNT(*) FROM optimal_slice 
        WHERE (data->>'severity') IN ('S1', 'S2', 'blocker', 'critical')
    """)).scalar() or 0

    # Component Count
    components = db.execute(text(f"""
        {snapshot_query}
        SELECT COUNT(DISTINCT data->>'component') FROM optimal_slice
    """)).scalar() or 0

    # Chart: Severity
    sev_rows = db.execute(text(f"""
        {snapshot_query}
        SELECT data->>'severity', COUNT(*) FROM optimal_slice GROUP BY 1
    """)).fetchall()

    def map_sev(s):
        s = str(s).lower()
        if s in ['blocker', 'critical', 's1']: return 'S1'
        if s in ['major', 's2']: return 'S2'
        if s in ['normal', 's3']: return 'S3'
        return 'S4'

    sev_map = {}
    for r in sev_rows:
        label = map_sev(r[0])
        sev_map[label] = sev_map.get(label, 0) + r[1]
    sev_chart = [{"name": k, "count": v} for k, v in sev_map.items()]

    # Chart: Components
    comp_rows = db.execute(text(f"""
        {snapshot_query}
        SELECT data->>'component', COUNT(*) FROM optimal_slice 
        GROUP BY 1 ORDER BY 2 DESC LIMIT 5
    """)).fetchall()

    comp_chart = []
    for r in comp_rows:
        name = r[0]
        if not name or str(name).strip() == "":
            name = "Unknown"
        comp_chart.append({"name": name[:15], "count": r[1]})

    return {
        "stats": {
            "total_db": total_db,
            "analyzed": analyzed_limit,
            "critical": critical,
            "components": components
        },
        "charts": {"severity": sev_chart, "components": comp_chart}
    }


@app.get("/api/hub/explorer")
def get_explorer(limit: int = 100, db: Session = Depends(get_db)):
    query = text("""
                 SELECT bug_id, data ->> 'summary', data ->> 'severity', data ->> 'component', data ->> 'status'
                 FROM bugs
                 ORDER BY id DESC
                 LIMIT :lim
                 """)
    res = db.execute(query, {"lim": limit}).fetchall()
    return [{"id": r[0], "summary": r[1], "severity": r[2], "component": r[3], "status": r[4]} for r in res]


@app.post("/api/predict")
def predict(summary: str = Body(..., embed=True)):
    label, conf = ml_logic.predict_severity(summary)
    s = summary.lower()
    diagnosis = "Standard logic error."
    if "database" in s or "sql" in s:
        diagnosis = "Database latency / Lock contention"
    elif "ui" in s or "css" in s:
        diagnosis = "Frontend rendering engine"
    elif "auth" in s:
        diagnosis = "Identity Access Management (IAM)"
    return {"prediction": label, "confidence": conf, "diagnosis": diagnosis}


@app.get("/api/hub/search_hints")
def search_hints(q: str, db: Session = Depends(get_db)):
    if not q or len(q) < 2: return []
    res = db.execute(text("SELECT data->>'summary' FROM bugs WHERE data->>'summary' ILIKE :q LIMIT 5"),
                     {"q": f"%{q}%"}).fetchall()
    return [r[0] for r in res]


@app.post("/api/bug")
def submit_single_bug(bug: dict = Body(...), background_tasks: BackgroundTasks = None, db: Session = Depends(get_db)):
    # Remove 'company_id' logic
    new_id = int(time.time() * 1000)
    bug['id'] = new_id

    # We strip 'bug' dictionary wrapper if frontend sends { "bug": {...} }
    # but based on your React code, it sends { bug: {...} } so we are good.
    if "bug" in bug: bug = bug["bug"]

    db.execute(text("INSERT INTO bugs (bug_id, data) VALUES (:bid, :data)"),
               {"bid": new_id, "data": json.dumps(bug)})
    db.commit()
    background_tasks.add_task(trigger_retrain_task)
    return {"message": "Saved"}


@app.post("/api/upload")
async def bulk_upload(file: UploadFile = File(...), background_tasks: BackgroundTasks = None,
                      db: Session = Depends(get_db)):
    try:
        content = await file.read()
        bugs = json.loads(content)
        if not isinstance(bugs, list): bugs = [bugs]
        for b in bugs:
            b_id = b.get('id', int(time.time() * 1000) + bugs.index(b))
            db.execute(text(
                "INSERT INTO bugs (bug_id, data) VALUES (:bid, :data) ON CONFLICT (bug_id) DO NOTHING"),
                {"bid": b_id, "data": json.dumps(b)})
        db.commit()
        background_tasks.add_task(trigger_retrain_task)
        return {"message": "Uploaded"}
    except Exception as e:
        print(e)
        raise HTTPException(400, "Failed to process file")


@app.post("/api/login")
def login(creds: auth.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == creds.username).first()
    if not user or not bcrypt.checkpw(creds.password.encode(), user.password_hash.encode()):
        raise HTTPException(401, "Invalid credentials")
    # No longer returning company_id
    return {"username": user.username, "role": user.role}


@app.post("/api/users")
def create_user(req: auth.CreateUserRequest, db: Session = Depends(get_db)):
    # Removed company_name logic
    if db.query(models.User).filter(models.User.username == req.username).first():
        raise HTTPException(400, "Username taken")

    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    db.execute(text("INSERT INTO users (username, password_hash, role) VALUES (:u, :p, :r)"),
               {"u": req.username, "p": hashed, "r": req.role})
    db.commit()
    return {"message": "Created"}


@app.post("/api/reset-password")
def reset_password(req: auth.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user: raise HTTPException(404, "User not found")
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    user.password_hash = hashed
    db.commit()
    return {"message": "Updated"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)