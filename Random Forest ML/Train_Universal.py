import os
import json
import joblib
import argparse
import time
import shutil
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer

# --- CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# If your CSV is in a specific folder, adjust this path
CSV_FILE = os.path.join(BASE_DIR, "data.csv") 

ARTIFACTS = {
    "model": os.path.join(BASE_DIR, "../backend/rf_model.pkl"),
    "vectorizer": os.path.join(BASE_DIR, "../backend/tfidf_vectorizer.pkl"),
    "metrics": os.path.join(BASE_DIR, "rf_metrics.json"),
}

def backup_for_revert():
    """Save current model as '.old' before overwriting."""
    print("🛡️ Creating Revert Point (saving .old files)...")
    for name, path in ARTIFACTS.items():
        if os.path.exists(path):
            shutil.copy(path, path + ".old")

def run_training_pipeline(fast_mode=False):
    backup_for_revert()

    try:
        # --- 1. CONFIG ---
        # Demo Mode: Faster training. Production: More detailed (5000 words).
        MAX_FEATURES = 1000 if fast_mode else 5000
        N_ESTIMATORS = 50 if fast_mode else 100
        
        # --- 2. LOAD DATA ---
        print(f"📂 Loading data from {CSV_FILE}...")
        if not os.path.exists(CSV_FILE):
            raise Exception(f"File {CSV_FILE} not found! Please ensure data.csv is in {BASE_DIR}")
            
        df = pd.read_csv(CSV_FILE)
        
        # Standardize column names
        # We only care about TWO columns: The Text (summary) and the Label (severity)
        if "description" in df.columns:
            df.rename(columns={"description": "summary"}, inplace=True)
        
        # Validation: Ensure we have the basics
        if "summary" not in df.columns or "severity" not in df.columns:
            raise Exception("CSV is missing 'description' (or summary) or 'severity' columns.")
        
        print(f"   -> Loaded {len(df)} rows.")

        # --- 3. PREPROCESS (UNIVERSAL LOGIC) ---
        print("⚙️ Processing Text (Universal Mode)...")
        # Convert all text to lowercase strings to handle messy input
        df['summary'] = df['summary'].fillna("").astype(str).str.lower()
        
        # Normalize Severity Labels (Universal S-Ranking)
        # This maps company-specific terms like "Blocker" to our universal "S1"
        severity_map = {
            "blocker": "S1", "critical": "S1", "s1": "S1",
            "major": "S2", "s2": "S2",
            "normal": "S3", "minor": "S3", "trivial": "S3", "enhancement": "S4", "s3": "S3", "s4": "S4"
        }
        df["severity"] = df["severity"].str.lower().map(severity_map).fillna("S3") # Default to S3 if unknown

        # VECTORIZATION (The Translator)
        # We use TF-IDF to turn words into numbers. 
        # stop_words='english' removes useless words like "the", "and", "is".
        print("   -> converting text to mathematical vectors...")
        vectorizer = TfidfVectorizer(max_features=MAX_FEATURES, stop_words="english")
        X = vectorizer.fit_transform(df["summary"])
        y = df["severity"]

        # --- 4. TRAIN (THE BRAIN) ---
        print(f"🚀 Training Random Forest (Trees={N_ESTIMATORS})...")
        # class_weight="balanced" helps if you have way more S3s than S1s (common in real life)
        rf = RandomForestClassifier(n_estimators=N_ESTIMATORS, class_weight="balanced", random_state=42, n_jobs=-1)
        rf.fit(X, y)

        # --- 5. SAVE ARTIFACTS ---
        print("💾 Saving the brain...")
        joblib.dump(rf, ARTIFACTS["model"])
        joblib.dump(vectorizer, ARTIFACTS["vectorizer"])

        # Calculate Real Accuracy Score
        acc = rf.score(X, y)
        print(f"✅ Training Complete. Model Accuracy: {round(acc * 100, 2)}%")

        # Save metadata for the dashboard
        metrics = {
            "accuracy": round(acc, 2),
            "last_trained": time.ctime(),
            "status": "Universal Model Ready"
        }
        with open(ARTIFACTS["metrics"], "w") as f:
            json.dump(metrics, f)

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, help="Limit training size for speed testing")
    args = parser.parse_args()
    run_training_pipeline(fast_mode=(args.limit is not None))