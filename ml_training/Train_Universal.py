import os
import sys
import json
import joblib
import argparse
import time
import shutil
import pandas as pd
import numpy as np

from scipy.sparse import hstack, csr_matrix
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    classification_report,
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    confusion_matrix,
)

# --- CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "../backend"))

# Import META/FLAGS so the training feature format matches backend/ml_logic.py exactly
try:
    sys.path.append(BACKEND_DIR)
    from config import META, FLAGS
except Exception as e:
    raise RuntimeError(f"Could not import META/FLAGS from backend/config.py: {e}")

GLOBAL_ARTIFACTS = {
    "model":      os.path.join(BASE_DIR, "rf_model.pkl"),
    "vectorizer": os.path.join(BASE_DIR, "tfidf_vectorizer.pkl"),
    "encoders":   os.path.join(BASE_DIR, "label_encoders.pkl"),
    "metrics":    os.path.join(BASE_DIR, "rf_metrics.json"),
}

def backup_for_revert(artifacts: dict) -> None:
    for _, path in artifacts.items():
        if os.path.exists(path):
            shutil.copy(path, path + ".old")

def fetch_all_rows(query_builder, page_size: int = 1000, max_pages: int = 10000):
    out = []
    start = 0
    for _ in range(max_pages):
        end = start + page_size - 1
        res = query_builder.range(start, end).execute()
        batch = res.data or []
        if not batch:
            break
        out.extend(batch)
        if len(batch) < page_size:
            break
        start += page_size
    return out

def _build_flags_from_summary(df: pd.DataFrame) -> pd.DataFrame:
    text_lower = df["summary"].str.lower()
    df["has_crash"]        = text_lower.str.contains("crash|segfault", regex=True).astype(int)
    df["is_accessibility"] = text_lower.str.contains("accessibility").astype(int)
    df["is_regression"]    = text_lower.str.contains("regression").astype(int)
    df["is_intermittent"]  = text_lower.str.contains("intermittent").astype(int)
    df["has_patch"]        = text_lower.str.contains("patch").astype(int)
    return df

def _normalize_severity(s: pd.Series) -> pd.Series:
    severity_map = {
        "blocker": "S1", "critical": "S1", "s1": "S1",
        "major":   "S2", "s2": "S2",
        "normal":  "S3", "minor": "S3", "trivial": "S3", "s3": "S3",
        "enhancement": "S4", "s4": "S4",
    }
    return s.fillna("").astype(str).str.lower().map(severity_map).fillna("S3")

def run_training_pipeline(fast_mode: bool = False) -> bool:
    artifacts = GLOBAL_ARTIFACTS
    backup_for_revert(artifacts)

    print("Training global (universal) model — production feature format (META + FLAGS + TF-IDF)")

    try:
        # Import supabase client
        try:
            from database import supabase
        except ImportError:
            sys.path.append(BACKEND_DIR)
            from database import supabase

        MAX_FEATURES = 15000 if not fast_mode else 2000
        N_ESTIMATORS = 200

        # --- LOAD DATA (PAGINATED, SCHEMA-SAFE) ---
        # Only select columns confirmed in your firefox_table UI: summary, component, severity, status
        fx_rows = fetch_all_rows(
            supabase.table("firefox_table").select("summary, severity, component, status")
        )
        df_fx = pd.DataFrame(fx_rows)

        # Feedback table: select only columns that likely exist
        fb_rows = fetch_all_rows(
            supabase.table("feedback")
                .select("summary, actual_severity, component")
                .eq("is_correction", True)
                .eq("consent_global_model", True)
                .not_.is_("actual_severity", "null")
        )
        df_fb = pd.DataFrame(fb_rows)
        if not df_fb.empty:
            df_fb = df_fb.rename(columns={"actual_severity": "severity"})

        df = pd.concat([df_fx, df_fb], ignore_index=True)

        if df.empty:
            raise Exception("Dataset is empty — no training data found.")

        # --- CLEANING ---
        df["summary"] = df["summary"].fillna("").astype(str).str.lower().str.strip()
        df = df[df["summary"] != ""].reset_index(drop=True)

        df["severity"] = _normalize_severity(df["severity"])

        print(f"Loaded {len(df)} training records (severity distribution):")
        print(df["severity"].value_counts().to_string())

        # Fill META columns required by the backend predictor.
        # If your DB doesn't have them, we create them with defaults.
        meta_defaults = {
            "component": "General",
            "product": "Firefox",
            "priority": "--",
            "platform": "All",
            "op_sys": "Windows",
            "type": "defect",
            "resolution": "---",
            "status": "NEW",
        }
        for c in META:
            if c not in df.columns:
                df[c] = meta_defaults.get(c, "UNKNOWN")
            df[c] = df[c].fillna(meta_defaults.get(c, "UNKNOWN")).astype(str)

        # FLAGS from summary
        df = _build_flags_from_summary(df)

        # --- TRAIN/TEST SPLIT ---
        y = df["severity"]
        df_train, df_test = train_test_split(
            df,
            test_size=0.2,
            random_state=42,
            stratify=y,
        )

        # --- TEXT VECTORIZATION ---
        vectorizer = TfidfVectorizer(
            max_features=MAX_FEATURES,
            stop_words="english",
            ngram_range=(1, 2),
            min_df=5,
            sublinear_tf=True,
        )
        X_text_train = vectorizer.fit_transform(df_train["summary"])
        X_text_test  = vectorizer.transform(df_test["summary"])

        # --- ENCODE META (fit on train only) ---
        encoders = {}
        X_meta_train_list = []
        X_meta_test_list = []

        for c in META:
            le_c = LabelEncoder()
            le_c.fit(df_train[c])
            encoders[c] = le_c

            X_meta_train_list.append(le_c.transform(df_train[c]).reshape(-1, 1))

            # safe mapping for unseen categories
            safe_test_vals = [v if v in le_c.classes_ else le_c.classes_[0] for v in df_test[c].tolist()]
            X_meta_test_list.append(le_c.transform(safe_test_vals).reshape(-1, 1))

        X_meta_train = np.hstack(X_meta_train_list)
        X_meta_test  = np.hstack(X_meta_test_list)

        X_flags_train = df_train[FLAGS].values
        X_flags_test  = df_test[FLAGS].values

        X_train = hstack([csr_matrix(X_meta_train), csr_matrix(X_flags_train), X_text_train])
        X_test  = hstack([csr_matrix(X_meta_test),  csr_matrix(X_flags_test),  X_text_test])

        y_train = df_train["severity"].values
        y_test  = df_test["severity"].values

        # severity encoder for backend decode
        le_sev = LabelEncoder()
        le_sev.fit(["S1", "S2", "S3", "S4"])
        encoders["severity"] = le_sev

        # --- TRAIN ---
        rf = RandomForestClassifier(
            n_estimators=N_ESTIMATORS,
            class_weight="balanced_subsample",
            max_depth=None,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1,
        )
        rf.fit(X_train, y_train)

        # --- EVALUATE (TEST) ---
        y_pred = rf.predict(X_test)

        acc  = accuracy_score(y_test, y_pred)
        f1   = f1_score(y_test, y_pred, average="macro")
        prec = precision_score(y_test, y_pred, average="macro", zero_division=0)
        rec  = recall_score(y_test, y_pred, average="macro", zero_division=0)

        labels = ["S1", "S2", "S3", "S4"]
        cm = confusion_matrix(y_test, y_pred, labels=labels)
        cm_rows = []
        for i, a in enumerate(labels):
            row = {"actual": a}
            for j, p in enumerate(labels):
                row[p] = int(cm[i, j])
            cm_rows.append(row)

        print("TEST classification report:")
        print(classification_report(y_test, y_pred, labels=labels))

        # --- SAVE ARTIFACTS ---
        joblib.dump(rf, artifacts["model"])
        joblib.dump(vectorizer, artifacts["vectorizer"])
        joblib.dump(encoders, artifacts["encoders"])

        metrics = {
            "accuracy": round(float(acc), 4),
            "f1_score": round(float(f1), 4),
            "precision": round(float(prec), 4),
            "recall": round(float(rec), 4),
            "confusion_matrix": cm_rows,
            "last_trained": time.ctime(),
            "sample_size": int(len(df)),
            "test_size": int(len(df_test)),
            "features_learned": int(MAX_FEATURES),
            "mode": "global",
            "company_id": None,
            "total_trees": int(N_ESTIMATORS),
            "dataset_label": "Global training data (Mozilla + consented feedback)",
        }
        with open(artifacts["metrics"], "w") as f:
            json.dump(metrics, f)

        print(
            f"Training successful. Global model saved.\n"
            f"Test Accuracy: {acc:.2%} | Macro F1: {f1:.3f} | Records: {len(df)} (test={len(df_test)})"
        )
        return True

    except Exception as e:
        print(f"Pipeline failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train the Spotfixes severity prediction model (global).")
    parser.add_argument("--fast", action="store_true", help="Fast mode: reduces vocabulary size for quick iteration")
    args = parser.parse_args()
    ok = run_training_pipeline(fast_mode=args.fast)
    sys.exit(0 if ok else 1)