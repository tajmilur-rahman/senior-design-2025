# train_rf_model_final.py
import os, json, joblib, psycopg2, numpy as np, pandas as pd
from dotenv import load_dotenv
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, train_test_split, cross_val_score
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix
from imblearn.over_sampling import SMOTE

# -----------------------------
# CONFIG
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
MAX_FEATURES = 2500        # Reduced for faster TF-IDF
N_ESTIMATORS = 200         # Fewer trees, still stable

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
  (data->>'severity')    AS severity
FROM bugs
WHERE (data->>'summary') IS NOT NULL
  AND (data->>'severity') IS NOT NULL;
"""

# -----------------------------
# LOAD DATA
# -----------------------------
def load_bugs():
    print("Connecting to database...")
    conn = psycopg2.connect(**DB)
    df = pd.read_sql(QUERY, conn)
    conn.close()
    print(f"Loaded {len(df):,} bugs from PostgreSQL.")
    return df.dropna(subset=["summary", "severity"])

# -----------------------------
# FEATURE ENGINEERING
# -----------------------------
def prepare_features(df):
    text_col = "summary"
    cat_cols = ["component","priority","status","product","platform","op_sys","type","resolution"]

    for c in cat_cols:
        df[c] = df[c].fillna("UNKNOWN").astype(str)
    df[text_col] = df[text_col].astype(str)

    # Encode categorical variables
    encoders = {c: LabelEncoder().fit(df[c]) for c in cat_cols + ["severity"]} # transforms strings to integer codes
    X_meta = np.vstack([encoders[c].transform(df[c]) for c in cat_cols]).T # each row = 1 bug, column = one encoded variable

    # TF-IDF for summary text
    tfidf = TfidfVectorizer(
        max_features=MAX_FEATURES, # keeps only top 2500 based on TF or IDF
        stop_words="english", # removes common words such as the or is
        ngram_range=(1, 2)
    )
    X_text = tfidf.fit_transform(df[text_col]).toarray()

    # Combine
    X = np.hstack([X_meta, X_text])
    y = encoders["severity"].transform(df["severity"])

    print(f"Feature matrix shape: {X.shape}, Labels: {len(np.unique(y))}")
    return X, y, tfidf, encoders

# -----------------------------
# TRAIN & EVALUATE
# -----------------------------
def train_model(X, y, encoders):
    # Quick CV (2 folds)
    skf = StratifiedKFold(n_splits=2, shuffle=True, random_state=RANDOM_STATE)
    rf = RandomForestClassifier(
        n_estimators=N_ESTIMATORS,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        class_weight="balanced_subsample",
        min_samples_split=3,
        min_samples_leaf=2
    )

    acc_cv = cross_val_score(rf, X, y, cv=skf, scoring="accuracy", n_jobs=-1).mean()
    f1_cv = cross_val_score(rf, X, y, cv=skf, scoring="f1_weighted", n_jobs=-1).mean()
    print(f"Cross-Val Accuracy: {acc_cv:.3f}, Weighted F1: {f1_cv:.3f}")

    # Final split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, stratify=y, test_size=0.2, random_state=RANDOM_STATE
    )

    # Light SMOTE
    print("Applying SMOTE oversampling (not minority)...")
    sm = SMOTE(random_state=RANDOM_STATE, sampling_strategy="not minority")
    X_train, y_train = sm.fit_resample(X_train, y_train)

    # Train
    print("Training Random Forest...")
    rf.fit(X_train, y_train)
    y_pred = rf.predict(X_test)

    # Evaluate
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

    print(f"✅ Final Accuracy: {acc:.3f}")
    print(f"✅ Macro F1: {macro_f1:.3f}")
    print(f"✅ Weighted F1: {weighted_f1:.3f}")
    return rf, metrics

# -----------------------------
# SAVE
# -----------------------------
def save_all(model, vec, enc, metrics):
    joblib.dump(model, ARTIFACTS["model"])
    joblib.dump(vec, ARTIFACTS["vectorizer"])
    joblib.dump(enc, ARTIFACTS["encoders"])
    with open(ARTIFACTS["metrics"], "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print("Artifacts saved:")
    for v in ARTIFACTS.values():
        print(f" - {v}")

# -----------------------------
# MAIN
# -----------------------------
if __name__ == "__main__":
    print("🚀 Starting final Random Forest training...")
    df = load_bugs()
    X, y, tfidf, encoders = prepare_features(df)
    model, metrics = train_model(X, y, encoders)
    save_all(model, tfidf, encoders, metrics)
    print("✅ Training complete. Artifacts ready for Streamlit integration.")
