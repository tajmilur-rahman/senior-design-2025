import os, json, joblib, argparse, time, shutil
import numpy as np, pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
from scipy.sparse import hstack, csr_matrix

# --- CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = "data.csv"  # The file you just downloaded

ARTIFACTS = {
    "model": os.path.join(BASE_DIR, "rf_model.pkl"),
    "vectorizer": os.path.join(BASE_DIR, "tfidf_vectorizer.pkl"),
    "encoders": os.path.join(BASE_DIR, "label_encoders.pkl"),
    "metrics": os.path.join(BASE_DIR, "rf_metrics.json"),
}

def backup_for_revert():
    """Save current model as '.old' before overwriting."""
    print("🛡️ Creating Revert Point (saving .old files)...")
    for name, path in ARTIFACTS.items():
        if os.path.exists(path):
            shutil.copy(path, path + ".old")

def run_training_pipeline(fast_mode=False):
    # STEP 1: Save the 'Old Brain' so we can revert later
    backup_for_revert()

    try:
        # --- 1. CONFIG ---
        # Demo Mode: 10 trees, 500 words. Production: 100 trees, 5000 words.
        MAX_FEATURES = 1000 if fast_mode else 5000
        N_ESTIMATORS = 10 if fast_mode else 100
        MAX_DEPTH = 10 if fast_mode else 60
        
        # --- 2. LOAD DATA FROM CSV ---
        print(f"📂 Loading data from {CSV_FILE}...")
        if not os.path.exists(CSV_FILE):
            raise Exception(f"File {CSV_FILE} not found! Please make sure it is in this folder.")
            
        df = pd.read_csv(CSV_FILE)
        
        # RENAME columns to match what the ML model expects
        # CSV has: id, description, status, severity, date
        # Model wants: summary, severity, component, product, status, has_crash
        
        df.rename(columns={"description": "summary"}, inplace=True)
        
        # FILL MISSING COLUMNS (Since your simple CSV doesn't have these, we fake them for the code)
        if "component" not in df.columns: df["component"] = "Core"
        if "product" not in df.columns: df["product"] = "Firefox"
        if "has_crash" not in df.columns: df["has_crash"] = 0
        
        print(f"   -> Loaded {len(df)} rows.")

        if df.empty: raise Exception("No data found for training")

        # --- 3. PREPARE FEATURES ---
        print("⚙️ Preprocessing features...")
        df['summary'] = df['summary'].fillna("").astype(str).str.lower()
        
        # Normalize Severity
        df["severity"] = df["severity"].str.lower().replace({
            "blocker": "S1", "critical": "S1", 
            "major": "S2", "normal": "S3", 
            "minor": "S3", "trivial": "S4",
            "enhancement": "S4"
        })

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
        print(f"🚀 Training Random Forest (Fast={fast_mode})...")
        rf = RandomForestClassifier(n_estimators=N_ESTIMATORS, max_depth=MAX_DEPTH, class_weight="balanced", n_jobs=-1, random_state=42)
        rf.fit(X, y)

        # --- 5. SAVE NEW MODEL ---
        print("💾 Saving new artifacts...")
        joblib.dump(rf, ARTIFACTS["model"])
        joblib.dump(tfidf, ARTIFACTS["vectorizer"])
        joblib.dump(encoders, ARTIFACTS["encoders"])

        # Save metrics
        acc = rf.score(X, y)
        metrics = {
            "accuracy": round(acc, 2),
            "f1_score": round(acc, 2),
            "last_trained": time.ctime(),
            "status": "Active (Retrained)",
            "can_revert": True
        }
        with open(ARTIFACTS["metrics"], "w") as f:
            json.dump(metrics, f)

        print("✅ Training Successful! Artifacts created.")
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    run_training_pipeline(fast_mode=(args.limit is not None))