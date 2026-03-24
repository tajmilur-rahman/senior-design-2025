import os, json, joblib, numpy as np, pandas as pd, time as _time_global
import random, re
from config import META, FLAGS, ART_RF, get_artifact_paths, company_model_exists
from scipy.sparse import hstack, csr_matrix        
from sklearn.preprocessing import LabelEncoder   

# --- 1. CORE LOGIC ---
# Cache keyed by company_id (int) or "global"
_model_cache: dict = {}


def load_pack(company_id=None):
    """Load model pack for a company or the global model. Uses in-memory cache."""
    cache_key = company_id if company_id is not None else "global"
    if cache_key in _model_cache:
        return _model_cache[cache_key]

    s = get_artifact_paths(company_id)
    try:
        if not os.path.exists(s['model']):
            print(f"⚠️ Model not found at {s['model']}. Using fallback mode.")
            pack = (None, None, None, {})
        else:
            pack = (
                joblib.load(s["model"]),
                joblib.load(s["vec"]),
                joblib.load(s["enc"]),
                json.load(open(s["met"])) if os.path.exists(s["met"]) else {},
            )
    except Exception as e:
        print(f"Error loading model (company_id={company_id}): {e}")
        pack = (None, None, None, {})

    _model_cache[cache_key] = pack
    return pack


def predict_internal(sum_text, meta_inputs, m, v, e):
    if not all([m, v, e]): return None, None

    # 1. Vectorize text
    xt = v.transform([sum_text]).toarray()

    # 2. Vectorize Metadata (Component, Platform, etc.)
    xm_list = []
    for c in META:
        val = meta_inputs.get(c, "UNKNOWN")
        encoder = e[c] if isinstance(e, dict) and c in e else e

        # Handle unseen labels safely
        if hasattr(encoder, 'classes_'):
            if val in encoder.classes_:
                encoded_val = encoder.transform([val])[0]
            else:
                encoded_val = 0  # Default/Unknown
        else:
            encoded_val = 0
        xm_list.append(encoded_val)

    xm = np.array(xm_list).reshape(1, -1)

    # 3. Process Flags (Auto-derived from text)
    flags_list = []
    text_lower = sum_text.lower()
    for f in FLAGS:
        is_active = 0
        if f == "has_crash" and ("crash" in text_lower or "segfault" in text_lower):
            is_active = 1
        elif f == "is_accessibility" and "accessibility" in text_lower:
            is_active = 1
        elif f == "is_regression" and "regression" in text_lower:
            is_active = 1
        elif f == "is_intermittent" and "intermittent" in text_lower:
            is_active = 1
        elif f == "has_patch" and "patch" in text_lower:
            is_active = 1
        flags_list.append(is_active)

    xf = np.array([flags_list])

    # 4. Combine & Predict
    final_features = np.hstack([xm, xf, xt])
    pro = m.predict_proba(final_features)[0]

    # Decode Label
    sev_enc = e["severity"] if isinstance(e, dict) and "severity" in e else e
    lab = sev_enc.inverse_transform(np.arange(len(pro)))

    return lab[np.argmax(pro)], float(np.max(pro))


# --- 2. INTELLIGENCE MODULES ---

def heuristic_predict(text):
    """Fallback if ML model fails or is missing"""
    text = text.lower()
    if "crash" in text or "security" in text or "data loss" in text:
        return "S1", 0.95
    if "slow" in text or "performance" in text or "broken" in text:
        return "S2", 0.85
    if "typo" in text or "color" in text or "align" in text:
        return "S4", 0.70
    return "S3", 0.60


def predict_team(text, diagnosis):
    """Smart Team Routing (Rule-based for Demo)"""
    t = text.lower()
    d = diagnosis.lower()
    if "security" in t or "auth" in t or "login" in t: return "🛡️ Security Ops"
    if "database" in d or "sql" in t or "query" in t: return "💾 Data Infrastructure"
    if "ui" in t or "css" in t or "align" in t or "color" in t: return "🎨 Frontend/UX"
    if "crash" in t or "memory" in t or "leak" in t: return "⚡ Core Performance"
    return "🔧 General Maintenance"


def extract_keywords(text):
    """Explainable AI - Return specific trigger words"""
    triggers = ["crash", "leak", "security", "fail", "slow", "broken", "error", "exception", "timeout", "freeze",
                "database", "login", "api"]
    found = []
    for word in text.split():
        clean_word = re.sub(r'\W+', '', word).lower()
        if clean_word in triggers:
            found.append(word)
    return list(set(found))


# --- 3. API WRAPPER ---

def predict_severity(summary: str, component: str = "General", platform: str = "All", company_id=None):
    """
    Called by the Website API.
    If company_id is provided and that company has its own model, use it.
    Falls back to the global model if the company model doesn't exist.
    Returns an extra 'model_source' key: 'company' | 'global'.
    """
    used_source = "global"
    fallback = False

    # Try company model first if requested
    if company_id is not None and company_model_exists(company_id):
        m, v, e, _ = load_pack(company_id)
        if m:
            used_source = "company"
        else:
            # Company model files exist but failed to load — fall back
            m, v, e, _ = load_pack(None)
            fallback = True
    else:
        m, v, e, _ = load_pack(None)  # global model
        if company_id is not None:
            fallback = True  # was requested but doesn't exist yet

    label, conf = None, 0.0

    # 1. Run ML Prediction
    if m:
        try:
            # Build metadata dictionary mimicking training data
            user_meta = {
                "component": component,
                "platform": platform,
                "product": "Firefox",  # Context default
                "priority": "--",
                "status": "NEW",
                "op_sys": "Windows",  # Context default
                "type": "defect",
                "resolution": "---"
            }
            label, conf = predict_internal(summary, user_meta, m, v, e)
        except Exception as err:
            print(f"Prediction Error: {err}. Falling back.")

    # 2. Fallback
    if not label:
        label, conf = heuristic_predict(summary)

    # 3. Generate Analysis
    s = summary.lower()
    diagnosis = "Standard Logic Defect"
    if "database" in s or "sql" in s:
        diagnosis = "Database Contention"
    elif "ui" in s or "css" in s:
        diagnosis = "Frontend Rendering"
    elif "auth" in s:
        diagnosis = "Access Control Failure"
    elif "crash" in s:
        diagnosis = "Critical Memory Corruption"

    # 4. Smart Features
    team = predict_team(summary, diagnosis)
    keywords = extract_keywords(summary)

    return {
        "prediction":   label,
        "confidence":   conf,
        "diagnosis":    diagnosis,
        "team":         team,
        "keywords":     keywords,
        "model_source": used_source,
        "fallback":     fallback,
    }

def full_train_from_dataset(records: list, company_id=None, progress_cb=None) -> dict:
    """
    Full training pipeline from scratch using labeled records.
    Used when no base model exists yet, or when training from company bug data
    rather than just feedback corrections.

    records: list of {"summary": str, "severity": str}
    company_id=None  → global model path
    company_id=<int> → company-specific model path

    Unlike fast_retrain (which requires an existing model to warm-start),
    this builds the TF-IDF vocabulary and RF classifier fresh from the data.
    """
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import LabelEncoder
    import time as _time_mod

    def _progress(step, pct):
        if progress_cb:
            try:
                progress_cb(step, pct)
            except Exception:
                pass

    global _model_cache

    if not records:
        return {"success": False, "error": "No training records provided."}

    _progress("Loading and cleaning data", 10)
    df = pd.DataFrame(records)

    severity_map = {
        "blocker": "S1", "critical": "S1", "s1": "S1",
        "major":   "S2", "s2": "S2",
        "normal":  "S3", "minor": "S3", "trivial": "S3", "s3": "S3",
        "enhancement": "S4", "s4": "S4",
    }
    df["severity"] = df["severity"].str.lower().map(severity_map).fillna("S3")
    df["summary"]  = df["summary"].fillna("").astype(str).str.lower().str.strip()
    df = df[df["summary"] != ""].reset_index(drop=True)

    if df.empty:
        return {"success": False, "error": "No valid records after cleaning."}

    _progress("Building TF-IDF vocabulary", 30)
    vectorizer = TfidfVectorizer(
        max_features=10000,
        stop_words="english",
        ngram_range=(1, 2),
        min_df=2,
        sublinear_tf=True,
    )
    X = vectorizer.fit_transform(df["summary"])
    y = df["severity"]

    _progress("Training Random Forest (100 trees)", 55)
    rf = RandomForestClassifier(
        n_estimators=100,
        class_weight="balanced_subsample",
        max_depth=None,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X, y)
    accuracy = round(float(rf.score(X, y)), 4)

    _progress("Saving model artifacts", 88)
    artifact_paths = get_artifact_paths(company_id)
    if company_id is not None:
        company_dir = os.path.dirname(artifact_paths["model"])
        os.makedirs(company_dir, exist_ok=True)

    # Build a minimal encoders dict (severity only) for ml_logic predict compatibility
    le = LabelEncoder()
    le.fit(["S1", "S2", "S3", "S4"])
    encoders = {"severity": le}

    joblib.dump(rf,         artifact_paths["model"])
    joblib.dump(vectorizer, artifact_paths["vec"])
    joblib.dump(encoders,   artifact_paths["enc"])

    metrics_out = {
        "accuracy":     accuracy,
        "f1_score":     accuracy,
        "precision":    accuracy,
        "recall":       accuracy,
        "last_trained": _time_mod.ctime(),
        "sample_size":  len(df),
        "total_trees":  100,
        "mode":         "company" if company_id is not None else "global",
        "company_id":   company_id,
    }
    with open(artifact_paths["met"], "w") as f:
        json.dump(metrics_out, f)

    # Invalidate cache so next prediction uses the fresh model
    cache_key = company_id if company_id is not None else "global"
    _model_cache.pop(cache_key, None)

    # Mark company as having its own model in the DB
    if company_id is not None:
        try:
            from database import supabase as _db
            _db.table("companies").update({"has_own_model": True}).eq("id", company_id).execute()
        except Exception as db_err:
            print(f"[full_train] DB flag update failed: {db_err}")

    return {
        "success":      True,
        "message":      f"Model trained from scratch on {len(df):,} records.",
        "accuracy":     accuracy,
        "total_trees":  100,
        "records_used": len(df),
        "company_id":   company_id,
    }


def safe_transform(encoder, values):
    """Handles unseen labels by mapping them to the first known class."""
    if not hasattr(encoder, 'classes_'):
        return np.zeros(len(values))
    safe_vals = [x if x in encoder.classes_ else encoder.classes_[0] for x in values]
    return encoder.transform(safe_vals)


def fast_retrain(feedback_data: list, company_id=None, progress_cb=None) -> dict:
    """
    Incrementally retrains the Random Forest using user feedback corrections.
    Uses warm_start to add new trees without discarding existing knowledge.

    company_id=None  → retrains the global model
    company_id=<int> → retrains (or initializes) a company-specific model
    progress_cb      → optional callable(step: str, pct: int) for SSE progress reporting

    feedback_data: list of dicts with keys: summary, actual_severity, component
    """
    def _progress(step, pct):
        if progress_cb:
            try:
                progress_cb(step, pct)
            except Exception:
                pass

    global _model_cache
    print(f"Starting fast retrain (company_id={company_id})...")

    # Step 1: Load current model artifacts (always start from global base)
    _progress("Loading base model", 10)
    rf_model, tfidf, encoders, metrics = load_pack(None)  # always base on global

    if not rf_model:
        return {"success": False, "error": "Base model not found. Run full training first."}

    if not feedback_data:
        return {"success": False, "error": "No feedback data provided."}

    try:
        # Step 2: Convert feedback list to DataFrame
        df = pd.DataFrame(feedback_data)

        # Step 3: Standardize severity labels to match training format
        sev_map = {
            "blocker": "S1", "critical": "S1", "s1": "S1",
            "major":   "S2", "s2": "S2",
            "normal":  "S3", "s3": "S3",
            "trivial": "S4", "s4": "S4",
        }
        df["severity"] = df["actual_severity"].str.lower().map(sev_map).fillna("S3")
        df["summary"]  = df["summary"].fillna("").astype(str)

        # Step 4: Fill all required metadata columns with defaults
        # Feedback only has summary + severity + component, so we
        # default everything else to match the training schema
        cat_cols = ["component", "priority", "status", "product",
                    "platform", "op_sys", "type", "resolution"]
        defaults = {
            "component":  df.get("component", pd.Series(["General"] * len(df))),
            "priority":   "--",
            "status":     "NEW",
            "product":    "Firefox",
            "platform":   "All",
            "op_sys":     "Windows",
            "type":       "defect",
            "resolution": "---",
        }
        for c in cat_cols:
            if c not in df.columns:
                df[c] = defaults.get(c, "UNKNOWN")
            df[c] = df[c].fillna("UNKNOWN").astype(str)

        # Boolean flag columns — derive from summary text
        extra_cols = ["has_crash", "is_accessibility", "is_regression",
                      "is_intermittent", "has_patch"]
        for c in extra_cols:
            df[c] = 0  # default all to 0 for feedback data

        # Step 5: Vectorize text using the LOCKED vocabulary
        # We use transform() not fit_transform() to keep vocab consistent
        _progress("Vectorizing text features", 50)
        X_text = tfidf.transform(df["summary"])

        # Step 6: Encode metadata using existing encoders
        _progress("Encoding metadata", 60)
        all_meta = cat_cols + extra_cols
        X_meta_list = []
        for c in all_meta:
            enc = encoders.get(c)
            if enc:
                col_vector = safe_transform(enc, df[c])
                X_meta_list.append(col_vector)
            else:
                X_meta_list.append(np.zeros(len(df)))

        X_meta = np.vstack(X_meta_list).T
        X_meta_sparse = csr_matrix(X_meta)

        # Step 7: Combine features — must match training structure exactly
        X_new = hstack([X_meta_sparse, X_text])
        y_new = safe_transform(encoders["severity"], df["severity"])

        # Step 8: Incremental training using warm_start
        # warm_start=True keeps all existing trees and adds new ones
        _progress("Training random forest", 70)
        rf_model.warm_start = True
        old_tree_count = rf_model.n_estimators
        rf_model.n_estimators += 10  # add 10 new trees per retrain

        print(f"Adding 10 new trees. Total: {old_tree_count} → {rf_model.n_estimators}")
        rf_model.fit(X_new, y_new)

        # Step 9: Determine save path (company-specific or global)
        _progress("Saving model artifacts", 88)
        artifact_paths = get_artifact_paths(company_id)
        if company_id is not None:
            # Ensure company model directory exists
            company_dir = os.path.dirname(artifact_paths["model"])
            os.makedirs(company_dir, exist_ok=True)

        joblib.dump(rf_model, artifact_paths["model"])
        # Also save the vectorizer and encoders so the company model is self-contained
        joblib.dump(tfidf,    artifact_paths["vec"])
        joblib.dump(encoders, artifact_paths["enc"])

        # Invalidate cache so the next prediction uses the newly trained model
        cache_key = company_id if company_id is not None else "global"
        _model_cache.pop(cache_key, None)

        # Mark company as having its own model in the DB
        if company_id is not None:
            try:
                from database import supabase
                supabase.table("companies").update({"has_own_model": True}).eq("id", company_id).execute()
            except Exception as db_err:
                print(f"[retrain] DB flag update failed: {db_err}")

        return {
            "success":      True,
            "message":      f"Model retrained on {len(df)} feedback corrections. Added 10 new trees.",
            "total_trees":  rf_model.n_estimators,
            "records_used": len(df),
            "company_id":   company_id,
        }

    except Exception as e:
        print(f"Retrain failed: {e}")
        return {"success": False, "error": str(e)}

