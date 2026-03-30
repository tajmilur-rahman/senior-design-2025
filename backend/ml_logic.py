import os, json, joblib, numpy as np, pandas as pd, time as _time_global
import random, re, shutil
from config import META, FLAGS, ART_RF, get_artifact_paths, company_model_exists


def _metrics_dir(artifact_paths):
    return os.path.dirname(artifact_paths["met"])

def _promote_active_to_previous(artifact_paths):
    """Copy current rf_metrics.json → previous_metrics.json before overwriting."""
    src = artifact_paths["met"]
    if os.path.exists(src):
        shutil.copy2(src, os.path.join(_metrics_dir(artifact_paths), "previous_metrics.json"))

def _save_main_brain(artifact_paths, metrics_out):
    """Persist main_brain_metrics.json only if it doesn't already exist.
    Once set it is frozen — never overwritten by subsequent training runs."""
    path = os.path.join(_metrics_dir(artifact_paths), "main_brain_metrics.json")
    if not os.path.exists(path):
        with open(path, "w") as f:
            json.dump({**metrics_out, "build": "main_brain"}, f)
from scipy.sparse import hstack, csr_matrix
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics.pairwise import cosine_similarity

_model_cache: dict = {}


def load_pack(company_id=None):
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

    xt = v.transform([sum_text]).toarray()
    xm_list = []
    for c in META:
        val = meta_inputs.get(c, "UNKNOWN")
        encoder = e[c] if isinstance(e, dict) and c in e else e
        if hasattr(encoder, 'classes_'):
            encoded_val = encoder.transform([val])[0] if val in encoder.classes_ else 0
        else:
            encoded_val = 0
        xm_list.append(encoded_val)

    xm = np.array(xm_list).reshape(1, -1)
    flags_list = []
    text_lower = sum_text.lower()
    for f in FLAGS:
        is_active = 0
        if f == "has_crash" and ("crash" in text_lower or "segfault" in text_lower): is_active = 1
        elif f == "is_accessibility" and "accessibility" in text_lower: is_active = 1
        elif f == "is_regression" and "regression" in text_lower: is_active = 1
        elif f == "is_intermittent" and "intermittent" in text_lower: is_active = 1
        elif f == "has_patch" and "patch" in text_lower: is_active = 1
        flags_list.append(is_active)

    xf = np.array([flags_list])
    final_features = np.hstack([xm, xf, xt])
    pro = m.predict_proba(final_features)[0]
    sev_enc = e["severity"] if isinstance(e, dict) and "severity" in e else e
    lab = sev_enc.inverse_transform(np.arange(len(pro)))
    return lab[np.argmax(pro)], float(np.max(pro))


def heuristic_predict(text):
    text = text.lower()
    if "crash" in text or "security" in text or "data loss" in text: return "S1", 0.95
    if "slow" in text or "performance" in text or "broken" in text: return "S2", 0.85
    if "typo" in text or "color" in text or "align" in text: return "S4", 0.70
    return "S3", 0.60


def predict_team(text, diagnosis):
    t = text.lower()
    d = diagnosis.lower()
    if "security" in t or "auth" in t or "login" in t: return "🛡️ Security Ops"
    if "database" in d or "sql" in t or "query" in t: return "💾 Data Infrastructure"
    if "ui" in t or "css" in t or "align" in t or "color" in t: return "🎨 Frontend/UX"
    if "crash" in t or "memory" in t or "leak" in t: return "⚡ Core Performance"
    return "🔧 General Maintenance"


def extract_keywords(text):
    triggers = ["crash", "leak", "security", "fail", "slow", "broken", "error", "exception", "timeout", "freeze",
                "database", "login", "api"]
    found = []
    for word in text.split():
        clean_word = re.sub(r'\W+', '', word).lower()
        if clean_word in triggers:
            found.append(word)
    return list(set(found))


def predict_severity(summary: str, component: str = "General", platform: str = "All", company_id=None):
    used_source = "global"
    fallback = False

    if company_id is not None and company_model_exists(company_id):
        m, v, e, _ = load_pack(company_id)
        if m:
            used_source = "company"
        else:
            m, v, e, _ = load_pack(None)
            fallback = True
    else:
        m, v, e, _ = load_pack(None)
        if company_id is not None:
            fallback = True

    label, conf = None, 0.0

    if m:
        try:
            user_meta = {
                "component": component, "platform": platform, "product": "Firefox",
                "priority": "--", "status": "NEW", "op_sys": "Windows",
                "type": "defect", "resolution": "---"
            }
            label, conf = predict_internal(summary, user_meta, m, v, e)
        except Exception as err:
            print(f"Prediction Error: {err}. Falling back.")

    if not label:
        label, conf = heuristic_predict(summary)

    s = summary.lower()
    diagnosis = "Standard Logic Defect"
    if "database" in s or "sql" in s: diagnosis = "Database Contention"
    elif "ui" in s or "css" in s: diagnosis = "Frontend Rendering"
    elif "auth" in s: diagnosis = "Access Control Failure"
    elif "crash" in s: diagnosis = "Critical Memory Corruption"

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

# Seed corpus — always available so similar bugs show even on a fresh install.
# These mirror the sample bugs shown in the Analytics UI plus common Firefox bug patterns.
_SEED_CORPUS = [
    {"id": "sample-1", "summary": "Firefox crashes when opening more than 50 tabs on macOS",               "severity": "S1"},
    {"id": "sample-2", "summary": "Dark mode colours inconsistent across the Settings panel",              "severity": "S3"},
    {"id": "sample-3", "summary": "4K video playback stutters on YouTube",                                 "severity": "S2"},
    {"id": "sample-4", "summary": "Login button unresponsive on password-protected sites",                 "severity": "S2"},
    {"id": "seed-5",   "summary": "Browser crashes on startup after recent update",                        "severity": "S1"},
    {"id": "seed-6",   "summary": "Memory leak detected when multiple tabs stay open overnight",           "severity": "S2"},
    {"id": "seed-7",   "summary": "CSS layout broken on several popular websites after update",            "severity": "S2"},
    {"id": "seed-8",   "summary": "Extension toolbar icons not rendering correctly",                       "severity": "S3"},
    {"id": "seed-9",   "summary": "Address bar autocomplete stops working intermittently",                 "severity": "S3"},
    {"id": "seed-10",  "summary": "Password manager fails to autofill credentials on login pages",         "severity": "S2"},
    {"id": "seed-11",  "summary": "JavaScript errors in console on page load for some sites",              "severity": "S3"},
    {"id": "seed-12",  "summary": "PDF viewer crashes when opening large documents",                       "severity": "S1"},
    {"id": "seed-13",  "summary": "Audio drops intermittently during video conference calls",              "severity": "S2"},
    {"id": "seed-14",  "summary": "Bookmarks fail to sync across devices",                                 "severity": "S3"},
    {"id": "seed-15",  "summary": "Security certificate warning incorrectly shown on trusted sites",       "severity": "S1"},
    {"id": "seed-16",  "summary": "High CPU usage when watching fullscreen video",                         "severity": "S2"},
    {"id": "seed-17",  "summary": "Colour theme not applied consistently across all panels",               "severity": "S4"},
    {"id": "seed-18",  "summary": "Form input fields lose focus unexpectedly on some pages",               "severity": "S3"},
    {"id": "seed-19",  "summary": "Crash when switching between multiple windows rapidly",                 "severity": "S1"},
    {"id": "seed-20",  "summary": "Network requests timeout after idle period with no error message",      "severity": "S2"},
]

_SEV_NORM = {
    "blocker": "S1", "critical": "S1",
    "major":   "S2",
    "normal":  "S3", "minor": "S3", "trivial": "S3",
    "enhancement": "S4",
}


def find_similar_bugs(query_text: str, company_id=None, top_k: int = 5) -> list:
    """
    Return top_k bugs most similar to query_text using TF-IDF cosine similarity.
    Always includes the seed corpus so results appear even on a fresh install.
    """
    _, vec, _, _ = load_pack(company_id if company_id is not None else None)
    if vec is None:
        _, vec, _, _ = load_pack(None)
    if vec is None:
        return []

    try:
        from database import supabase as _db

        # Collect DB rows
        db_rows = []
        try:
            if company_id is not None:
                res = _db.table("feedback") \
                    .select("id, summary, actual_severity, predicted_severity") \
                    .eq("company_id", company_id) \
                    .not_.is_("summary", "null") \
                    .limit(400) \
                    .execute()
                db_rows = res.data or []

            if len(db_rows) < 20:
                res = _db.table("feedback") \
                    .select("id, summary, actual_severity, predicted_severity") \
                    .not_.is_("summary", "null") \
                    .limit(400) \
                    .execute()
                db_rows = res.data or []
        except Exception as db_err:
            print(f"[find_similar_bugs] DB fetch error: {db_err}")

        # Build unified corpus: seed first (always present), then DB rows
        summaries, severities, ids = [], [], []

        for s in _SEED_CORPUS:
            summaries.append(s["summary"])
            severities.append(s["severity"])
            ids.append(s["id"])

        seen = {s.lower() for s in summaries}
        for r in db_rows:
            text = r.get("summary", "").strip()
            if not text or text.lower() in seen:
                continue
            seen.add(text.lower())
            sev_raw = r.get("actual_severity") or r.get("predicted_severity") or "S3"
            sev = sev_raw if sev_raw in ("S1", "S2", "S3", "S4") else _SEV_NORM.get(str(sev_raw).lower(), "S3")
            summaries.append(text)
            severities.append(sev)
            ids.append(r.get("id"))

        # Vectorise and score
        all_texts = [query_text] + summaries
        matrix = vec.transform(all_texts)
        scores = cosine_similarity(matrix[0], matrix[1:])[0]

        top_indices = scores.argsort()[::-1][:top_k * 2]   # fetch extra, filter below

        query_lower = query_text.strip().lower()
        results = []
        for idx in top_indices:
            if len(results) >= top_k:
                break
            # Skip if it is effectively the same text as the query
            if summaries[idx].strip().lower() == query_lower:
                continue
            score = float(scores[idx])
            if score < 0.01:
                continue
            results.append({
                "id":       ids[idx],
                "summary":  summaries[idx],
                "severity": severities[idx],
                "score":    round(score, 3),
            })

        return results

    except Exception as e:
        print(f"[find_similar_bugs] error: {e}")
        return []


def full_train_from_dataset(records: list, company_id=None, progress_cb=None, dataset_label=None) -> dict:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import LabelEncoder
    import time as _time_mod

    def _progress(step, pct):
        if progress_cb:
            try: progress_cb(step, pct)
            except Exception: pass

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

    _progress("Building TF-IDF vocabulary", 25)
    vectorizer = TfidfVectorizer(
        max_features=10000, stop_words="english", ngram_range=(1, 2), min_df=2, sublinear_tf=True,
    )
    X_text = vectorizer.fit_transform(df["summary"])

    _progress("Encoding metadata and flags", 40)
    # Fill missing META columns with defaults (matches predict_internal)
    meta_defaults = {
        "component": "General", "product": "Firefox", "priority": "--",
        "platform": "All", "op_sys": "Windows", "type": "defect",
        "resolution": "---", "status": "NEW",
    }
    for c in META:
        if c not in df.columns:
            df[c] = meta_defaults.get(c, "UNKNOWN")
        df[c] = df[c].fillna(meta_defaults.get(c, "UNKNOWN")).astype(str)

    # Build FLAGS from text content (matches predict_internal)
    text_lower = df["summary"].str.lower()
    df["has_crash"]        = text_lower.str.contains("crash|segfault", regex=True).astype(int)
    df["is_accessibility"] = text_lower.str.contains("accessibility").astype(int)
    df["is_regression"]    = text_lower.str.contains("regression").astype(int)
    df["is_intermittent"]  = text_lower.str.contains("intermittent").astype(int)
    df["has_patch"]        = text_lower.str.contains("patch").astype(int)

    # Encode META columns
    encoders = {}
    X_meta_list = []
    for c in META:
        le_c = LabelEncoder()
        le_c.fit(df[c])
        X_meta_list.append(le_c.transform(df[c]).reshape(-1, 1))
        encoders[c] = le_c

    X_meta = np.hstack(X_meta_list)
    X_flags = df[FLAGS].values

    # Final feature matrix: meta(8) + flags(5) + text(vocab) — must match predict_internal
    X = hstack([csr_matrix(X_meta), csr_matrix(X_flags), X_text])
    y = df["severity"]

    _progress("Training Random Forest (100 trees)", 55)
    from sklearn.metrics import confusion_matrix as _sk_cm, f1_score, precision_score, recall_score

    rf = RandomForestClassifier(
        n_estimators=60, class_weight="balanced_subsample", max_depth=None,
        min_samples_split=5, random_state=42, n_jobs=-1,
    )
    rf.fit(X, y)

    _progress("Evaluating model performance", 75)
    labels_order = ["S1", "S2", "S3", "S4"]
    y_pred = rf.predict(X)
    cm = _sk_cm(y, y_pred, labels=labels_order)
    cm_data = [
        {"actual": labels_order[i], **{labels_order[j]: int(cm[i][j]) for j in range(4)}}
        for i in range(4)
    ]
    accuracy  = round(float(rf.score(X, y)), 4)
    f1_val    = round(float(f1_score(y, y_pred, labels=labels_order, average="weighted", zero_division=0)), 4)
    prec_val  = round(float(precision_score(y, y_pred, labels=labels_order, average="weighted", zero_division=0)), 4)
    rec_val   = round(float(recall_score(y, y_pred, labels=labels_order, average="weighted", zero_division=0)), 4)

    _progress("Saving model artifacts", 88)
    artifact_paths = get_artifact_paths(company_id)
    if company_id is not None:
        os.makedirs(os.path.dirname(artifact_paths["model"]), exist_ok=True)

    le_sev = LabelEncoder()
    le_sev.fit(["S1", "S2", "S3", "S4"])
    encoders["severity"] = le_sev

    joblib.dump(rf,         artifact_paths["model"])
    joblib.dump(vectorizer, artifact_paths["vec"])
    joblib.dump(encoders,   artifact_paths["enc"])

    metrics_out = {
        "accuracy":        accuracy,
        "f1_score":        f1_val,
        "precision":       prec_val,
        "recall":          rec_val,
        "confusion_matrix": cm_data,
        "last_trained":    _time_mod.ctime(),
        "sample_size":     len(df),
        "total_trees":     100,
        "mode":            "company" if company_id is not None else "global",
        "company_id":      company_id,
        "dataset_label":   dataset_label or ("Company bug database" if company_id else "Global training data"),
        "build":           "active",
    }
    _promote_active_to_previous(artifact_paths)
    with open(artifact_paths["met"], "w") as f:
        json.dump(metrics_out, f)
    # Full train also sets/updates the static main brain
    _save_main_brain(artifact_paths, metrics_out)

    cache_key = company_id if company_id is not None else "global"
    _model_cache.pop(cache_key, None)

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
    if not hasattr(encoder, 'classes_'):
        return np.zeros(len(values))
    safe_vals = [x if x in encoder.classes_ else encoder.classes_[0] for x in values]
    return encoder.transform(safe_vals)


def fast_retrain(feedback_data: list, company_id=None, progress_cb=None, dataset_label=None) -> dict:
    def _progress(step, pct):
        if progress_cb:
            try: progress_cb(step, pct)
            except Exception: pass

    global _model_cache
    print(f"Starting fast retrain (company_id={company_id})...")

    _progress("Loading base model", 10)
    # Prefer company model as base; fall back to global
    rf_model, tfidf, encoders, metrics = load_pack(company_id) if company_id else load_pack(None)
    if not rf_model and company_id:
        rf_model, tfidf, encoders, metrics = load_pack(None)

    if not rf_model:
        return {"success": False, "error": "Base model not found. Run full training first."}
    if not feedback_data:
        return {"success": False, "error": "No feedback data provided."}

    try:
        df = pd.DataFrame(feedback_data)

        sev_map = {
            "blocker": "S1", "critical": "S1", "s1": "S1",
            "major":   "S2", "s2": "S2",
            "normal":  "S3", "s3": "S3",
            "trivial": "S4", "s4": "S4",
        }
        df["severity"] = df["actual_severity"].str.lower().map(sev_map).fillna("S3")
        df["summary"]  = df["summary"].fillna("").astype(str)

        meta_defaults = {
            "component": "General", "product": "Firefox", "priority": "--",
            "platform": "All", "op_sys": "Windows", "type": "defect",
            "resolution": "---", "status": "NEW",
        }
        for c in META:
            if c not in df.columns:
                df[c] = meta_defaults.get(c, "UNKNOWN")
            df[c] = df[c].fillna(meta_defaults.get(c, "UNKNOWN")).astype(str)

        # Build FLAGS from text (matches predict_internal and full_train)
        text_lower_s = df["summary"].str.lower()
        df["has_crash"]        = text_lower_s.str.contains("crash|segfault", regex=True).astype(int)
        df["is_accessibility"] = text_lower_s.str.contains("accessibility").astype(int)
        df["is_regression"]    = text_lower_s.str.contains("regression").astype(int)
        df["is_intermittent"]  = text_lower_s.str.contains("intermittent").astype(int)
        df["has_patch"]        = text_lower_s.str.contains("patch").astype(int)

        _progress("Vectorizing text features", 50)
        X_text = tfidf.transform(df["summary"])

        _progress("Encoding metadata", 60)
        X_meta_list = []
        for c in META:
            enc = encoders.get(c)
            if enc:
                X_meta_list.append(safe_transform(enc, df[c]))
            else:
                X_meta_list.append(np.zeros(len(df)))

        X_meta = np.vstack(X_meta_list).T
        X_flags = df[FLAGS].values

        X_new = hstack([csr_matrix(X_meta), csr_matrix(X_flags), X_text])
        y_new = safe_transform(encoders["severity"], df["severity"])

        _progress("Training random forest", 70)
        from sklearn.metrics import confusion_matrix as _sk_cm, f1_score, precision_score, recall_score

        rf_model.warm_start = True
        old_tree_count = rf_model.n_estimators
        rf_model.n_estimators += 10
        print(f"Adding 10 new trees. Total: {old_tree_count} → {rf_model.n_estimators}")
        rf_model.fit(X_new, y_new)

        _progress("Evaluating updated model", 80)
        # Build confusion matrix from feedback labels vs model predictions on same data
        sev_enc = encoders.get("severity")
        labels_order = ["S1", "S2", "S3", "S4"]
        try:
            y_actual_labels = df["severity"].values  # string labels e.g. "S1"
            y_pred_encoded  = rf_model.predict(X_new)
            y_pred_labels   = sev_enc.inverse_transform(y_pred_encoded) if hasattr(sev_enc, "inverse_transform") else y_pred_encoded
            cm = _sk_cm(y_actual_labels, y_pred_labels, labels=labels_order)
            cm_data = [
                {"actual": labels_order[i], **{labels_order[j]: int(cm[i][j]) for j in range(4)}}
                for i in range(4)
            ]
            acc_val  = round(float((y_actual_labels == y_pred_labels).mean()), 4)
            f1_val   = round(float(f1_score(y_actual_labels, y_pred_labels, labels=labels_order, average="weighted", zero_division=0)), 4)
            prec_val = round(float(precision_score(y_actual_labels, y_pred_labels, labels=labels_order, average="weighted", zero_division=0)), 4)
            rec_val  = round(float(recall_score(y_actual_labels, y_pred_labels, labels=labels_order, average="weighted", zero_division=0)), 4)
        except Exception as _cm_err:
            print(f"[fast_retrain] confusion matrix error: {_cm_err}")
            cm_data = None
            acc_val = prec_val = rec_val = f1_val = None

        _progress("Saving model artifacts", 88)
        artifact_paths = get_artifact_paths(company_id)
        if company_id is not None:
            os.makedirs(os.path.dirname(artifact_paths["model"]), exist_ok=True)

        joblib.dump(rf_model, artifact_paths["model"])
        joblib.dump(tfidf,    artifact_paths["vec"])
        joblib.dump(encoders, artifact_paths["enc"])

        existing_met = {}
        if os.path.exists(artifact_paths["met"]):
            try:
                with open(artifact_paths["met"]) as _f:
                    existing_met = json.load(_f)
            except Exception:
                pass
        metrics_to_save = {
            **existing_met,
            "last_trained":  _time_global.ctime(),
            "total_trees":   rf_model.n_estimators,
            "dataset_label": dataset_label or "Feedback corrections",
            "mode":          "company" if company_id is not None else "global",
            "company_id":    company_id,
            "build":         "active",
            **({"confusion_matrix": cm_data} if cm_data else {}),
            **({"accuracy": acc_val, "f1_score": f1_val, "precision": prec_val, "recall": rec_val}
               if acc_val is not None else {}),
        }
        _promote_active_to_previous(artifact_paths)
        with open(artifact_paths["met"], "w") as _f:
            json.dump(metrics_to_save, _f)
        # Note: fast_retrain does NOT overwrite main_brain_metrics.json

        cache_key = company_id if company_id is not None else "global"
        _model_cache.pop(cache_key, None)

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
