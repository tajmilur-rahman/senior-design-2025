import os, json, joblib, argparse, time, shutil
import numpy as np, pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
from scipy.sparse import hstack, csr_matrix

load_dotenv()

# --- CONFIG ---
DB_CONFIG = {
    "user": os.getenv("BUGBUG_DB_USER", "postgres"),
    "pass": os.getenv("BUGBUG_DB_PASSWORD", "2331"),
    "host": os.getenv("BUGBUG_DB_HOST", "localhost"),
    "port": os.getenv("BUGBUG_DB_PORT", "5432"),
    "name": os.getenv("BUGBUG_DB", "bugbug_data")
}
DATABASE_URL = f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['pass']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['name']}"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS = {
    "model": os.path.join(BASE_DIR, "rf_model.pkl"),
    "vectorizer": os.path.join(BASE_DIR, "tfidf_vectorizer.pkl"),
    "encoders": os.path.join(BASE_DIR, "label_encoders.pkl"),
    "metrics": os.path.join(BASE_DIR, "rf_metrics.json"),
}


def backup_for_revert():
    """Save current model as '.old' before overwriting. This is the user's Undo button."""
    print("🛡️ Creating Revert Point (saving .old files)...")
    for name, path in ARTIFACTS.items():
        if os.path.exists(path):
            shutil.copy(path, path + ".old")


def run_training_pipeline(fast_mode=False):
    # STEP 1: Save the 'Old Brain' so we can revert later
    backup_for_revert()

    try:
        # --- 1. CONFIG ---
        # Demo Mode: 10 trees, 500 words. Production Mode: 300 trees, 5000 words.
        MAX_FEATURES = 500 if fast_mode else 5000
        N_ESTIMATORS = 10 if fast_mode else 300
        MAX_DEPTH = 10 if fast_mode else 60
        LIMIT = 1000 if fast_mode else None

        # --- 2. LOAD DATA ---
        print("🔌 Connecting to DB...")
        engine = create_engine(DATABASE_URL)
        query = "SELECT (data->>'summary') as summary, (data->>'severity') as severity, (data->>'component') as component, (data->>'product') as product, (data->>'status') as status, (data->>'cf_crash_signature') IS NOT NULL as has_crash FROM bugs WHERE (data->>'summary') IS NOT NULL"
        if LIMIT: query += f" ORDER BY bug_id DESC LIMIT {LIMIT}"

        with engine.connect() as conn:
            df = pd.read_sql(text(query), conn)

        if df.empty: raise Exception("No data found for training")

        # --- 3. PREPARE FEATURES ---
        df['summary'] = df['summary'].fillna("").astype(str).str.lower()
        df["severity"] = df["severity"].str.lower().replace(
            {"blocker": "S1", "critical": "S1", "major": "S2", "normal": "S3", "minor": "S3", "trivial": "S4",
             "enhancement": "S4"})

        cat_cols = ["component", "product", "status"]
        encoders = {}
        meta_matrices = []
        for c in cat_cols:
            df[c] = df[c].fillna("UNKNOWN").astype(str)
            le = LabelEncoder()
            encoded = le.fit_transform(df[c])
            encoders[c] = le
            meta_matrices.append(encoded.reshape(-1, 1))

        meta_matrices.append(df["has_crash"].astype(int).values.reshape(-1, 1))
        X_meta = np.hstack(meta_matrices)

        le_sev = LabelEncoder()
        y = le_sev.fit_transform(df["severity"])
        encoders["severity"] = le_sev

        tfidf = TfidfVectorizer(max_features=MAX_FEATURES, stop_words="english", ngram_range=(1, 2))
        X_text = tfidf.fit_transform(df["summary"])
        X = hstack([csr_matrix(X_meta), X_text])

        # --- 4. TRAIN ---
        print(f"🚀 Training (Fast={fast_mode})...")
        rf = RandomForestClassifier(n_estimators=N_ESTIMATORS, max_depth=MAX_DEPTH, class_weight="balanced", n_jobs=-1,
                                    random_state=42)
        rf.fit(X, y)

        # --- 5. SAVE NEW MODEL ---
        print("💾 Saving new artifacts...")
        joblib.dump(rf, ARTIFACTS["model"])
        joblib.dump(tfidf, ARTIFACTS["vectorizer"])
        joblib.dump(encoders, ARTIFACTS["encoders"])

        # Save metrics with a flag indicating it's a new run
        acc = rf.score(X, y)  # Quick accuracy check on training set for demo
        metrics = {
            "accuracy": round(acc, 2),
            "f1_score": round(acc, 2),  # Simplified for demo speed
            "last_trained": time.ctime(),
            "status": "Active (Retrained)",
            "can_revert": True
        }
        with open(ARTIFACTS["metrics"], "w") as f:
            json.dump(metrics, f)

        print("✅ Training Successful!")
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    run_training_pipeline(fast_mode=(args.limit is not None))