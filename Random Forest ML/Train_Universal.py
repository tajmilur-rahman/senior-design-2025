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
ARTIFACTS = {
    "model": os.path.join(BASE_DIR, "../backend/rf_model.pkl"),
    "vectorizer": os.path.join(BASE_DIR, "../backend/tfidf_vectorizer.pkl"),
    "metrics": os.path.join(BASE_DIR, "rf_metrics.json"),
}

def backup_for_revert():
    """Save current model as '.old' before overwriting."""
    for name, path in ARTIFACTS.items():
        if os.path.exists(path):
            shutil.copy(path, path + ".old")

def run_training_pipeline(fast_mode=False):
    backup_for_revert()

    try:
        # 1. PARAMETER TUNING
        # Increase vocabulary to capture specific Firefox technical terms
        MAX_FEATURES = 15000 if not fast_mode else 2000
        N_ESTIMATORS = 200 # More trees improve the stability of minority class predictions
        
        # 2. LOAD DATA
        try:
            from database import supabase
        except ImportError:
            sys.path.append(os.path.abspath(os.path.join(BASE_DIR, '../backend')))
            from database import supabase

        fx_res = supabase.table("firefox_table").select("summary, severity").execute()
        bg_res = supabase.table("bugs").select("summary, severity").execute()

        df_fx = pd.DataFrame(fx_res.data)
        df_bg = pd.DataFrame(bg_res.data)
        df = pd.concat([df_fx, df_bg], ignore_index=True)

        if df.empty:
            raise Exception("Dataset is empty.")
        
        # 3. DATA CLEANING & LABEL NORMALIZATION
        df['summary'] = df['summary'].fillna("").astype(str).str.lower()
        
        severity_map = {
            "blocker": "S1", "critical": "S1", "s1": "S1",
            "major": "S2", "s2": "S2",
            "normal": "S3", "minor": "S3", "trivial": "S3", "s3": "S3",
            "enhancement": "S4", "s4": "S4"
        }
        df["severity"] = df["severity"].str.lower().map(severity_map).fillna("S3")

        # 4. VECTORIZATION (Learning phrases)
        # ngram_range(1, 2) ensures phrases like 'memory leak' are learned as single units.
        # min_df=5 prevents the model from learning noise/typos that only appear once.
        vectorizer = TfidfVectorizer(
            max_features=MAX_FEATURES,
            stop_words="english",
            ngram_range=(1, 2), 
            min_df=5,
            sublinear_tf=True
        )
        
        X = vectorizer.fit_transform(df["summary"])
        y = df["severity"]

        # 5. COST-SENSITIVE TRAINING
        # Using 'balanced_subsample' calculates weights at the tree level, 
        # which is more effective for high-volume imbalanced data like 220k rows.
        rf = RandomForestClassifier(
            n_estimators=N_ESTIMATORS,
            class_weight="balanced_subsample", 
            max_depth=None,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1
        )
        
        rf.fit(X, y)

        # 6. SAVE ARTIFACTS
        joblib.dump(rf, ARTIFACTS["model"])
        joblib.dump(vectorizer, ARTIFACTS["vectorizer"])

        # Generate metrics
        accuracy = rf.score(X, y)
        metrics = {
            "accuracy": round(accuracy, 4),
            "last_trained": time.ctime(),
            "sample_size": len(df),
            "features_learned": MAX_FEATURES
        }
        
        with open(ARTIFACTS["metrics"], "w") as f:
            json.dump(metrics, f)

        print(f"Training successful. Accuracy: {accuracy:.2%}")
        return True

    except Exception as e:
        print(f"Pipeline failed: {str(e)}")
        return False

if __name__ == "__main__":
    run_training_pipeline()