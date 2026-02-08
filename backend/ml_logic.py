import os, json, joblib, numpy as np, pandas as pd
import random, re
from config import META, FLAGS, ART_RF


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