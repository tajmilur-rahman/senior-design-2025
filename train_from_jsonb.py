# train_from_jsonb.py
import os, joblib, numpy as np, pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
import psycopg2

# ---------------- CONFIG ----------------
DB_CONN = {
    "dbname": os.environ.get("BUGBUG_DB","bugbug_data"),
    "user": os.environ.get("BUGBUG_DB_USER","postgres"),
    "password": os.environ.get("BUGBUG_DB_PASSWORD","1234"),
    "host": os.environ.get("BUGBUG_DB_HOST","localhost"),
    "port": os.environ.get("BUGBUG_DB_PORT","5432")
}
TABLE_SQL = """
SELECT
  bug_id,
  (data->>'component') AS component,
  (data->>'severity')  AS severity,
  (data->>'priority')  AS priority,
  (data->>'summary')   AS summary
FROM bugs
WHERE (data->>'severity') IS NOT NULL
  AND (data->>'summary') IS NOT NULL;
"""
RANDOM_STATE = 42
TFIDF_MAX_FEATURES = 500
MODEL_OUT = "severity_model.pkl"
VECT_OUT = "summary_vectorizer.pkl"
LE_OUT = "label_encoders.pkl"
# ----------------------------------------

def load_data():
    conn = psycopg2.connect(**DB_CONN)
    df = pd.read_sql(TABLE_SQL, conn)
    conn.close()
    return df

def preprocess(df):
    # Basic cleaning
    df = df.dropna(subset=['severity', 'summary']).copy()
    df['component'] = df['component'].fillna('UNKNOWN').astype(str)
    df['priority']  = df['priority'].fillna('UNKNOWN').astype(str)
    df['summary']   = df['summary'].astype(str)

    # Label encode metadata and target
    le_comp = LabelEncoder().fit(df['component'])
    le_prio = LabelEncoder().fit(df['priority'])
    le_sev  = LabelEncoder().fit(df['severity'])

    comp_enc = le_comp.transform(df['component'])
    prio_enc = le_prio.transform(df['priority'])
    y = le_sev.transform(df['severity'])

    # TF-IDF for summary
    vectorizer = TfidfVectorizer(max_features=TFIDF_MAX_FEATURES, stop_words='english', ngram_range=(1,2))
    X_summary = vectorizer.fit_transform(df['summary']).toarray()

    # Combine features (meta first so importances map easily)
    X_meta = np.vstack([comp_enc, prio_enc]).T
    X = np.hstack([X_meta, X_summary])

    label_encoders = {"component": le_comp, "priority": le_prio, "severity": le_sev}
    return X, y, vectorizer, label_encoders, df

def train_and_eval(X_train, X_test, y_train, y_test):
    rf = RandomForestClassifier(n_estimators=200, random_state=RANDOM_STATE, n_jobs=-1, class_weight='balanced')
    rf.fit(X_train, y_train)
    y_pred = rf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"Accuracy: {acc:.4f}")
    print("Classification report:")
    print(classification_report(y_test, y_pred, zero_division=0))
    print("Confusion matrix:\n", confusion_matrix(y_test, y_pred))
    return rf

if __name__ == "__main__":
    print("Loading data from DB...")
    df = load_data()
    print(f"Rows loaded: {len(df)}")

    print("Preprocessing...")
    X, y, vectorizer, label_encoders, df_proc = preprocess(df)

    # Stratified split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE)

    print("Training Random Forest...")
    model = train_and_eval(X_train, X_test, y_train, y_test)

    print("Saving model artifacts...")
    joblib.dump(model, MODEL_OUT)
    joblib.dump(vectorizer, VECT_OUT)
    joblib.dump(label_encoders, LE_OUT)
    print("Saved:", MODEL_OUT, VECT_OUT, LE_OUT)
