# streamlit_app.py
import streamlit as st
import psycopg2
import pandas as pd
import json
import joblib
import os
import bcrypt
import numpy as np
from dotenv import load_dotenv

# -----------------------------
# CONFIG & ENV SETUP
# -----------------------------
st.set_page_config(page_title="Bug severity analysis", layout="wide")
load_dotenv()  # Reads credentials from .env

# -----------------------------
# DATABASE CONFIG
# -----------------------------
DB = {
    "dbname": "bugbug_data",
    "user": "postgres",
    "password": "1234",
    "host": "localhost",
    "port": "5432"
}

# -----------------------------
# SESSION STATE
# -----------------------------
if "authenticated" not in st.session_state:
    st.session_state.authenticated = False
if "username" not in st.session_state:
    st.session_state.username = None

# -----------------------------
# HELPER: LOAD HASHED CREDS
# -----------------------------
USERS = {
    os.getenv("ADMIN_USER"): os.getenv("ADMIN_PASS_HASH"),
    os.getenv("STUDENT_USER"): os.getenv("STUDENT_PASS_HASH")
}

def check_credentials(username, password):
    if username not in USERS or USERS[username] is None:
        return False
    stored_hash = USERS[username].encode("utf-8")
    return bcrypt.checkpw(password.encode("utf-8"), stored_hash)

# -----------------------------
# LOGIN PAGE
# -----------------------------
def login_page():
    st.markdown("<h2 style='text-align:center;'>🔐 Secure login</h2>", unsafe_allow_html=True)
    st.markdown("<p style='text-align:center;color:#aaa;'>Login authentication for bug severity dashboard</p>", unsafe_allow_html=True)
    st.markdown("<hr>", unsafe_allow_html=True)

    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        username = st.text_input("Username", placeholder="Enter your username")
        password = st.text_input("Password", type="password", placeholder="Enter your password")

        if st.button("Login", use_container_width=True):
            if check_credentials(username, password):
                st.session_state.authenticated = True
                st.session_state.username = username
                st.success(f"Welcome, {username}! Redirecting...")
                st.rerun()
            else:
                st.error("❌ Invalid username or password")

    st.markdown("<p style='text-align:center;font-size:12px;color:#777;'>Bug severity analysis © 2025</p>", unsafe_allow_html=True)

# -----------------------------
# LOAD BUG DATA FROM DB
# -----------------------------
@st.cache_data
def load_bugs(limit):
    conn = psycopg2.connect(**DB)
    df = pd.read_sql(f"SELECT bug_id, data FROM bugs LIMIT {limit}", conn)
    conn.close()
    def parse(x, k):
        if isinstance(x, dict): return x.get(k, "N/A")
        try: return json.loads(x).get(k, "N/A")
        except: return "N/A"
    df["summary"] = df["data"].apply(lambda x: parse(x, "summary"))
    df["component"] = df["data"].apply(lambda x: parse(x, "component"))
    df["priority"] = df["data"].apply(lambda x: parse(x, "priority"))
    df["severity"] = df["data"].apply(lambda x: parse(x, "severity"))
    df["status"] = df["data"].apply(lambda x: parse(x, "status"))
    return df[["bug_id", "summary", "component", "priority", "severity", "status"]]

# -----------------------------
# LOAD TRAINED MODEL ARTIFACTS
# -----------------------------
@st.cache_resource
def load_rf_model():
    model = joblib.load("severity_model.pkl")
    vectorizer = joblib.load("summary_vectorizer.pkl")
    label_encoders = joblib.load("label_encoders.pkl")
    return model, vectorizer, label_encoders

# -----------------------------
# MAIN APP
# -----------------------------
def main_app():
    st.sidebar.title(f"Welcome, {st.session_state.username}")
    page = st.sidebar.radio("Select Page", ["Bug data explorer", "Severity prediction demo", "Logout"])

    # PAGE 1
    if page == "Bug data explorer":
        st.header("📊 Bug data explorer")
        limit = st.slider("Number of bugs to load", 10, 1000, 200)
        df = load_bugs(limit)

        with st.expander("🔍 Filters", expanded=True):
            c1, c2, c3 = st.columns(3)
            with c1:
                sev = st.multiselect("Severity", sorted(df["severity"].unique()))
            with c2:
                stat = st.multiselect("Status", sorted(df["status"].unique()))
            with c3:
                key = st.text_input("Keyword in summary")

        if sev: df = df[df["severity"].isin(sev)]
        if stat: df = df[df["status"].isin(stat)]
        if key: df = df[df["summary"].str.contains(key, case=False, na=False)]

        st.dataframe(df, use_container_width=True, height=400)
        st.download_button("⬇️ Download filtered CSV", df.to_csv(index=False), "filtered_bugs.csv")

    # PAGE 2
    elif page == "Severity prediction demo":
        st.header("🤖 Severity prediction demo")

        df = load_bugs(500)
        model, vectorizer, label_encoders = load_rf_model()

        # Select a bug to predict
        bid = st.selectbox("Select bug ID", df["bug_id"].tolist())
        if bid:
            bug_row = df[df["bug_id"] == bid].iloc[0]
            summary_text = bug_row["summary"]
            component = bug_row["component"] or "UNKNOWN"
            priority = bug_row["priority"] or "UNKNOWN"

            st.text_area("Bug summary", summary_text, height=100)

            if st.button("Predict severity", use_container_width=True):
                # Prepare feature vector same way as training
                le_comp = label_encoders["component"]
                le_prio = label_encoders["priority"]
                le_sev  = label_encoders["severity"]

                comp_enc = le_comp.transform([component]) if component in le_comp.classes_ else [0]
                prio_enc = le_prio.transform([priority]) if priority in le_prio.classes_ else [0]

                X_meta = np.vstack([comp_enc, prio_enc]).T
                X_text = vectorizer.transform([summary_text]).toarray()
                X_input = np.hstack([X_meta, X_text])

                pred_label_idx = model.predict(X_input)[0]
                pred_label = le_sev.inverse_transform([pred_label_idx])[0].lower()

                color_map = {"critical": "#ff4b4b", "major": "#ffb400", "normal": "#33cc33"}
                color = color_map.get(pred_label, "#cccccc")

                st.markdown(
                    f"<div style='text-align:center; font-size:22px; font-weight:700; "
                    f"color:{color}; padding:10px;'>Predicted Severity: {pred_label.upper()}</div>",
                    unsafe_allow_html=True
                )

                with st.expander("Technical Explanation"):
                    st.markdown("""
                    - Uses trained **Random Forest** model with TF-IDF vectorization.  
                    - Inputs: `component`, `priority`, and `summary` text.  
                    - Outputs: Predicted severity class.  
                    - Model and preprocessing pipelines loaded from local artifacts.
                    """)

    # LOGOUT
    elif page == "Logout":
        st.session_state.authenticated = False
        st.session_state.username = None
        st.success("Logged out successfully.")
        st.rerun()

# -----------------------------
# ROUTING
# -----------------------------
if not st.session_state.authenticated:
    login_page()
else:
    main_app()
