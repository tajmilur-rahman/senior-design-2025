
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
import plotly.express as px
from datetime import datetime
from typing import List, Dict, Any

# Added for XGBoost artifact compatibility (models are loaded via joblib)
import xgboost as xgb  # noqa: F401

# -----------------------------
# CONFIG & THEME
# -----------------------------
st.set_page_config(
    page_title="Bug Prioritization based on Severity",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={
        "Get Help": "https://github.com/your-repo",
        "Report a bug": "https://github.com/your-repo/issues",
        "About": "# Bug Severity\nSenior Design - Machine Learning powered project"
    }
)

load_dotenv()

DB = {
    "dbname": os.getenv("BUGBUG_DB", "bugbug_data"),
    "user": os.getenv("BUGBUG_DB_USER", "postgres"),
    "password": os.getenv("BUGBUG_DB_PASSWORD", "2331"),
    "host": os.getenv("BUGBUG_DB_HOST", "localhost"),
    "port": os.getenv("BUGBUG_DB_PORT", "5432")
}

ARTIFACTS = {
    "model": "rf_model.pkl",
    "vectorizer": "tfidf_vectorizer.pkl",
    "encoders": "label_encoders.pkl",
    "metrics": "rf_metrics.json"
}

# ---- NEW: XGBoost artifacts in the SAME directory ----
ARTIFACTS_XGB = {
    "model": "xgb_model.pkl",
    "vectorizer": "tfidf_vectorizer_xgb.pkl",
    "encoders": "label_encoders_xgb.pkl",
    "metrics": "xgb_metrics.json"
}

# Training metadata columns used in training pipeline
METADATA_COLS = ["component", "product", "priority", "platform", "op_sys", "type", "resolution", "status"]

# -----------------------------
# SESSION STATE
# -----------------------------
defaults = {
    "authenticated": False,
    "username": None,
    "milestones_done": {
        "Data understanding": True,
        "Data collection": True,
        "Feature engineering": True,
        "Baseline model (RF)": True,
        "Evaluation dashboard": True,
        "Write-up": False
    },
}
for k, v in defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# -----------------------------
# GLOBAL STYLING
# -----------------------------
st.markdown(
    """
<style>
/* Sidebar hoverable radio items */
div[role="radiogroup"] > label {
    display:flex;align-items:center;gap:10px;border-radius:12px;
    padding:10px 14px;margin-bottom:6px;cursor:pointer;
    transition:all .2s ease-in-out;background:transparent;color:#ddd;font-weight:500;
}
div[role="radiogroup"] > label:hover {background:rgba(150,150,255,.15);color:#fff;transform:translateX(4px);}
div[role="radiogroup"] > label > div:first-child {display:none !important;}
div[role="radiogroup"] > label:has(input:checked) {
    background:rgba(100,150,255,.25);border-left:4px solid #6495ED;color:#fff;
}
/* Metric cards tighter */
[data-testid="stMetricValue"] {font-size:1.25rem;}
/* Headings spacing */
h1, h2, h3 { margin-top:.2rem; }
</style>
""",
    unsafe_allow_html=True,
)

# -----------------------------
# AUTHENTICATION
# -----------------------------
USERS = {
    os.getenv("ADMIN_USER", "admin"): os.getenv("ADMIN_PASS_HASH"),
    os.getenv("STUDENT_USER", "student"): os.getenv("STUDENT_PASS_HASH"),
}


def check_credentials(username: str, password: str) -> bool:
    if username not in USERS or not USERS[username]:
        return False
    try:
        stored_hash = USERS[username].encode("utf-8")
        return bcrypt.checkpw(password.encode("utf-8"), stored_hash)
    except Exception:
        return False


# -----------------------------
# LOGIN PAGE  (original simple version, single form)
# -----------------------------
def login_page():
    st.markdown("<h2 style='text-align:center;'>🔐 Secure login</h2>", unsafe_allow_html=True)
    st.markdown(
        "<p style='text-align:center;color:#aaa;'>Login authentication for bug severity dashboard</p>",
        unsafe_allow_html=True,
    )
    st.markdown("<hr>", unsafe_allow_html=True)

    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        # Form allows Enter-key submission
        with st.form("login_form", clear_on_submit=False):
            username = st.text_input("Username", placeholder="Enter your username")
            password = st.text_input("Password", type="password", placeholder="Enter your password")
            submit = st.form_submit_button("Login", use_container_width=True)

        if submit:
            if check_credentials(username, password):
                st.session_state.authenticated = True
                st.session_state.username = username
                st.success(f"Welcome, {username}! Redirecting...")
                st.rerun()
            else:
                st.error("❌ Invalid username or password")

    st.markdown(
        "<p style='text-align:center;font-size:12px;color:#777;'>Bug severity analysis © 2025</p>",
        unsafe_allow_html=True,
    )



# -----------------------------
# DATA & MODEL LOADERS
# -----------------------------
@st.cache_data(show_spinner="Loading bug database...")
def load_bugs(limit: int = 5000) -> pd.DataFrame:
    try:
        conn = psycopg2.connect(**DB)
        query = f"SELECT bug_id, data FROM bugs LIMIT {limit}" if limit else "SELECT bug_id, data FROM bugs"
        df = pd.read_sql(query, conn)
        conn.close()
    except Exception as e:
        st.error(f"Database connection failed: {e}")
        return pd.DataFrame()

    def parse(x: Any, k: str, default="N/A"):
        if isinstance(x, dict):
            return x.get(k, default)
        try:
            return json.loads(x).get(k, default)
        except Exception:
            return default

    cols = [
        "summary",
        "component",
        "product",
        "priority",
        "platform",
        "op_sys",
        "type",
        "resolution",
        "status",
        "severity",
        "creation_time",
        "last_change_time",
    ]
    for c in cols:
        df[c] = df["data"].apply(lambda x: parse(x, c))

    # parse datetimes if present
    for dt_col in ["creation_time", "last_change_time"]:
        if dt_col in df.columns:
            try:
                df[dt_col] = pd.to_datetime(df[dt_col], errors="coerce")
            except Exception:
                pass

    return df[["bug_id"] + cols]


@st.cache_resource(show_spinner="Loading ML model...")
def load_rf_model():
    try:
        model = joblib.load(ARTIFACTS["model"])
        vectorizer = joblib.load(ARTIFACTS["vectorizer"])
        encoders = joblib.load(ARTIFACTS["encoders"])
        metrics = {}
        if os.path.exists(ARTIFACTS["metrics"]):
            with open(ARTIFACTS["metrics"], "r", encoding="utf-8") as f:
                metrics = json.load(f)
        return model, vectorizer, encoders, metrics
    except Exception as e:
        st.error(f"Model loading failed: {e}")
        return None, None, None, {}

# ---- NEW: load XGBoost artifacts, if present ----
@st.cache_resource(show_spinner="Loading XGBoost model...")
def load_xgb_model():
    try:
        model = joblib.load(ARTIFACTS_XGB["model"])
        vectorizer = joblib.load(ARTIFACTS_XGB["vectorizer"])
        encoders = joblib.load(ARTIFACTS_XGB["encoders"])
        metrics = {}
        if os.path.exists(ARTIFACTS_XGB["metrics"]):
            with open(ARTIFACTS_XGB["metrics"], "r", encoding="utf-8") as f:
                metrics = json.load(f)
        return model, vectorizer, encoders, metrics
    except Exception as e:
        # Silent availability check; UI will show message if user requests XGB
        return None, None, None, {}

# -----------------------------
# PREDICTION UTILS
# -----------------------------
def _build_feature_names(vectorizer, meta_cols: List[str]) -> List[str]:
    names = [f"META:{c}" for c in meta_cols]
    try:
        if vectorizer is not None:
            names += [f"TFIDF:{t}" for t in vectorizer.get_feature_names_out().tolist()]
    except Exception:
        pass
    return names


def predict_severity(summary: str, metadata_dict: Dict[str, Any] = None, model=None, vectorizer=None, encoders=None):
    if not all([model, vectorizer, encoders]):
        return "N/A", pd.DataFrame(), []

    X_text = vectorizer.transform([summary]).toarray()

    # encode metadata robustly
    if metadata_dict is None or not metadata_dict:
        X_meta = np.zeros((1, len(METADATA_COLS)))
    else:
        encoded = []
        for col in METADATA_COLS:
            le = encoders[col]
            val = metadata_dict.get(col, "N/A")
            if val in (None, "N/A"):
                encoded.append(0)
            else:
                try:
                    encoded.append(le.transform([val])[0])
                except ValueError:
                    encoded.append(-1)  # unseen
        X_meta = np.array([encoded])

    X = np.hstack([X_meta, X_text])
    proba = model.predict_proba(X)[0]
    pred_idx = int(np.argmax(proba))
    pred_label = encoders["severity"].inverse_transform([pred_idx])[0]

    prob_df = pd.DataFrame(
        {"Severity": encoders["severity"].inverse_transform(np.arange(len(proba))), "Probability": proba}
    ).sort_values("Probability", ascending=False)

    # simple heuristic "influential tokens"
    top_tokens = []
    try:
        feature_names = _build_feature_names(vectorizer, METADATA_COLS)
        importances = getattr(model, "feature_importances_", None)
        if importances is not None and len(importances) == len(feature_names):
            token_mask = [i for i, n in enumerate(feature_names) if n.startswith("TFIDF:")]
            imp_tokens = pd.Series(
                importances[token_mask], index=[feature_names[i].replace("TFIDF:", "") for i in token_mask]
            )
            words = set([w.lower() for w in summary.split() if len(w) > 2])
            overlap = imp_tokens[imp_tokens.index.isin(words)]
            top_tokens = overlap.sort_values(ascending=False).head(5).index.tolist()
    except Exception:
        pass

    return pred_label, prob_df, top_tokens

# ---- NEW: thin wrapper for XGB to reuse the same predictor ----
def predict_severity_xgb(summary: str, metadata_dict: Dict[str, Any] = None, xgb_pack=None):
    xgb_model, xgb_vectorizer, xgb_encoders = xgb_pack
    return predict_severity(summary, metadata_dict, xgb_model, xgb_vectorizer, xgb_encoders)

# -----------------------------
# UI HELPERS
# -----------------------------
def kpi_row(metrics: Dict[str, Any], df: pd.DataFrame):
    c1, c2, c3, c4 = st.columns(4)
    total = len(df)
    with c1:
        st.metric("Total Bugs", f"{total:,}")
    with c2:
        st.metric("Model Accuracy", f"{metrics.get('accuracy', 0) * 100:.2f}%")
    with c3:
        st.metric("Macro F1", f"{metrics.get('macro_f1', 0) * 100:.2f}%")
    with c4:
        crit = df[df["severity"].astype(str).str.lower() == "critical"]
        ratio = (len(crit) / total * 100) if total else 0
        st.metric("Critical Bugs", f"{len(crit):,} ({ratio:.1f}%)")


def milestone_board():
    done = st.session_state.milestones_done
    total = len(done)
    pct = int(100 * sum(done.values()) / max(total, 1))
    st.subheader("Milestones")
    st.progress(pct / 100.0, text=f"{pct}% complete")
    cols = st.columns(3)
    it = iter(done.items())
    for col in cols:
        with col:
            for _ in range((total + 2) // 3):
                try:
                    name, val = next(it)
                    st.checkbox(name, value=val, key=f"ms_{name}", disabled=True)
                except StopIteration:
                    break


# -----------------------------
# MAIN APP
# -----------------------------
def main_app():
    model, vectorizer, encoders, metrics = load_rf_model()
    if not model:
        st.stop()

    # NEW: Attempt to load XGB once, for later sections that opt-in to it
    xgb_model, xgb_vectorizer, xgb_encoders, xgb_metrics = load_xgb_model()

    df = load_bugs(5000)

    # Sidebar
    menu = ["Home", "Bug Data Explorer", "Severity Prediction", "Model Evaluation", "Logout"]
    icons = ["🏠", "📊", "🤖", "📈", "🚪"]

    st.sidebar.markdown(f"**👋 {st.session_state.username or ''}**")
    st.sidebar.caption("Senior Design Portal")
    st.sidebar.markdown("---")
    page = st.sidebar.radio("", menu, format_func=lambda x: f"{icons[menu.index(x)]}  **{x}**", label_visibility="collapsed")

    # ---------------- Home ----------------
    if page == "Home":
        st.title("Bug Prioritization based on Severity Prediction")
        st.markdown("#### Machine Learning Powered Bug Triage for Mozilla Firefox")
        with st.container():
            c1, c2 = st.columns([2, 1])
            with c1:
                st.info(
                    "This project develops a model to predict and prioritize Firefox bugs by **severity**, "
                    "combining TF‑IDF features from bug summaries with **metadata encoding** and a **Random Forest** classifier. "
                    "The goal is to accelerate triage and focus engineering effort on high‑impact issues."
                )
            with c2:
                st.markdown("**Project Tags**")
                st.code("ML • RandomForest • TF‑IDF • PostgreSQL • Streamlit", language="text")

        kpi_row(metrics, df)
        col1, col2 = st.columns(2, gap="large")
        with col1:
            fig_pie = px.pie(df, names="severity", title="Severity Distribution", color_discrete_sequence=px.colors.sequential.Viridis)
            st.plotly_chart(fig_pie, use_container_width=True)
        with col2:
            by_prod = df.groupby(["product", "severity"]).size().reset_index(name="count")
            fig_bar = px.bar(by_prod, x="product", y="count", color="severity", title="Bugs by Product", barmode="group")
            st.plotly_chart(fig_bar, use_container_width=True)

        milestone_board()

    # ---------------- Bug Data Explorer ----------------
    elif page == "Bug Data Explorer":
        st.header("📊 Bug Data Explorer")
        limit = st.slider("Max bugs to load", 100, 10000, 3000, 500)
        df = load_bugs(limit)
        if df.empty:
            st.stop()

        with st.expander("🔍 Filters", expanded=True):
            c1, c2, c3, c4 = st.columns(4)
            severity = c1.multiselect("Severity", options=sorted(df["severity"].dropna().unique()), default=[])
            product = c2.multiselect("Product", options=sorted(df["product"].dropna().unique()), default=[])
            platform = c3.multiselect("Platform", options=sorted(df["platform"].dropna().unique()), default=[])
            status = c4.multiselect("Status", options=sorted(df["status"].dropna().unique()), default=[])
            keyword = st.text_input("Summary keyword", placeholder="Search summaries...")
            c5, c6 = st.columns(2)
            date_from = c5.date_input("Created from", value=None)
            date_to = c6.date_input("Created to", value=None)

        filtered = df.copy()
        if severity:
            filtered = filtered[filtered["severity"].isin(severity)]
        if product:
            filtered = filtered[filtered["product"].isin(product)]
        if platform:
            filtered = filtered[filtered["platform"].isin(platform)]
        if status:
            filtered = filtered[filtered["status"].isin(status)]
        if keyword:
            filtered = filtered[
                filtered["summary"].astype(str).str.contains(keyword, case=False, na=False)
            ]
        if date_from and "creation_time" in filtered:
            filtered = filtered[filtered["creation_time"] >= pd.to_datetime(date_from)]
        if date_to and "creation_time" in filtered:
            filtered = filtered[filtered["creation_time"] <= pd.to_datetime(date_to)]

        st.info(f"**Showing {len(filtered):,} bugs** (out of {len(df):,})")
        st.dataframe(filtered.drop("data", axis=1, errors="ignore"), use_container_width=True, height=460)
        st.download_button(
            "⬇️ Download Filtered CSV", filtered.to_csv(index=False), "bugs_filtered.csv", use_container_width=True
        )

        c1, c2 = st.columns(2)
        with c1:
            fig_donut = px.pie(filtered, names="severity", hole=.45, title="Severity Ratio (Donut)")
            st.plotly_chart(fig_donut, use_container_width=True)
        with c2:
            by_comp = (
                filtered.groupby(["component"])
                .size()
                .reset_index(name="count")
                .sort_values("count", ascending=False)
                .head(20)
            )
            fig_comp = px.bar(by_comp, x="count", y="component", orientation="h", title="Top Components by Count")
            st.plotly_chart(fig_comp, use_container_width=True)

        # Resolution time if timestamps exist
        if "creation_time" in filtered.columns and "last_change_time" in filtered.columns:
            tmp = filtered.dropna(subset=["creation_time", "last_change_time"]).copy()
            if not tmp.empty:
                tmp["resolution_days"] = (tmp["last_change_time"] - tmp["creation_time"]).dt.days
                c3, c4 = st.columns(2)
                with c3:
                    fig_scatter = px.scatter(
                        tmp,
                        x="resolution_days",
                        y="severity",
                        color="severity",
                        title="Resolution Time (days) vs Severity",
                        opacity=0.6,
                    )
                    st.plotly_chart(fig_scatter, use_container_width=True)

                with c4:
                    fig_box = px.box(tmp, x="severity", y="resolution_days", title="Resolution Time by Severity")
                    st.plotly_chart(fig_box, use_container_width=True)

    # ---------------- Severity Prediction ----------------
    elif page == "Severity Prediction":
        st.header("🤖 Severity Prediction")
        tabs = st.tabs(["🔍 From Existing Bug", "✏️ Manual Entry & Comparison"])

        with tabs[0]:
            bug_id = st.selectbox("Select Bug ID", options=sorted(df["bug_id"].tolist()))
            if bug_id:
                bug = df[df["bug_id"] == bug_id].iloc[0]
                actual = bug["severity"]
                with st.expander("Bug Details", expanded=False):
                    st.write(bug.drop(["bug_id", "data"], errors="ignore").to_dict())
                st.text_area("Summary", bug["summary"], height=120, disabled=True)

                if st.button("🔮 Predict Severity", use_container_width=True, type="primary"):
                    with st.spinner("Analyzing..."):
                        metadata = {col: bug.get(col, "N/A") for col in METADATA_COLS}
                        pred, probs, tokens = predict_severity(bug["summary"], metadata, model, vectorizer, encoders)
                        correct = str(actual).lower() == str(pred).lower()
                        color = "#2e8b57" if correct else "#dc143c"
                        st.markdown(
                            f"<h3 style='text-align:center;color:{color};'>Actual: <b>{str(actual).upper()}</b> | Predicted: <b>{str(pred).upper()}</b></h3>",
                            unsafe_allow_html=True,
                        )
                        fig = px.bar(
                            probs,
                            x="Severity",
                            y="Probability",
                            text="Probability",
                            color="Severity",
                            color_discrete_sequence=px.colors.qualitative.Bold,
                        )
                        fig.update_traces(texttemplate="%{text:.1%}")
                        st.plotly_chart(fig, use_container_width=True)

                        if tokens:
                            st.caption("Top influential terms from your summary (heuristic): " + ", ".join(tokens))

        with tabs[1]:
            left, right = st.columns([2, 1])
            with left:
                custom = st.text_area(
                    "Bug summary",
                    placeholder="e.g., Crash when opening PDF with special characters ...",
                    height=150,
                )
                # Optional metadata inputs
                with st.expander("Optional metadata", expanded=False):
                    mcols = st.columns(4)
                    meta_input = {}
                    for i, col in enumerate(METADATA_COLS):
                        with mcols[i % 4]:
                            meta_input[col] = st.text_input(col, value="")
                model_choice = st.selectbox(
                    "Model", ["Random Forest (default)", "SVM (N/A)", "XGBoost (N/A)", "Neural Net (N/A)"]
                )
                go = st.button("🔮 Analyze", type="primary", use_container_width=True)
            with right:
                st.info("Comparative probabilities are shown below. Non‑RF models are placeholders.")

            if go:
                if not custom.strip():
                    st.warning("Please enter a summary")
                else:
                    with st.spinner("Predicting..."):
                        use_meta = {k: v for k, v in meta_input.items() if v.strip()}
                        # Always run RF as before
                        pred_rf, probs_rf, tokens = predict_severity(custom, use_meta, model, vectorizer, encoders)
                        st.markdown(
                            f"<h3 style='text-align:center;color:#9370db;'>Predicted (RF): <b>{str(pred_rf).upper()}</b></h3>",
                            unsafe_allow_html=True,
                        )
                        fig = px.bar(
                            probs_rf,
                            x="Severity",
                            y="Probability",
                            text="Probability",
                            color="Severity",
                            color_discrete_sequence=px.colors.qualitative.Bold,
                            title="Random Forest Probabilities",
                        )
                        fig.update_traces(texttemplate="%{text:.1%}")
                        st.plotly_chart(fig, use_container_width=True)
                        if tokens:
                            st.caption("Top influential terms from your summary (heuristic): " + ", ".join(tokens))

                        # NEW: If user selected XGBoost in dropdown, also show XGB prediction
                        if "XGBoost" in model_choice:
                            if all([xgb_model, xgb_vectorizer, xgb_encoders]):
                                pred_xgb, probs_xgb, tokens_xgb = predict_severity_xgb(
                                    custom, use_meta, (xgb_model, xgb_vectorizer, xgb_encoders)
                                )
                                st.markdown(
                                    f"<h3 style='text-align:center;color:#1e90ff;'>Predicted (XGBoost): <b>{str(pred_xgb).upper()}</b></h3>",
                                    unsafe_allow_html=True,
                                )
                                fig_x = px.bar(
                                    probs_xgb,
                                    x="Severity",
                                    y="Probability",
                                    text="Probability",
                                    color="Severity",
                                    color_discrete_sequence=px.colors.qualitative.Bold,
                                    title="XGBoost Probabilities",
                                )
                                fig_x.update_traces(texttemplate="%{text:.1%}")
                                st.plotly_chart(fig_x, use_container_width=True)
                            else:
                                st.info("XGBoost artifacts not found. Train and export xgb_model.pkl, tfidf_vectorizer_xgb.pkl, label_encoders_xgb.pkl, xgb_metrics.json.")

    # ---------------- Model Evaluation ----------------
    elif page == "Model Evaluation":
        st.header("📈 Model Performance Dashboard")

        if not metrics:
            st.warning("No metrics available")
            st.stop()

        # KPIs (RF)
        kpi_row(metrics, df)

        # Confusion matrix (RF)
        cm_data = metrics["confusion_matrix"]

        # Remove less relevant labels
        remove_labels = {"blocker", "critical", "enhancement", "major", "minor", "trivial"}
        cm_labels = [lbl for lbl in cm_data["labels"] if lbl not in remove_labels]

        # Convert to DataFrame for filtering
        cm_df = pd.DataFrame(cm_data["matrix"], index=cm_data["labels"], columns=cm_data["labels"])
        cm_df = cm_df.loc[cm_labels, cm_labels]

        # Build enhanced heatmap
        fig_cm = px.imshow(
            cm_df,
            x=cm_labels,
            y=cm_labels,
            text_auto=True,
            color_continuous_scale=[
                [0.0, "#f0f0f0"],  # light base
                [0.3, "#c6b4ff"],  # mid tone
                [0.6, "#7e57c2"],  # strong purple
                [1.0, "#4a148c"],  # deep violet for diagonal
            ],
            title="Confusion Matrix (Filtered & Enhanced) — Random Forest",
        )

        fig_cm.update_traces(textfont_size=10)
        fig_cm.update_layout(
            xaxis_title="Predicted Label",
            yaxis_title="True Label",
            yaxis_autorange="reversed",
            coloraxis_showscale=True,
            height=600,
        )

        st.plotly_chart(fig_cm, use_container_width=True)

        # Classification report bars (RF)
        report_df = pd.DataFrame(metrics["classification_report"]).T
        for drop_key in ["accuracy", "macro avg", "weighted avg"]:
            if drop_key in report_df.index:
                report_df = report_df.drop(drop_key)
        melted = report_df.reset_index().rename(columns={"index": "label"})
        melted = melted.melt(id_vars="label", value_vars=["precision", "recall", "f1-score"], var_name="metric", value_name="value")
        fig_bar = px.bar(
            melted,
            x="label",
            y="value",
            color="metric",
            barmode="group",
            title="Precision / Recall / F1 by Severity — Random Forest"
        )

        # Map encoded numeric labels to actual severity text
        if "severity" in encoders:
            label_names = encoders["severity"].classes_.tolist()
            # Only update if x-axis contains numeric ticks
            fig_bar.update_xaxes(
                tickvals=list(range(len(label_names))),
                ticktext=label_names
            )

        st.plotly_chart(fig_bar, use_container_width=True)

        # Before/After distribution (proxy: dataset vs. test support)
        colA, colB = st.columns(2)
        with colA:
            dist_df = (
                df["severity"]
                .astype(str)
                .value_counts(normalize=True)
                .rename_axis("severity")
                .reset_index(name="ratio")
            )
            fig_dist = px.bar(dist_df, x="severity", y="ratio", title="Dataset Class Ratio")
            st.plotly_chart(fig_dist, use_container_width=True)
        with colB:
            rep = pd.DataFrame(metrics["classification_report"]).T
            if "support" in rep.columns:
                cls = rep.drop(index=[i for i in ["accuracy", "macro avg", "weighted avg"] if i in rep.index])
                tot = cls["support"].sum() or 1
                support_ratio = (cls["support"] / tot).rename("ratio").reset_index().rename(columns={"index": "severity"})
                fig_sup = px.bar(support_ratio, x="severity", y="ratio", title="Test Support Ratio (Proxy) — RF")
                st.plotly_chart(fig_sup, use_container_width=True)

        # Feature importances (RF)
        feature_names = _build_feature_names(vectorizer, METADATA_COLS)
        importances = getattr(model, "feature_importances_", None)
        if importances is not None and len(importances):
            imp_series = pd.Series(importances, index=np.arange(len(importances)))
            top_n = min(25, len(imp_series))
            top_idx = imp_series.nlargest(top_n).index.tolist()
            top_labels = [feature_names[i] if i < len(feature_names) else f"feat_{i}" for i in top_idx]
            fi_df = pd.DataFrame({"Feature": top_labels, "Importance": imp_series.loc[top_idx].values}).sort_values("Importance")
            fig_imp = px.bar(fi_df, x="Importance", y="Feature", orientation="h", title="Top Feature Importances (RF)")
            st.plotly_chart(fig_imp, use_container_width=True)
        else:
            st.info("Feature importances unavailable for this model.")

        # ---- NEW: Optional XGBoost metrics and confusion matrix ----
        if xgb_metrics and isinstance(xgb_metrics, dict) and "confusion_matrix" in xgb_metrics:
            with st.expander("XGBoost: confusion matrix and per-class metrics", expanded=False):
                xcm = xgb_metrics["confusion_matrix"]
                x_labels = xcm.get("labels", [])
                x_mat = xcm.get("matrix", [])
                if x_labels and x_mat:
                    # filter labels as done for RF
                    x_labels_filtered = [lbl for lbl in x_labels if lbl not in {"blocker", "critical", "enhancement", "major", "minor", "trivial"}]
                    x_df = pd.DataFrame(x_mat, index=x_labels, columns=x_labels)
                    # keep intersection
                    x_df = x_df.loc[x_labels_filtered, x_labels_filtered]
                    fig_xcm = px.imshow(
                        x_df,
                        x=x_labels_filtered,
                        y=x_labels_filtered,
                        text_auto=True,
                        color_continuous_scale=[
                            [0.0, "#f0f0f0"],
                            [0.3, "#b2dfdb"],
                            [0.6, "#26a69a"],
                            [1.0, "#004d40"],
                        ],
                        title="Confusion Matrix — XGBoost",
                    )
                    fig_xcm.update_traces(textfont_size=10)
                    fig_xcm.update_layout(
                        xaxis_title="Predicted Label",
                        yaxis_title="True Label",
                        yaxis_autorange="reversed",
                        coloraxis_showscale=True,
                        height=600,
                    )
                    st.plotly_chart(fig_xcm, use_container_width=True)

                # per-class bars
                x_report = pd.DataFrame(xgb_metrics.get("classification_report", {})).T
                for drop_key in ["accuracy", "macro avg", "weighted avg"]:
                    if drop_key in x_report.index:
                        x_report = x_report.drop(drop_key)
                if not x_report.empty:
                    xm = x_report.reset_index().rename(columns={"index": "label"})
                    xm = xm.melt(id_vars="label", value_vars=["precision", "recall", "f1-score"], var_name="metric", value_name="value")
                    fig_xbar = px.bar(
                        xm, x="label", y="value", color="metric", barmode="group",
                        title="Precision / Recall / F1 by Severity — XGBoost"
                    )
                    # map label names if needed (when numeric)
                    if xgb_encoders and "severity" in xgb_encoders:
                        x_names = xgb_encoders["severity"].classes_.tolist()
                        fig_xbar.update_xaxes(tickvals=list(range(len(x_names))), ticktext=x_names)
                    st.plotly_chart(fig_xbar, use_container_width=True)

        # ---- NEW: Model comparison table with real XGB stats if available ----
        st.subheader("Model Comparison")
        comp_rows = [
            {
                "Model": "Random Forest",
                "Accuracy": metrics.get("accuracy", np.nan),
                "Macro F1": metrics.get("macro_f1", np.nan),
                "Weighted F1": metrics.get("weighted_f1", np.nan),
            }
        ]
        if xgb_metrics:
            comp_rows.append({
                "Model": "XGBoost",
                "Accuracy": xgb_metrics.get("accuracy", np.nan),
                "Macro F1": xgb_metrics.get("macro_f1", np.nan),
                "Weighted F1": xgb_metrics.get("weighted_f1", np.nan),
            })
        else:
            comp_rows.append({"Model": "XGBoost", "Accuracy": np.nan, "Macro F1": np.nan, "Weighted F1": np.nan})
        # Preserve placeholders for others
        comp_rows += [
            {"Model": "SVM", "Accuracy": np.nan, "Macro F1": np.nan, "Weighted F1": np.nan},
            {"Model": "Neural Net", "Accuracy": np.nan, "Macro F1": np.nan, "Weighted F1": np.nan},
        ]
        comp = pd.DataFrame(comp_rows)
        st.dataframe(comp, use_container_width=True, height=200)

        st.caption("Macro F1 reflects balance across classes. Weighted F1 weights classes by support.")

    # ---------------- Logout ----------------
    elif page == "Logout":
        for key in list(st.session_state.keys()):
            del st.session_state[key]
        st.success("Logged out successfully")
        st.write("Return to the login page from the sidebar or refresh the app.")


# -----------------------------
# ROUTING
# -----------------------------
if not st.session_state.authenticated:
    login_page()
else:
    main_app()
