import os
import sys
import json
import joblib
import argparse
import time
import shutil
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# --- CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '../backend'))

# Global model artifacts (legacy paths — kept for backward compatibility)
GLOBAL_ARTIFACTS = {
    "model":      os.path.join(BASE_DIR, "rf_model.pkl"),
    "vectorizer": os.path.join(BASE_DIR, "tfidf_vectorizer.pkl"),
    "encoders":   os.path.join(BASE_DIR, "label_encoders.pkl"),
    "metrics":    os.path.join(BASE_DIR, "rf_metrics.json"),
}

def get_company_artifacts(company_id: int) -> dict:
    company_dir = os.path.join(BACKEND_DIR, "models", f"company_{company_id}")
    return {
        "model":      os.path.join(company_dir, "rf_model.pkl"),
        "vectorizer": os.path.join(company_dir, "tfidf_vectorizer.pkl"),
        "encoders":   os.path.join(company_dir, "label_encoders.pkl"),
        "metrics":    os.path.join(company_dir, "rf_metrics.json"),
        "dir":        company_dir,
    }

def backup_for_revert(artifacts):
    """Save current model as '.old' before overwriting."""
    for key, path in artifacts.items():
        if key == "dir":
            continue
        if os.path.exists(path):
            shutil.copy(path, path + ".old")

def run_training_pipeline(fast_mode=False, mode="global", company_id=None):
    if mode == "company" and company_id is None:
        print("ERROR: --company-id is required when --mode=company")
        return False

    artifacts = get_company_artifacts(company_id) if mode == "company" else GLOBAL_ARTIFACTS
    backup_for_revert(artifacts)

    if mode == "company":
        os.makedirs(artifacts["dir"], exist_ok=True)
        print(f"Training company model for company_id={company_id}")
    else:
        print("Training global (universal) model")

    try:
        # Setup DB path
        try:
            from database import supabase
        except ImportError:
            sys.path.append(BACKEND_DIR)
            from database import supabase

        # --- PARAMETER TUNING ---
        MAX_FEATURES = 15000 if not fast_mode else 2000
        N_ESTIMATORS = 200

        # --- LOAD DATA ---
        if mode == "global":
            # Global: use Mozilla baseline bugs + consented feedback corrections
            fx_res = supabase.table("firefox_table").select("summary, severity").execute()
            df_fx  = pd.DataFrame(fx_res.data or [])

            # Include feedback corrections that gave consent for global model use
            fb_res = supabase.table("feedback") \
                             .select("summary, actual_severity") \
                             .eq("is_correction", True) \
                             .eq("consent_global_model", True) \
                             .not_.is_("actual_severity", "null") \
                             .execute()
            df_fb = pd.DataFrame(fb_res.data or []).rename(columns={"actual_severity": "severity"})

            df = pd.concat([df_fx, df_fb], ignore_index=True)

        else:
            # Company: use bugs belonging to this company + their feedback corrections
            bg_res = supabase.table("bugs") \
                             .select("summary, severity") \
                             .eq("company_id", company_id) \
                             .execute()
            df_bg = pd.DataFrame(bg_res.data or [])

            fb_res = supabase.table("feedback") \
                             .select("summary, actual_severity") \
                             .eq("company_id", company_id) \
                             .eq("is_correction", True) \
                             .not_.is_("actual_severity", "null") \
                             .execute()
            df_fb = pd.DataFrame(fb_res.data or []).rename(columns={"actual_severity": "severity"})

            df = pd.concat([df_bg, df_fb], ignore_index=True)

        if df.empty:
            raise Exception("Dataset is empty — no training data found.")

        # --- DATA CLEANING & LABEL NORMALIZATION ---
        df["summary"] = df["summary"].fillna("").astype(str).str.lower()

        severity_map = {
            "blocker": "S1", "critical": "S1", "s1": "S1",
            "major": "S2", "s2": "S2",
            "normal": "S3", "minor": "S3", "trivial": "S3", "s3": "S3",
            "enhancement": "S4", "s4": "S4"
        }
        df["severity"] = df["severity"].str.lower().map(severity_map).fillna("S3")
        print(f"Loaded {len(df)} training records (severity distribution):")
        print(df["severity"].value_counts().to_string())

        # --- VECTORIZATION ---
        vectorizer = TfidfVectorizer(
            max_features=MAX_FEATURES,
            stop_words="english",
            ngram_range=(1, 2),
            min_df=5,
            sublinear_tf=True
        )

        X = vectorizer.fit_transform(df["summary"])
        y = df["severity"]

        # --- TRAINING ---
        rf = RandomForestClassifier(
            n_estimators=N_ESTIMATORS,
            class_weight="balanced_subsample",
            max_depth=None,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1
        )

        rf.fit(X, y)

        # --- SAVE ARTIFACTS ---
        joblib.dump(rf,         artifacts["model"])
        joblib.dump(vectorizer, artifacts["vectorizer"])

        # Simple label encoder dict for compatibility with ml_logic.py
        from sklearn.preprocessing import LabelEncoder
        encoders = {}
        for col in ["severity"]:
            le = LabelEncoder()
            le.fit(["S1", "S2", "S3", "S4"])
            encoders[col] = le
        joblib.dump(encoders, artifacts["encoders"])

        accuracy = rf.score(X, y)
        metrics = {
            "accuracy":         round(accuracy, 4),
            "last_trained":     time.ctime(),
            "sample_size":      len(df),
            "features_learned": MAX_FEATURES,
            "mode":             mode,
            "company_id":       company_id,
        }

        with open(artifacts["metrics"], "w") as f:
            json.dump(metrics, f)

        print(f"Training successful. Mode={mode}, Accuracy: {accuracy:.2%}, Records: {len(df)}")

        # Mark company as having its own model in DB
        if mode == "company" and company_id is not None:
            try:
                supabase.table("companies").update({"has_own_model": True}).eq("id", company_id).execute()
                print(f"Marked company {company_id} as having its own model.")
            except Exception as db_err:
                print(f"Warning: Could not update companies table: {db_err}")

        return True

    except Exception as e:
        print(f"Pipeline failed: {str(e)}")
        import traceback; traceback.print_exc()
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train the ApexOS severity prediction model.")
    parser.add_argument(
        "--mode", choices=["global", "company"], default="global",
        help="'global' trains the universal model (consent-filtered); 'company' trains a per-company model"
    )
    parser.add_argument(
        "--company-id", type=int, default=None,
        help="Company ID to train for (required when --mode=company)"
    )
    parser.add_argument(
        "--fast", action="store_true",
        help="Fast mode: reduces vocabulary size for quick iteration"
    )
    args = parser.parse_args()
    success = run_training_pipeline(
        fast_mode=args.fast,
        mode=args.mode,
        company_id=args.company_id,
    )
    sys.exit(0 if success else 1)
