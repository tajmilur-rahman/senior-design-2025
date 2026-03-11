import os, json, joblib, numpy as np, pandas as pd
import random, re
from config import META, FLAGS, ART_RF
from scipy.sparse import hstack, csr_matrix        
from sklearn.preprocessing import LabelEncoder   

# --- 1. CORE LOGIC ---
def load_pack(s=ART_RF):
    try:
        # Check if files actually exist
        if not os.path.exists(s['model']):
            print(f"⚠️ Model not found at {s['model']}. Using fallback mode.")
            return None, None, None, {}

        return joblib.load(s["model"]), joblib.load(s["vec"]), joblib.load(s["enc"]), json.load(
            open(s["met"])) if os.path.exists(s["met"]) else {}
    except Exception as e:
        print(f"Error loading model: {e}")
        return None, None, None, {}


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
_loaded_pack = None


def predict_severity(summary: str, component: str = "General", platform: str = "All"):
    """Called by the Website API."""
    global _loaded_pack
    if _loaded_pack is None: _loaded_pack = load_pack()

    m, v, e, _ = _loaded_pack
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
        "prediction": label,
        "confidence": conf,
        "diagnosis": diagnosis,
        "team": team,
        "keywords": keywords
    }

def safe_transform(encoder, values):
    """Handles unseen labels by mapping them to the first known class."""
    if not hasattr(encoder, 'classes_'):
        return np.zeros(len(values))
    safe_vals = [x if x in encoder.classes_ else encoder.classes_[0] for x in values]
    return encoder.transform(safe_vals)


def fast_retrain(feedback_data: list) -> dict:
    """
    Incrementally retrains the Random Forest using user feedback corrections.
    Uses warm_start to add new trees without discarding existing knowledge.
    Called automatically after feedback is saved, or manually by admin.

    feedback_data: list of dicts with keys:
        summary, actual_severity, component (from feedback table)
    """
    global _loaded_pack
    print("Starting fast retrain from feedback data...")

    # Step 1: Load current model artifacts
    if _loaded_pack is None:
        _loaded_pack = load_pack()
    rf_model, tfidf, encoders, metrics = _loaded_pack

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
        X_text = tfidf.transform(df["summary"])

        # Step 6: Encode metadata using existing encoders
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
        rf_model.warm_start = True
        old_tree_count = rf_model.n_estimators
        rf_model.n_estimators += 10  # add 10 new trees per retrain

        print(f"Adding 10 new trees. Total: {old_tree_count} → {rf_model.n_estimators}")
        rf_model.fit(X_new, y_new)

        # Step 9: Save updated model and force reload
        from config import ART_RF
        joblib.dump(rf_model, ART_RF["model"])
        _loaded_pack = load_pack()  # force reload so next prediction uses new model

        return {
            "success": True,
            "message": f"Model retrained on {len(df)} feedback corrections. Added 10 new trees.",
            "total_trees": rf_model.n_estimators,
            "records_used": len(df)
        }

    except Exception as e:
        print(f"Retrain failed: {e}")
        return {"success": False, "error": str(e)}

