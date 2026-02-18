import os
import joblib
import json
import pandas as pd
import time
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__)) # inside random_forest_ml
ROOT_DIR = os.path.dirname(CURRENT_DIR)                  # Senior-Design folder
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")          # backend folder

DATA_FILE = os.path.join(BACKEND_DIR, "data.csv")
MODEL_PATH = os.path.join(BACKEND_DIR, "rf_model.pkl")
VEC_PATH = os.path.join(BACKEND_DIR, "tfidf_vectorizer.pkl")
METRICS_PATH = os.path.join(BACKEND_DIR, "rf_metrics.json")

def retrain_model(new_data_df=None):
    """
    1. Loads base data.csv from backend/.
    2. Combines it with new_data_df (In-Memory).
    3. Retrains Random Forest.
    4. Saves artifacts (.pkl) back to backend/.
    """
    print(f"🔄 STARTING RETRAINING PIPELINE...")
    print(f"   📂 Looking for data in: {DATA_FILE}")

    try:
        if not os.path.exists(DATA_FILE):
            return {"success": False, "error": f"data.csv not found at {DATA_FILE}"}

        # 1. Load Base Data
        df = pd.read_csv(DATA_FILE)

        # 2. Combine with New Data (If provided)
        if new_data_df is not None and not new_data_df.empty:
            print(f"   -> Merging {len(new_data_df)} new records...")
            # Ensure we only merge relevant columns
            new_data_clean = new_data_df[['summary', 'severity']].copy()
            df = pd.concat([df, new_data_clean], ignore_index=True)

        # 3. Preprocess / Normalize
        severity_map = {
            "blocker": "S1", "critical": "S1", "s1": "S1", "p1": "S1",
            "major": "S2", "s2": "S2", "p2": "S2",
            "normal": "S3", "s3": "S3", "p3": "S3",
            "minor": "S4", "trivial": "S4", "s4": "S4", "p4": "S4", "p5": "S4", "enhancement": "S4"
        }

        if "severity" in df.columns:
            df["severity"] = df["severity"].astype(str).str.lower().map(severity_map).fillna("S3")

        df['summary'] = df['summary'].fillna("").astype(str).str.lower()

        # 4. Vectorize
        vectorizer = TfidfVectorizer(max_features=5000, stop_words="english")
        X = vectorizer.fit_transform(df["summary"])
        y = df["severity"]

        # 5. Train
        rf = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42, n_jobs=-1)
        rf.fit(X, y)

        # 6. Save Artifacts (Saved to BACKEND_DIR)
        joblib.dump(rf, MODEL_PATH)
        joblib.dump(vectorizer, VEC_PATH)

        # 7. Calc Metrics
        acc = rf.score(X, y)
        metrics = {
            "accuracy": round(acc * 100, 2),
            "total_samples": len(df),
            "last_trained": time.ctime()
        }

        with open(METRICS_PATH, "w") as f:
            json.dump(metrics, f)

        print(f"✅ Retraining Complete. Accuracy: {metrics['accuracy']}%")
        return {"success": True, "metrics": metrics}

    except Exception as e:
        print(f"❌ Training Failed: {e}")
        return {"success": False, "error": str(e)}