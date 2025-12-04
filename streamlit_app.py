import os, json, joblib, psycopg2, numpy as np, pandas as pd, bcrypt
import streamlit as st, plotly.express as px
from datetime import datetime
from pandas.tseries.offsets import MonthEnd


def _to_title_case(text):
    if not isinstance(text, str) or not text: return text
    parts = text.split();
    if not parts: return text
    result = parts[0][0].upper() + parts[0][1:].lower()
    for part in parts[1:]:
        if part in ["S1", "S2", "S3", "S4", "S1/S2"]:
            result += " " + part
        else:
            result += " " + part.lower()
    return result


st.set_page_config(page_title="Bug prioritization", layout="wide")
DB = {"dbname": "bugbug_data", "user": "postgres", "password": "2331", "host": "localhost", "port": "5432"}
ART_RF = {"model": "rf_model.pkl", "vec": "tfidf_vectorizer.pkl", "enc": "label_encoders.pkl", "met": "rf_metrics.json"}
META = ["component", "product", "priority", "platform", "op_sys", "type", "resolution", "status"]
FLAGS = ["has_crash", "is_accessibility", "is_regression", "is_intermittent", "has_patch"]
TOP_SEV = ["S1", "S2", "S3", "S4"]
CATEGORY_TABLE = {
    "Networking & Security": ["network", "connect", "ssl", "tls", "certificate", "security", "vulnerability", "auth",
                              "breach"],
    "Performance & Resource Management": ["slow", "lag", "freeze", "hang", "resource", "memory", "cpu", "performance"],
    "UI/UX & Accessibility": ["ui", "interface", "button", "navigation", "layout", "ux", "accessibility", "a11y"],
    "Compatibility & Web Standards": ["compat", "standard", "render", "html", "css", "js", "cross-platform"],
    "Privacy & User Data": ["privacy", "data", "tracking", "storage", "personal"],
    "Media, Extensions, & Plugins": ["audio", "video", "media", "extension", "plugin"],
    "Installation, Updates, & User Preferences": ["install", "update", "patch", "preference", "settings"],
    "Developer Tools & Debugging": ["devtools", "debug", "javascript", "console", "inspector"],
    "File Handling & System Interaction": ["file", "download", "upload", "filesystem"],
    "Session Management & Synchronization": ["session", "sync", "account", "login", "state"]}
COMPONENT_CATEGORY_MAP = {"Networking": "Networking & Security", "Necko": "Networking & Security",
                          "Security: PSM": "Networking & Security", "Performance": "Performance & Resource Management",
                          "DOM: Performance": "Performance & Resource Management",
                          "JavaScript Engine": "Performance & Resource Management",
                          "UI Widgets": "UI/UX & Accessibility", "Theme": "UI/UX & Accessibility",
                          "Accessibility": "UI/UX & Accessibility", "Layout": "Compatibility & Web Standards",
                          "DOM": "Compatibility & Web Standards", "CSS Parsing": "Compatibility & Web Standards",
                          "Storage": "Privacy & User Data", "Permissions": "Privacy & User Data",
                          "Audio/Video": "Media, Extensions, & Plugins", "WebRTC": "Media, Extensions, & Plugins",
                          "Add-ons Manager": "Media, Extensions, & Plugins",
                          "Installer": "Installation, Updates, & User Preferences",
                          "Application Update": "Installation, Updates, & User Preferences",
                          "DevTools": "Developer Tools & Debugging", "Inspector": "Developer Tools & Debugging",
                          "Console": "Console: Developer Tools & Debuging",
                          "Download Manager": "File Handling & System Interaction",
                          "File Handling": "File Handling & System Interaction",
                          "Sync": "Session Management & Synchronization",
                          "Firefox Accounts": "Session Management & Synchronization"}

for k, v in {"authenticated": False, "username": None, "role": None,
             "pred_bug_id": None}.items(): st.session_state.setdefault(k, v)

st.markdown("""
<style>
body,.stApp{background:radial-gradient(circle at top left,#111827 0,#020617 40%,#000);color:#e5e7eb;}
section[data-testid="stSidebar"]{background:rgba(15,23,42,.95);border-right:1px solid rgba(148,163,184,.35);}
div[role="radiogroup"]>label>div:first-child{display:none!important;}
div[role="radiogroup"]>label{display:flex;align-items:center;gap:10px;border-radius:999px;padding:8px 14px;margin-bottom:6px;cursor:pointer;transition:.18s;background:transparent;color:#d1d5db;}
div[role="radiogroup"]>label:hover{background:rgba(59,130,246,.15);color:#fff;transform:translateX(4px);}
div[role="radiogroup"]>label:has(input:checked){background:linear-gradient(90deg,#3b82f6,#6366f1);color:#fff;box-shadow:0 8px 20px rgba(37,99,235,.4);}
.stTextInput>div>div>input,.stTextArea textarea{background:rgba(15,23,42,.9)!important;color:#e5e7eb!important;border-radius:.75rem!important;border:1px solid rgba(148,163,184,.5)!important;}
[data-testid="stMetricValue"]{font-size:1.3rem;}
div[data-testid="stTabs"] div[role="tablist"]{width:100%!important;display:flex!important;justify-content:center!important;align-items:center!important;}
div[data-testid="stTabs"] div[role="tab"]{margin:0 18px!important;padding-bottom:6px!important;}
</style>
""", unsafe_allow_html=True)


def sql(q, p=(), one=False):
    c = psycopg2.connect(**DB);
    cur = c.cursor();
    cur.execute(q, p)
    r = cur.fetchone() if one else (cur.fetchall() if q.strip().lower().startswith("select") else None);
    c.commit();
    c.close();
    return r


def user_exists(): return sql("SELECT COUNT(*) FROM users", one=True)[0] > 0


def create_user(u, p, r): sql("INSERT INTO users(username,password_hash,role)VALUES(%s,%s,%s)",
                              (u, bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode(), r))


def check_user(u, p):
    r = sql("SELECT password_hash,role FROM users WHERE username=%s", (u,), one=True)
    return (bcrypt.checkpw(p.encode(), r[0].encode()), r[1]) if r else (False, None)


@st.cache_data(show_spinner="Loading bugs")
def load_bugs(limit=5000):
    try:
        df = pd.read_sql(f"SELECT bug_id, data FROM bugs LIMIT {limit}", psycopg2.connect(**DB))
    except:
        return pd.DataFrame()

    def safe_parse(x):
        if isinstance(x, dict): return x
        if isinstance(x, str) and x.strip():
            try:
                return json.loads(x)
            except:
                return {}
        return {}

    df["raw"] = df["data"].apply(safe_parse)

    def g(raw, key):
        try:
            return raw.get(key, "n/a")
        except:
            return "n/a"

    cols = ["summary", "keywords"] + META + ["severity"]
    for c in cols: df[c] = df["raw"].apply(lambda r: g(r, c))
    df["assigned_to_email"] = df["raw"].apply(
        lambda r: r.get("assigned_to", "nobody@mozilla.org") if isinstance(r, dict) else "nobody@mozilla.org")

    def calc_days_open(created, changed):
        try:
            t1 = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
            t2 = datetime.fromisoformat(str(changed).replace("Z", "+00:00"))
            return (t2 - t1).days
        except:
            return 0

    df["days_open"] = df["raw"].apply(
        lambda r: calc_days_open(r.get("creation_time", ""), r.get("last_change_time", "")))
    df["creation_time"] = df["raw"].apply(lambda r: r.get("creation_time", None))
    df["creation_date"] = pd.to_datetime(df["creation_time"], errors='coerce').dt.date
    return df[["bug_id"] + cols + ["assigned_to_email", "raw", "days_open", "creation_date"]]


@st.cache_resource
def load_pack(s):
    try:
        return joblib.load(s["model"]), joblib.load(s["vec"]), joblib.load(s["enc"]), json.load(
            open(s["met"])) if os.path.exists(s["met"]) else {}
    except:
        return None, None, None, {}


def login_ui():
    st.markdown("<h2 style='text-align:center;margin-top:2rem;'>Bug prioritization login</h2>", unsafe_allow_html=True)
    tabs = st.tabs([_to_title_case("Login"), _to_title_case("Create user"), _to_title_case("Manage users"),
                    _to_title_case("Reset password")] if user_exists() else [_to_title_case("Initial setup")])
    if not user_exists():
        with tabs[0]:
            with st.columns([1, 1, 1])[1]:
                a = st.text_input(_to_title_case("Admin username"), key="setup_admin_u");
                b = st.text_input(_to_title_case("Admin password"), type="password", key="setup_admin_p")
                if st.button(_to_title_case("Create admin"), key="setup_admin_btn") and a and b: create_user(a, b,
                                                                                                             "admin"); st.rerun()
        return
    with tabs[0]:
        with st.columns([1, 1, 1])[1]:
            with st.form("login_f"):
                u = st.text_input(_to_title_case("Username"), key="login_u");
                p = st.text_input(_to_title_case("Password"), type="password", key="login_p")
                s = st.form_submit_button(_to_title_case("Login"))
            if s:
                ok, r = check_user(u, p)
                if ok:
                    st.session_state.authenticated = True;
                    st.session_state.username = u;
                    st.session_state.role = r;
                    st.rerun()
                else:
                    st.error(_to_title_case("Invalid credentials"))
    with tabs[1]:
        with st.columns([1, 1, 1])[1]:
            nu = st.text_input(_to_title_case("New username"), key="create_u");
            np = st.text_input(_to_title_case("New password"), type="password", key="create_p")
            nr = st.selectbox(_to_title_case("Role"), ["user", "admin"], key="create_r")
            if st.button(_to_title_case("Create user"), key="create_user_btn") and nu and np: create_user(nu, np,
                                                                                                          nr); st.success(
                _to_title_case("Created."))
    with tabs[2]:
        with st.columns([1, 1, 1])[1]:
            us = sql("SELECT username,role FROM users ORDER BY username")
            st.table(pd.DataFrame(us, columns=[_to_title_case("Username"), _to_title_case("Role")]))
            d = st.text_input(_to_title_case("Delete username"), key="delete_user_u")
            if st.button(_to_title_case("Delete user"), key="delete_user_btn") and d: sql(
                "DELETE FROM users WHERE username=%s", (d,)); st.rerun()
    with tabs[3]:
        with st.columns([1, 1, 1])[1]:
            ru = st.text_input(_to_title_case("Username"), key="reset_u");
            np = st.text_input(_to_title_case("New password"), type="password", key="reset_new_p")
            if st.button(_to_title_case("Reset password"), key="reset_btn") and ru and np: sql(
                "UPDATE users SET password_hash=%s WHERE username=%s",
                (bcrypt.hashpw(np.encode(), bcrypt.gensalt()).decode(), ru)); st.success(_to_title_case("Reset."))


def extract_flags(raw, kw):
    k = [str(x).lower() for x in kw] if isinstance(kw, list) else []
    return {"has_crash": int(raw.get("cf_crash_signature") not in [None, "", {}, []]),
            "is_accessibility": int("accessibility" in k), "is_regression": int("regression" in k),
            "is_intermittent": int("intermittent" in k), "has_patch": int("patch" in k or bool(raw.get("attachments")))}


def predict(sum, meta, m, v, e):
    if not all([m, v, e]): return "n/a", pd.DataFrame()
    xt = v.transform([sum]).toarray()
    xm = np.array([e[c].transform([meta[c]])[0] if meta[c] in e[c].classes_ else 0 for c in META]).reshape(1, -1)
    xf = np.array([[meta[f] for f in FLAGS]])
    pro = m.predict_proba(np.hstack([xm, xf, xt]))[0]
    lab = e["severity"].inverse_transform(np.arange(len(pro)))
    return lab[np.argmax(pro)], pd.DataFrame({"Severity": lab, "Probability": pro}).sort_values("Probability",
                                                                                                ascending=False)


def categorize_page():
    st.header(_to_title_case("Bug categorization"))
    df = load_bugs(8000)

    def normalize_keywords(x):
        if isinstance(x, list): return [str(i).lower().strip() for i in x if i and str(i).strip()]
        if isinstance(x, str) and x.strip(): return [x.lower().strip()]
        return []

    df["keywords"] = df["keywords"].apply(normalize_keywords)

    def tbl_kw(kw):
        if not isinstance(kw, list): return "Other"
        t = [x.lower() for x in kw]
        for c, keys in CATEGORY_TABLE.items():
            if any(k in x for k in keys for x in t): return c
        return "Other"

    def derive(comp, kw):
        return COMPONENT_CATEGORY_MAP.get(comp, tbl_kw(kw))

    df["category"] = df.apply(lambda r: derive(str(r["component"]), r["keywords"]), axis=1)

    with st.expander(_to_title_case("How categories are determined")):
        st.markdown(
            """
            Categories are derived using a two-step process:
            1.  **Component mapping:** The bug's primary component is mapped to a predefined general category (e.g., 'Networking' maps to 'Networking & Security').
            2.  **Keyword fallback:** If no direct component match exists, the bug's keywords are checked against a list of terms associated with each category.
            3.  Bugs that do not match either criteria are labeled as 'Other'.
            """)

    st.subheader(_to_title_case("Filters"))
    c1, c2 = st.columns(2)
    fc = c1.multiselect(_to_title_case("Category"), sorted(df["category"].unique()));
    comp = c2.multiselect(_to_title_case("Component"), sorted(df["component"].astype(str).unique()))

    f = df.copy()
    if fc: f = f[f["category"].isin(fc)]
    if comp: f = f[f["component"].astype(str).isin(comp)]

    st.subheader(_to_title_case("Category distribution"))
    cc = f["category"].value_counts().reset_index(name="count").rename(columns={"index": "category"})
    st.plotly_chart(px.bar(cc, x="category", y="count", color="category", height=500), use_container_width=True)

    st.subheader(_to_title_case("Severity per category"))
    sc = f.groupby(["category", "severity"]).size().reset_index(name="count")
    st.plotly_chart(
        px.bar(sc, x="category", y="count", color="severity", barmode="stack", category_orders={"severity": TOP_SEV},
               height=500), use_container_width=True)

    st.subheader(_to_title_case("Component distribution per category"))
    comp_cat = f.groupby(["component", "category"]).size().reset_index(name="count")
    comp_cat = comp_cat[comp_cat["component"] != "n/a"]
    if not comp_cat.empty:
        st.plotly_chart(
            px.bar(comp_cat.head(50), x="component", y="count", color="category", barmode="group", height=600),
            use_container_width=True)
    else:
        st.info(_to_title_case("No component data available."))

    st.subheader(_to_title_case(f"Bug list ({len(f):,} bugs)"))

    search_term = st.text_input(_to_title_case("Search current bug list (summary/component/keywords):"),
                                key="cat_search")

    f_display = f.copy()
    if search_term:
        ls = search_term.lower()
        f_display = f_display[f_display["summary"].str.lower().str.contains(ls, na=False) |
                              f_display["component"].astype(str).str.lower().str.contains(ls, na=False) |
                              f_display["keywords"].apply(
                                  lambda ks: isinstance(ks, list) and any(ls in str(k).lower() for k in ks))]

    st.dataframe(f_display[["bug_id", "summary", "category", "component", "severity", "keywords"]],
                 use_container_width=True, height=420)


def predict_page(df, rf):
    st.header(_to_title_case("Severity prediction"))
    df = df[df["resolution"].astype(str).str.lower().isin(["", "none", "n/a", "unconfirmed", "new", "---"])]
    m, v, e, _ = rf
    st.subheader(_to_title_case("Find a bug"))
    s = st.text_input(_to_title_case("Search (id, summary, keyword, component)"),
                      placeholder=_to_title_case("Search by id, summary text, keyword, component…"))
    r = df.copy()
    if s:
        ls = s.lower()
        r = df[df["bug_id"].astype(str).str.contains(s) | df["summary"].str.lower().str.contains(ls) | df[
            "component"].astype(str).str.lower().str.contains(ls) | df["keywords"].apply(
            lambda ks: isinstance(ks, list) and any(ls in str(k).lower() for k in ks))]
    r = r.head(50)
    opts = [""] + [f"{int(x.bug_id)} – {str(x.summary)[:80]}" for _, x in r.iterrows()]
    sel = st.selectbox(_to_title_case("Select a bug"), opts)
    if sel: st.session_state.pred_bug_id = int(sel.split(" – ")[0])
    row = df[df["bug_id"] == st.session_state.get("pred_bug_id")] if st.session_state.get("pred_bug_id") else None
    br = row.iloc[0] if row is not None and not row.empty else None

    st.subheader(_to_title_case("Bug summary"))
    st.caption(_to_title_case("The summary text is the most critical feature used by the model for prediction."))
    summary = st.text_area("**Summary**", br["summary"] if br is not None else "", height=130)

    meta = {mn: (br[mn] if br is not None else "") for mn in META}
    flags = extract_flags(br["raw"], br["keywords"]) if br is not None else {f: 0 for f in FLAGS}

    with st.expander(_to_title_case("Metadata")):
        cs = st.columns(4)
        for i, mn in enumerate(META): meta[mn] = cs[i % 4].text_input(mn, str(meta[mn]))
        fs = st.columns(5)
        for i, f in enumerate(FLAGS): flags[f] = 1 if fs[i].checkbox(f, value=bool(flags[f])) else 0

    if st.button(_to_title_case("Predict severity")):
        pr, dfp = predict(summary, {**meta, **flags}, m, v, e)
        confidence = dfp.iloc[0]["Probability"] * 100
        st.subheader(
            f"{_to_title_case('Prediction')}: **{pr}** ({_to_title_case('confidence')}: **{confidence:.2f}%**)")
        st.plotly_chart(px.bar(dfp, x="Severity", y="Probability", category_orders={"Severity": TOP_SEV}),
                        use_container_width=True)


def insights_page(df, rf):
    st.header(_to_title_case("Advanced insights: risk and process analysis"))
    df = df.copy();
    df = df[df["severity"].isin(TOP_SEV)]
    st.subheader(_to_title_case("Top-line statistics"))
    total = len(df);
    uniq_comp = df["component"].nunique();
    uniq_prod = df["product"].nunique()
    c1, c2, c3 = st.columns(3)
    c1.metric(_to_title_case("Total S1-S4 bugs"), f"{total:,}");
    c2.metric(_to_title_case("Unique components"), f"{uniq_comp:,}");
    c3.metric(_to_title_case("Unique products"), f"{uniq_prod:,}")

    st.subheader(_to_title_case("Risk hierarchy (product > component > severity)"))
    st.caption(_to_title_case(
        "This visualization shows how risk is distributed across products and their individual components. Click on a section to zoom."))
    ps_data = df.groupby(["product", "component", "severity"]).size().reset_index(name="count")
    fig_tree = px.treemap(ps_data, path=["product", "component", "severity"], values="count", color="severity",
                          color_discrete_sequence=px.colors.qualitative.Plotly,
                          title=_to_title_case("Hierarchical view of bug volume by product, component, and severity"),
                          height=600)
    st.plotly_chart(fig_tree, use_container_width=True)

    st.subheader(_to_title_case("Risk vs. effort matrix"))
    st.markdown(
        _to_title_case(
            "This matrix plots component risk against the average effort required to fix its bugs. Focus on the top-left area (high risk, lower effort) for immediate wins.")
    )

    comp_median_days = df.groupby("component")["days_open"].median().reset_index(name="median_days_open")

    if not comp_median_days.empty:
        heat = df.groupby(["component", "severity"]).size().reset_index(name="count")
        pivot = heat.pivot_table(values="count", index="component", columns="severity", fill_value=0)
        pivot = pivot.reindex(columns=TOP_SEV, fill_value=0)
        risk_weights = {"S1": 4, "S2": 3, "S3": 2, "S4": 1}
        pivot_risk = pivot.copy()
        for sev, weight in risk_weights.items():
            if sev in pivot_risk.columns: pivot_risk[sev] = pivot_risk[sev] * weight
        pivot_risk["risk_score"] = pivot_risk[list(risk_weights.keys())].sum(axis=1)
        pivot_risk["bug_volume"] = pivot[list(risk_weights.keys())].sum(axis=1)
        risk_df = pivot_risk.merge(comp_median_days, on="component", how="left")
        risk_df.columns = ["Component", "S1", "S2", "S3", "S4", "Risk Score", "Bug Volume", "Median Days Open"]

        fig_risk_matrix = px.scatter(
            risk_df.dropna(subset=["Median Days Open"]), x="Median Days Open", y="Risk Score", size="Bug Volume",
            color="Component", hover_name="Component", log_x=True,
            title=_to_title_case("Component risk vs. effort to fix (bubble size = total volume)"), height=600)
        fig_risk_matrix.update_layout(showlegend=False)
        st.plotly_chart(fig_risk_matrix, use_container_width=True)

    st.subheader(_to_title_case("Bug lifecycle flow (status to resolution)"))
    sr_data = df.groupby(["status", "resolution"]).size().reset_index(name="count")
    fig_sun = px.sunburst(sr_data, path=['status', 'resolution'], values='count',
                          title=_to_title_case('Bug flow from status to resolution'), height=600)
    st.plotly_chart(fig_sun, use_container_width=True)


def analytics(df):
    st.header(_to_title_case("Analytics"))
    TOP_SEV = ["S1", "S2", "S3", "S4"]
    df = df[df["severity"].isin(TOP_SEV)]

    if df.empty: st.warning(_to_title_case("No S1–S4 severity data.")); return

    product_options = sorted(df["product"].dropna().unique())
    selected_product = st.selectbox(_to_title_case("Global product filter:"), ["All products"] + product_options)
    df_filtered = df.copy()
    if selected_product != "All products": df_filtered = df[df["product"] == selected_product]
    if df_filtered.empty: st.warning(_to_title_case(f"No S1–S4 severity data for {selected_product}.")); return

    tab1, tab2, tab3 = st.tabs([_to_title_case("Distribution analysis"), _to_title_case("Relationship analysis"),
                                _to_title_case("Trend and keyword analysis")])

    with tab1:
        st.subheader(_to_title_case("Severity distribution"))
        sev = df_filtered["severity"].value_counts().reset_index(name="count").rename(columns={"index": "severity"})
        st.plotly_chart(px.pie(sev, names="severity", values="count", hole=.35), use_container_width=True)

        st.subheader(_to_title_case("Top components by volume"))
        tc = df_filtered["component"].astype(str).value_counts().reset_index(name="count").rename(
            columns={"index": "component"})
        st.plotly_chart(px.bar(tc.head(25), x="count", y="component", orientation="h", height=600),
                        use_container_width=True)

    with tab2:
        st.subheader(_to_title_case("Product × severity breakdown"))
        bp = df_filtered.groupby(["product", "severity"]).size().reset_index(name="count")
        st.plotly_chart(px.bar(bp, x="product", y="count", color="severity", barmode="group",
                               category_orders={"severity": TOP_SEV}), use_container_width=True)

        st.subheader(_to_title_case("Resolution × severity"))
        rs = df_filtered.groupby(["resolution", "severity"]).size().reset_index(name="count")
        st.plotly_chart(px.bar(rs, x="resolution", y="count", color="severity", barmode="group",
                               category_orders={"severity": TOP_SEV}), use_container_width=True)

        st.subheader(_to_title_case("Type × severity"))
        tp = df_filtered.groupby(["type", "severity"]).size().reset_index(name="count")
        st.plotly_chart(
            px.bar(tp, x="type", y="count", color="severity", barmode="group", category_orders={"severity": TOP_SEV}),
            use_container_width=True)

        st.subheader(_to_title_case("Normalized severity per product"))
        tot = bp.groupby("product")["count"].transform("sum");
        bp["pct"] = bp["count"] / tot
        st.plotly_chart(
            px.bar(bp, x="product", y="pct", color="severity", barmode="stack", category_orders={"severity": TOP_SEV}),
            use_container_width=True)

    with tab3:
        st.subheader(_to_title_case("Keyword frequency (top 30)"))
        kw = [];
        [kw.extend(row) for row in df_filtered["keywords"] if isinstance(row, list)]
        kw_df = pd.Series(kw).value_counts().reset_index().rename(columns={"index": "keyword", 0: "count"})
        if not kw_df.empty:
            st.plotly_chart(px.bar(kw_df.head(30), x="keyword", y="count", height=500), use_container_width=True)
        else:
            st.info(_to_title_case("No keywords available for analysis."))

        st.subheader(_to_title_case("Component × severity heatmap (all components)"))
        heat = df_filtered.groupby(["component", "severity"]).size().reset_index(name="count")
        pivot = heat.pivot_table(values="count", index="component", columns="severity", fill_value=0)
        if not pivot.empty:
            pivot = pivot.reindex(columns=TOP_SEV, fill_value=0)
            st.plotly_chart(px.imshow(pivot, aspect="auto", color_continuous_scale="Blues", height=800),
                            use_container_width=True)
        else:
            st.info(_to_title_case("Insufficient data to generate component × severity heatmap."))

        st.subheader(_to_title_case("S1/S2 volume control chart"))
        df_critical = df_filtered[df_filtered["severity"].isin(["S1", "S2"])].copy()
        df_critical["creation_date"] = pd.to_datetime(df_critical["creation_date"], errors='coerce')
        df_critical.dropna(subset=["creation_date"], inplace=True);
        df_critical["month_end"] = df_critical["creation_date"] + MonthEnd(0)
        monthly_volume = df_critical.groupby("month_end").size().reset_index(name="S1/S2 Bug Count")

        if len(monthly_volume) > 1:
            mean = monthly_volume["S1/S2 Bug Count"].mean();
            std = monthly_volume["S1/S2 Bug Count"].std()
            ucl = mean + 2 * std;
            lcl = max(0, mean - 2 * std)
            fig_control = px.line(monthly_volume, x="month_end", y="S1/S2 Bug Count",
                                  title=_to_title_case("Monthly S1/S2 bug volume trend (with control limits)"))
            fig_control.add_hline(y=mean, line_dash="dash", annotation_text=_to_title_case("Average volume"))
            fig_control.add_hline(y=ucl, line_dash="dot", line_color="red",
                                  annotation_text=_to_title_case("Upper control limit"))
            fig_control.add_hline(y=lcl, line_dash="dot", line_color="red",
                                  annotation_text=_to_title_case("Lower control limit"))
            fig_control.update_traces(mode='lines+markers')
            st.plotly_chart(fig_control, use_container_width=True)
            st.caption(_to_title_case(
                "This chart helps identify when the volume of critical bugs (S1/S2) deviates significantly (outside the control limits) from the historical average, signaling a potential process shift."))
        else:
            st.info(_to_title_case("Not enough historical data to generate a meaningful trend chart."))


def home(df, m):
    st.title(_to_title_case("Bug prioritization and risk analysis platform"))
    st.markdown(_to_title_case(
        "Goal: analyze, categorize, and predict bug severity to prioritize critical S1-S4 issues using machine learning models."))
    with st.expander(_to_title_case("Platform details")):
        st.markdown(
            """
            This platform provides a unified interface for exploring, analyzing, and predicting bug severity across large-scale software projects. 
            Use the interactive dashboard below to filter data by key categories, and navigate the sidebar for deep-dive analysis, categorization, and model-powered severity prediction.
            """
        )

    df_filtered = df[df["severity"].isin(TOP_SEV)];
    total_bugs = len(df[df["severity"].isin(TOP_SEV)])

    col_prod, col_sev = st.columns([1, 1])
    products = col_prod.multiselect(_to_title_case("Filter by product"),
                                    sorted(df_filtered["product"].dropna().unique()),
                                    default=df_filtered["product"].dropna().unique())
    severities = col_sev.multiselect(_to_title_case("Filter by severity"), TOP_SEV, default=TOP_SEV)

    if products: df_filtered = df_filtered[df_filtered["product"].isin(products)]
    if severities: df_filtered = df_filtered[df_filtered["severity"].isin(severities)]

    t = len(df_filtered)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric(_to_title_case("Bugs in selection"), f"{t:,}");
    c2.metric(_to_title_case("Total S1-S4 bugs"), f"{total_bugs:,}")
    c3.metric(_to_title_case("Ml accuracy (model-wide)"), f"{m.get('accuracy', 0) * 100:.2f}%");
    c4.metric(_to_title_case("Ml macro f1 (model-wide)"), f"{m.get('macro_f1', 0) * 100:.2f}%")

    st.markdown(f"**Displaying {t:,} out of {total_bugs:,} total S1-S4 bugs.**")

    st.subheader(_to_title_case("Filtered distribution"))
    sev_data = df_filtered["severity"].value_counts().reindex(TOP_SEV, fill_value=0).reset_index(name="count").rename(
        columns={"index": "severity"})

    c_pie, c_bar = st.columns(2)
    if not sev_data.empty and sev_data["count"].sum() > 0:
        fig_pie = px.pie(sev_data, names="severity", values="count", hole=.4,
                         title=_to_title_case("Severity distribution in selection"),
                         category_orders={"severity": TOP_SEV}, height=500)
        c_pie.plotly_chart(fig_pie, use_container_width=True)

        fig_stacked = px.bar(sev_data, x="severity", y="count", color="severity",
                             category_orders={"severity": TOP_SEV}, title=_to_title_case("Severity counts stacked"),
                             height=500)
        c_bar.plotly_chart(fig_stacked, use_container_width=True)

    tc = df_filtered["component"].astype(str).value_counts().reset_index(name="count").rename(
        columns={"index": "component"})
    if not tc.empty:
        st.plotly_chart(
            px.bar(tc.head(10), x="count", y="component", orientation="h",
                   title=_to_title_case("Top 10 components in selection"),
                   height=500), use_container_width=True)


def explorer(df):
    st.header(_to_title_case("Bug data explorer"))
    df = load_bugs(st.slider(_to_title_case("Max bugs to load"), 200, 10000, 3000, 400))
    if df.empty: st.warning(_to_title_case("No bugs loaded.")); return
    df = df[df["severity"].isin(TOP_SEV)]

    st.caption(_to_title_case("Filtering results using **and** logic across all criteria."))

    with st.expander(_to_title_case("Filters"), expanded=True):
        c1, c2, c3, c4 = st.columns(4);
        s = c1.multiselect(_to_title_case("Severity"), TOP_SEV)
        p = c2.multiselect(_to_title_case("Product"), sorted(df["product"].dropna().unique()));
        t = c3.multiselect(_to_title_case("Type"), sorted(df["type"].dropna().unique()))
        r = c4.multiselect(_to_title_case("Resolution"), sorted(df["resolution"].dropna().unique()));
        c5, c6 = st.columns(2)
        stt = c5.multiselect(_to_title_case("Status"), sorted(df["status"].dropna().unique()))
        kw_input = c6.text_input(_to_title_case("Filter by keywords (comma-separated)"),
                                 placeholder=_to_title_case("E.g., security, crash, ui"))
        kw_summary = st.text_input(_to_title_case("Search in summary"))

    f = df.copy()
    if s: f = f[f["severity"].isin(s)]
    if p: f = f[f["product"].isin(p)]
    if t: f = f[f["type"].isin(t)]
    if r: f = f[f["resolution"].isin(r)]
    if stt: f = f[f["status"].isin(stt)]

    if kw_input:
        keywords_to_filter = [k.strip().lower() for k in kw_input.split(',') if k.strip()]
        if keywords_to_filter:
            f = f[f["keywords"].apply(
                lambda ks: isinstance(ks, list) and any(k.lower() in str(ks) for k in keywords_to_filter))]

    if kw_summary: f = f[f["summary"].str.contains(kw_summary, case=False, na=False)]

    st.info(_to_title_case(f"{len(f):,} bugs"));
    display_cols = [c for c in f.columns if c not in ["raw", "assigned_to_email", "creation_date", "creation_time"]]

    def highlight_severity(s):
        return ['background-color: #721c24; color: white' if v == 'S1' else '' for v in s]

    styled_df = f[display_cols].style.apply(highlight_severity, subset=["severity"])
    st.dataframe(styled_df, use_container_width=True, height=460)

    today = datetime.now().strftime("%Y%m%d");
    csv_filename = f"bug_export_{today}.csv"
    st.download_button(_to_title_case("Download csv"), f[display_cols].to_csv(index=False), csv_filename, "text/csv")


def eval_page(df, rf):
    st.header(_to_title_case("Model evaluation: deep dive performance"))
    _, _, _, m = rf
    if not m: st.warning(_to_title_case("No metrics file loaded.")); return

    t = len(df);
    c = df[df["severity"].str.lower() == "critical"]
    pcm = m.get("per_class") or m.get("class_metrics") or {}
    avg_precision = np.mean([v.get('precision', 0) for v in pcm.values() if isinstance(v, dict) and 'precision' in v])
    avg_recall = np.mean([v.get('recall', 0) for v in pcm.values() if isinstance(v, dict) and 'recall' in v])

    st.subheader(_to_title_case("Overall performance summary"))
    c1, c2, c3, c4, c5, c6 = st.columns(6)
    c1.metric(_to_title_case("Total bugs (df)"), f"{t:,}");
    c2.metric(_to_title_case("Accuracy"), f"{m.get('accuracy', 0) * 100:.2f}%")
    c3.metric(_to_title_case("Macro f1"), f"{m.get('macro_f1', 0) * 100:.2f}%")

    with st.expander(_to_title_case("Metric definitions")):
        st.markdown(
            """
            * **Accuracy:** The overall percentage of bug predictions that were correct.
            * **Macro f1:** The average F1 score across all severity levels. This is a robust performance measure when class sizes are unequal.
            * **Precision:** When the model predicts a severity level, how often is it right?
            * **Recall:** Out of all bugs that *actually* have a certain severity, how many did the model successfully identify?
            """)

    c4.metric(_to_title_case("Critical bugs (df)"), f"{len(c):,}");
    c5.metric(_to_title_case("Avg precision"), f"{avg_precision * 100:.2f}%" if pcm else "N/A")
    c6.metric(_to_title_case("Avg recall"), f"{avg_recall * 100:.2f}%" if pcm else "N/A")

    st.subheader(_to_title_case("Confusion matrix: true vs. predicted"))
    cm = m.get("confusion_matrix")
    if cm:
        lab, mat = cm.get("labels", []), cm.get("matrix", [])
        keep = [x for x in TOP_SEV + ["normal"] if x in lab]
        try:
            cm_df = pd.DataFrame(mat, index=lab, columns=lab).loc[keep, keep]
            fig = px.imshow(cm_df, text_auto=True, color_continuous_scale="Blues", aspect="equal",
                            title=_to_title_case("True vs. predicted class counts"), height=700)
            fig.update_layout(xaxis_title=_to_title_case("Predicted"), yaxis_title=_to_title_case("True"),
                              margin=dict(l=60, r=60, t=60, b=60),
                              paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='white', coloraxis_showscale=True)
            fig.update_xaxes(constrain="domain");
            fig.update_yaxes(scaleanchor="x")
            st.plotly_chart(fig, use_container_width=False)
            st.caption(_to_title_case(
                "Reading guide: correct predictions are located along the diagonal. Cells off the diagonal indicate misclassification error."))
        except Exception as e:
            st.error(_to_title_case(f"Unable to render confusion matrix: {e}"))
    else:
        st.warning(_to_title_case("No confusion matrix available in metrics file."))

    st.subheader(_to_title_case("Model and dataset information"))
    info = {"Model type": "Random forest classifier", "Accuracy": f"{m.get('accuracy', 0) * 100:.2f}%",
            "Macro f1 score": f"{m.get('macro_f1', 0) * 100:.2f}%",
            "Training size": f"{m.get('train_size', 0):,} samples", "Test size": f"{m.get('test_size', 0):,} samples",
            "Classes": m.get('classes', "N/A")}
    st.table(pd.DataFrame(list(info.items()), columns=[_to_title_case("Metric"), _to_title_case("Value")]))

    st.subheader(_to_title_case("Feature importance analysis (top 20)"))
    rf_model, vec, enc, _ = load_pack(ART_RF)

    if rf_model is not None and hasattr(rf_model, "feature_importances_"):
        fi = np.array(rf_model.feature_importances_)
        meta_flag_names = [f"meta:{c}" for c in META] + [f"flag:{f}" for f in FLAGS]
        tfidf_names = list(vec.get_feature_names_out()) if hasattr(vec, "get_feature_names_out") else []
        all_feature_names = meta_flag_names + tfidf_names

        if len(fi) == len(all_feature_names):
            feature_importance_df = pd.DataFrame({"Feature": all_feature_names, "Importance": fi})
            top_features = feature_importance_df.sort_values("Importance", ascending=False).head(20)

            fig_feat = px.bar(top_features, x="Importance", y="Feature", orientation="h",
                              title=_to_title_case("Top 20 features by random forest importance"), color="Importance",
                              color_continuous_scale=px.colors.sequential.Plasma, height=600)
            fig_feat.update_yaxes(autorange="reversed")
            st.plotly_chart(fig_feat, use_container_width=True)

            st.markdown("##### " + _to_title_case("Feature importance table (top 10)"))
            st.table(top_features.head(10))
        else:
            st.info(_to_title_case(
                f"Feature importance array length mismatch. Expected {len(all_feature_names)}, got {len(fi)}. Check model training consistency."))
    else:
        st.info(_to_title_case("No feature importance data available or model not loaded correctly."))


def resolution_schedule_page(df):
    st.header(_to_title_case("Resolution schedule by days open"))
    df = df.copy()
    if "severity" in df.columns: df["severity"] = df["severity"].astype(str).str.strip().str.upper()
    if "raw" in df.columns:
        df["creation_time"] = df["raw"].apply(lambda x: x.get("creation_time", "n/a") if isinstance(x, dict) else "n/a")
        df["last_change_time"] = df["raw"].apply(
            lambda x: x.get("last_change_time", "n/a") if isinstance(x, dict) else "n/a")
        df["id"] = df["bug_id"] if "bug_id" in df.columns else df["raw"].apply(
            lambda x: x.get("id", 0) if isinstance(x, dict) else 0)
    if "days_open" not in df.columns: st.error(_to_title_case("'days_open' column is missing.")); return

    st.subheader(_to_title_case("Filter settings"))
    c_filt1, c_filt2 = st.columns(2);
    c_filt3, c_filt4 = st.columns(2)

    min_days_open = c_filt1.number_input(_to_title_case("Show bugs open at least this many days:"), min_value=0,
                                         value=0, step=1)
    severity_list = sorted(df["severity"].dropna().unique().tolist())
    selected_sev = c_filt2.multiselect(_to_title_case("Filter by severity:"), options=severity_list,
                                       default=severity_list)

    component_list = sorted(df["component"].astype(str).dropna().unique().tolist())
    selected_comp = c_filt3.multiselect(_to_title_case("Filter by component:"),
                                        options=["All components"] + component_list, default="All components")
    if "All components" in selected_comp: selected_comp = component_list

    resolution_list = sorted(df["resolution"].astype(str).dropna().unique().tolist())
    selected_res = c_filt4.multiselect(_to_title_case("Filter by resolution type:"),
                                       options=["All resolutions"] + resolution_list, default="All resolutions")
    if "All resolutions" in selected_res: selected_res = resolution_list

    df_filtered = df[df["days_open"] >= min_days_open]
    if selected_sev: df_filtered = df_filtered[df_filtered["severity"].isin(selected_sev)]
    if selected_comp: df_filtered = df_filtered[df_filtered["component"].astype(str).isin(selected_comp)]
    if selected_res: df_filtered = df_filtered[df_filtered["resolution"].astype(str).isin(selected_res)]

    if df_filtered.empty: st.warning(_to_title_case("No bugs match the selected filter conditions.")); return

    TOP_SEV = ["S1", "S2", "S3", "S4"];
    df_rel = df_filtered[df_filtered["severity"].isin(TOP_SEV)]

    st.subheader(_to_title_case("Severity vs. resolution time"))

    if not df_rel.empty:
        c_median, c_hist = st.columns(2)
        median_days = df_rel.groupby("severity")["days_open"].median().reset_index(name="Median Days Open")
        median_days = median_days.sort_values("severity", key=lambda x: x.map({s: i for i, s in enumerate(TOP_SEV)}),
                                              ascending=True)

        fig_median = px.bar(median_days, x="severity", y="Median Days Open", category_orders={"severity": TOP_SEV},
                            title=_to_title_case("Median days open by severity (simpler view)"), height=450)
        c_median.plotly_chart(fig_median, use_container_width=True)

        fig_hist = px.histogram(df_rel, x="days_open", nbins=20,
                                title=_to_title_case("Distribution of bug resolution time (days)"), height=450)
        fig_hist.update_xaxes(title=_to_title_case("Days open"))
        c_hist.plotly_chart(fig_hist, use_container_width=True)

    st.subheader(_to_title_case("Component resolution performance"))
    st.caption(_to_title_case("Investigate which components typically take the longest to resolve issues."))

    comp_metrics = df_rel.groupby("component")["days_open"].agg(["count", "median"]).reset_index()
    comp_metrics = comp_metrics[comp_metrics["count"] >= 5].sort_values("median", ascending=False).head(10)

    if not comp_metrics.empty:
        comp_metrics.rename(columns={"median": "Median Days Open", "count": "Bug Count"}, inplace=True)
        fig_comp = px.bar(comp_metrics, x="Median Days Open", y="component", orientation="h",
                          title=_to_title_case("Top 10 components by median days open (min 5 bugs)"),
                          color="Median Days Open", color_continuous_scale="Viridis", height=500)
        st.plotly_chart(fig_comp, use_container_width=True)
    else:
        st.info(_to_title_case("Not enough data to rank components based on resolution time."))

    stats = (df_rel.groupby("severity")["days_open"].agg(["count", "mean", "median", "max", "min"]).reindex(
        TOP_SEV).reset_index())
    stats.rename(columns={"count": _to_title_case("Bug count"), "mean": _to_title_case("Average days open"),
                          "median": _to_title_case("Median days open"), "max": _to_title_case("Max days open"),
                          "min": _to_title_case("Min days open")}, inplace=True)

    st.subheader(_to_title_case("Severity ↔ days open relationship summary"))

    def highlight_median(s):
        is_median = s.name == "Median days open"
        return [f'font-weight: bold; background-color: rgba(59,130,246,.15)' if is_median else '' for v in s]

    styled_stats = stats.style.apply(highlight_median, axis=0)
    st.dataframe(styled_stats, use_container_width=True)

    df_sorted = df_filtered.sort_values("days_open", ascending=False)

    st.subheader(_to_title_case("Top 10 longest-open backlogs per severity"))
    st.caption(
        _to_title_case("These are the longest-open bugs and represent the highest priority targets for resolution."))

    for sev in TOP_SEV:
        subset = df_rel[df_rel["severity"] == sev].head(10)
        if not subset.empty:
            st.markdown(f"**{sev}**")
            st.dataframe(subset[["id", "days_open", "summary"]], hide_index=True)

    display_cols = [c for c in
                    ["id", "days_open", "creation_time", "last_change_time", "severity", "summary", "component",
                     "resolution"] if c in df_sorted.columns]

    st.subheader(_to_title_case(f"All filtered bugs ({len(df_sorted):,}) sorted by days open"))
    st.dataframe(df_sorted[display_cols], use_container_width=True, height=450)


def main():
    df = load_bugs(5000);
    rf = load_pack(ART_RF);
    _, _, _, met = rf
    if st.session_state.username: st.sidebar.caption(
        f"Signed in as **{st.session_state.username}** ({st.session_state.role})")
    page = st.sidebar.radio("",
                            [_to_title_case("Home"), _to_title_case("Bug data explorer"), _to_title_case("Analytics"),
                             _to_title_case("Categorization"), _to_title_case("Advanced insights"),
                             _to_title_case("Severity prediction"), _to_title_case("Model evaluation"),
                             _to_title_case("Resolution schedule"), _to_title_case("Logout")])
    if page == _to_title_case("Home"):
        home(df, met)
    elif page == _to_title_case("Bug data explorer"):
        explorer(df)
    elif page == _to_title_case("Analytics"):
        analytics(df)
    elif page == _to_title_case("Categorization"):
        categorize_page()
    elif page == _to_title_case("Advanced insights"):
        insights_page(df, rf)
    elif page == _to_title_case("Severity prediction"):
        predict_page(df, rf)
    elif page == _to_title_case("Model evaluation"):
        eval_page(df, rf)
    elif page == _to_title_case("Resolution schedule"):
        resolution_schedule_page(df)
    elif page == _to_title_case("Logout"):
        for k in list(st.session_state.keys()): del st.session_state[k]
        st.session_state.authenticated = False;
        st.rerun()


_ = main() if st.session_state.authenticated else login_ui()