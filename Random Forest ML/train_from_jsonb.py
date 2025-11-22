import os, json, joblib, psycopg2, argparse
import numpy as np, pandas as pd
from dotenv import load_dotenv
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, train_test_split, cross_val_score
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix
from imblearn.over_sampling import SMOTE
from scipy.sparse import hstack, csr_matrix

# -----------------------------
# CONFIGURATION
# -----------------------------
load_dotenv()

DB = {
    "dbname": os.getenv("BUGBUG_DB", "bugbug_data"),
    "user": os.getenv("BUGBUG_DB_USER", "postgres"),
    "password": os.getenv("BUGBUG_DB_PASSWORD", "2331"),
    "host": os.getenv("BUGBUG_DB_HOST", "localhost"),
    "port": os.getenv("BUGBUG_DB_PORT", "5432"),
}

RANDOM_STATE = 42
# TF-IDF feature limit and number of trees in Random Forest
MAX_FEATURES = 2500
N_ESTIMATORS = 200

ARTIFACTS = {
    "model": "rf_model.pkl",
    "vectorizer": "tfidf_vectorizer.pkl",
    "encoders": "label_encoders.pkl",
    "metrics": "rf_metrics.json",
}

QUERY = """
SELECT
  (data->>'summary')     AS summary,
  (data->>'component')   AS component,
  (data->>'priority')    AS priority,
  (data->>'status')      AS status,
  (data->>'product')     AS product,
  (data->>'platform')    AS platform,
  (data->>'op_sys')      AS op_sys,
  (data->>'type')        AS type,
  (data->>'resolution')  AS resolution,
  (data->>'severity')    AS severity,
  (data->>'cf_crash_signature') IS NOT NULL AS has_crash,
  (data->>'keywords') ILIKE '%accessibility%' AS is_accessibility,
  (data->>'keywords') ILIKE '%regression%' AS is_regression,
  (data->>'keywords') ILIKE '%intermittent%' AS is_intermittent,
  (data->>'keywords') ILIKE '%patch%' AS has_patch
FROM bugs
WHERE (data->>'summary') IS NOT NULL
  AND (data->>'severity') IS NOT NULL;
"""

# -----------------------------
# DATA LOADING
# -----------------------------
def load_bugs(limit=None):
    print("Connecting to database...")
    conn = psycopg2.connect(**DB)
    sql = QUERY
    if limit:
        sql = sql.rstrip().rstrip(';') + f" LIMIT {int(limit)};"
    df = pd.read_sql(sql, conn)
    conn.close()
    print(f"Loaded {len(df):,} bugs.")
    return df.dropna(subset=["summary", "severity"])

# -----------------------------
# FEATURE ENGINEERING
# -----------------------------
def prepare_features(df, max_features):
    print("Preparing features...")
    text_col = "summary"
    cat_cols = ["component","priority","status","product","platform","op_sys","type","resolution"]
    extra_cols = ["has_crash","is_accessibility","is_regression","is_intermittent","has_patch"]

    # Merge blocker and S1
    df["severity"] = df["severity"].replace({"blocker": "S1"})

    # Clean and encode metadata
    for c in cat_cols:
        df[c] = df[c].fillna("UNKNOWN").astype(str)
    for c in extra_cols:
        df[c] = df[c].astype(int)
    df[text_col] = df[text_col].astype(str)

    all_meta = cat_cols + extra_cols
    encoders = {c: LabelEncoder().fit(df[c]) for c in all_meta + ["severity"]}
    X_meta = np.vstack([encoders[c].transform(df[c]) for c in all_meta]).T
    X_meta_sparse = csr_matrix(X_meta)

    tfidf = TfidfVectorizer(max_features=max_features, stop_words="english", ngram_range=(1,2))
    X_text = tfidf.fit_transform(df[text_col])

    X = hstack([X_meta_sparse, X_text])
    y = encoders["severity"].transform(df["severity"])

    print(f"Feature matrix: {X.shape}, Labels: {len(np.unique(y))}")
    return X, y, tfidf, encoders

# -----------------------------
# MODEL TRAINING & EVALUATION
# -----------------------------
def train_model(X, y, encoders, n_estimators):
    print("Training Random Forest...")
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    rf = RandomForestClassifier(
        n_estimators=n_estimators,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        class_weight="balanced_subsample",
        min_samples_split=3,
        min_samples_leaf=2
    )

    acc_cv = cross_val_score(rf, X, y, cv=skf, scoring="accuracy", n_jobs=-1).mean()
    f1_cv = cross_val_score(rf, X, y, cv=skf, scoring="f1_weighted", n_jobs=-1).mean()
    print(f"Cross-Val Accuracy: {acc_cv:.3f}, Weighted F1: {f1_cv:.3f}")

    unique, counts = np.unique(y, return_counts=True)
    stratify_ok = counts.min() >= 2

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, stratify=y if stratify_ok else None, test_size=0.2, random_state=RANDOM_STATE
    )

    print("Applying SMOTE oversampling...")
    sm = SMOTE(random_state=RANDOM_STATE, sampling_strategy="not minority")
    X_train, y_train = sm.fit_resample(X_train, y_train)

    rf.fit(X_train, y_train)
    y_pred = rf.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    macro_f1 = f1_score(y_test, y_pred, average="macro")
    weighted_f1 = f1_score(y_test, y_pred, average="weighted")
    report = classification_report(y_test, y_pred, zero_division=0, output_dict=True)
    cm = confusion_matrix(y_test, y_pred)

    metrics = {
        "accuracy": round(float(acc), 4),
        "macro_f1": round(float(macro_f1), 4),
        "weighted_f1": round(float(weighted_f1), 4),
        "classification_report": report,
        "confusion_matrix": {
            "labels": encoders["severity"].inverse_transform(np.arange(cm.shape[0])).tolist(),
            "matrix": cm.tolist()
        }
    }

    print(f"Final Accuracy: {acc:.3f}, Macro F1: {macro_f1:.3f}, Weighted F1: {weighted_f1:.3f}")
    return rf, metrics

# -----------------------------
# SAVE ARTIFACTS
# -----------------------------
def save_all(model, vec, enc, metrics):
    joblib.dump(model, ARTIFACTS["model"])
    joblib.dump(vec, ARTIFACTS["vectorizer"])
    joblib.dump(enc, ARTIFACTS["encoders"])
    with open(ARTIFACTS["metrics"], "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print("Artifacts saved:")
    for k, v in ARTIFACTS.items():
        print(f" - {v}")

# -----------------------------
# MAIN EXECUTION
# -----------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Random Forest bug severity model")
    parser.add_argument("--limit", type=int, help="Limit number of rows for dev mode")
    args = parser.parse_args()

    print("Starting training pipeline...")
    if args.limit:
        print(f"DEV MODE: limit = {args.limit}")
        df = load_bugs(limit=args.limit)
        X, y, tfidf, encoders = prepare_features(df, max_features=500)
        model, metrics = train_model(X, y, encoders, n_estimators=20)
    else:
        df = load_bugs()
        X, y, tfidf, encoders = prepare_features(df, max_features=MAX_FEATURES)
        model, metrics = train_model(X, y, encoders, n_estimators=N_ESTIMATORS)

    save_all(model, tfidf, encoders, metrics)
    print("Training complete. Artifacts ready for Streamlit.")
