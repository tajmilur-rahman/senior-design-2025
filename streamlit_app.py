import os, json, joblib, psycopg2, numpy as np, pandas as pd, bcrypt
# Koshi mail
import imaplib, email
import streamlit as st, plotly.express as px, plotly.graph_objects as go
from matplotlib import pyplot as plt




# --- config / constants
st.set_page_config(page_title="Bug prioritization", layout="wide")
DB = {"dbname": "bugbug_data", "user": "postgres", "password": "1234", "host": "localhost", "port": "5432"}
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
 "Session Management & Synchronization": ["session", "sync", "account", "login", "state"], }
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
                       "Console": "Console: Developer Tools & Debugging",
                       "Download Manager": "File Handling & System Interaction",
                       "File Handling": "File Handling & System Interaction",
                       "Sync": "Session Management & Synchronization",
                       "Firefox Accounts": "Session Management & Synchronization", }




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
      df = pd.read_sql(
          f"SELECT bug_id, data FROM bugs LIMIT {limit}",
          psycopg2.connect(**DB)
      )
  except:
      return pd.DataFrame()




  # --- safe JSON parse ---
  def safe_parse(x):
      if isinstance(x, dict):
          return x
      if isinstance(x, str) and x.strip():
          try:
              return json.loads(x)
          except:
              return {}
      return {}




  df["raw"] = df["data"].apply(safe_parse)




  # ---- safe getter for fields ----
  def g(raw, key):
      try:
          return raw.get(key, "N/A")
      except:
          return "N/A"




  cols = ["summary", "keywords"] + META + ["severity"]
  for c in cols:
      df[c] = df["raw"].apply(lambda r: g(r, c))




  # --- assigned_to fallback ---
  df["assigned_to_email"] = df["raw"].apply(
      lambda r: r.get("assigned_to", "nobody@mozilla.org")
      if isinstance(r, dict) else "nobody@mozilla.org"
  )




  # --- calculate days open safely ---
  from datetime import datetime




  def calc_days_open(created, changed):
      try:
          t1 = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
          t2 = datetime.fromisoformat(str(changed).replace("Z", "+00:00"))
          return (t2 - t1).days
      except:
          return 0




  df["days_open"] = df["raw"].apply(
      lambda r: calc_days_open(
          r.get("creation_time", ""),
          r.get("last_change_time", "")
      )
  )




  return df[["bug_id"] + cols + ["assigned_to_email", "raw", "days_open"]]












@st.cache_resource
def load_pack(s):
 try:
     return joblib.load(s["model"]), joblib.load(s["vec"]), joblib.load(s["enc"]), json.load(
         open(s["met"])) if os.path.exists(s["met"]) else {}
 except:
     return None, None, None, {}








def login_ui():
 st.markdown("<h2 style='text-align:center;margin-top:2rem;'>Bug Prioritization Login</h2>", unsafe_allow_html=True)
 tabs = st.tabs(["Login", "Create User", "Manage Users", "Reset Password"] if user_exists() else ["Initial Setup"])
 if not user_exists():
     with tabs[0]:
         with st.columns([1, 1, 1])[1]:
             a = st.text_input("Admin Username", key="setup_admin_u");
             b = st.text_input("Admin Password", type="password", key="setup_admin_p")
             if st.button("Create Admin", key="setup_admin_btn") and a and b: create_user(a, b, "admin"); st.rerun()
     return
 with tabs[0]:
     with st.columns([1, 1, 1])[1]:
         with st.form("login_f"):
             u = st.text_input("Username", key="login_u");
             p = st.text_input("Password", type="password", key="login_p")
             s = st.form_submit_button("Login")
         if s:
             ok, r = check_user(u, p)
             if ok:
                 st.session_state.authenticated = True;
                 st.session_state.username = u;
                 st.session_state.role = r;
                 st.rerun()
             else:
                 st.error("Invalid credentials")
 with tabs[1]:
     with st.columns([1, 1, 1])[1]:
         nu = st.text_input("New Username", key="create_u");
         np = st.text_input("New Password", type="password", key="create_p")
         nr = st.selectbox("Role", ["user", "admin"], key="create_r")
         if st.button("Create User", key="create_user_btn") and nu and np: create_user(nu, np, nr); st.success(
             "Created.")
 with tabs[2]:
     with st.columns([1, 1, 1])[1]:
         us = sql("SELECT username,role FROM users ORDER BY username")
         st.table(pd.DataFrame(us, columns=["Username", "Role"]))
         d = st.text_input("Delete Username", key="delete_user_u")
         if st.button("Delete User", key="delete_user_btn") and d: sql("DELETE FROM users WHERE username=%s",
                                                                       (d,)); st.rerun()
 with tabs[3]:
     with st.columns([1, 1, 1])[1]:
         ru = st.text_input("Username", key="reset_u");
         np = st.text_input("New Password", type="password", key="reset_new_p")
         if st.button("Reset Password", key="reset_btn") and ru and np: sql(
             "UPDATE users SET password_hash=%s WHERE username=%s",
             (bcrypt.hashpw(np.encode(), bcrypt.gensalt()).decode(), ru)); st.success("Reset.")








def extract_flags(raw, kw):
 k = [str(x).lower() for x in kw] if isinstance(kw, list) else []
 return {"has_crash": int(raw.get("cf_crash_signature") not in [None, "", {}, []]),
         "is_accessibility": int("accessibility" in k), "is_regression": int("regression" in k),
         "is_intermittent": int("intermittent" in k), "has_patch": int("patch" in k or bool(raw.get("attachments")))}








def predict(sum, meta, m, v, e):
 if not all([m, v, e]): return "N/A", pd.DataFrame()
 xt = v.transform([sum]).toarray()
 xm = np.array([e[c].transform([meta[c]])[0] if meta[c] in e[c].classes_ else 0 for c in META]).reshape(1, -1)
 xf = np.array([[meta[f] for f in FLAGS]])
 pro = m.predict_proba(np.hstack([xm, xf, xt]))[0]
 lab = e["severity"].inverse_transform(np.arange(len(pro)))
 return lab[np.argmax(pro)], pd.DataFrame({"Severity": lab, "Probability": pro}).sort_values("Probability",
                                                                                             ascending=False)








def categorize_page():
 st.header("Bug Categorization")
 df = load_bugs(8000)




 def normalize_keywords(x):
     if isinstance(x, list):
         return [str(i).lower().strip() for i in x if i and str(i).strip()]
     if isinstance(x, str) and x.strip():
         return [x.lower().strip()]
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
 st.subheader("Filters");
 c1, c2 = st.columns(2)
 fc = c1.multiselect("Category", sorted(df["category"].unique()))
 comp = c2.multiselect("Component", sorted(df["component"].astype(str).unique()))
 f = df.copy()
 if fc: f = f[f["category"].isin(fc)]
 if comp: f = f[f["component"].astype(str).isin(comp)]
 st.subheader("Category Distribution");
 cc = f["category"].value_counts().reset_index(name="count").rename(columns={"index": "category"})
 st.plotly_chart(px.bar(cc, x="category", y="count", color="category", height=500), use_container_width=True)
 st.subheader("Severity Per Category");
 sc = f.groupby(["category", "severity"]).size().reset_index(name="count")
 st.plotly_chart(
     px.bar(sc, x="category", y="count", color="severity", barmode="stack", category_orders={"severity": TOP_SEV},
            height=500), use_container_width=True)
 st.subheader("Component Distribution Per Category");
 comp_cat = f.groupby(["component", "category"]).size().reset_index(name="count")
 comp_cat = comp_cat[comp_cat["component"] != "N/A"]
 if not comp_cat.empty:
     st.plotly_chart(
         px.bar(comp_cat.head(50), x="component", y="count", color="category", barmode="group", height=600),
         use_container_width=True)
 else:
     st.info("No component data available.")
 st.subheader(f"Bug list ({len(f):,} bugs)")
 st.dataframe(f[["bug_id", "summary", "category", "component", "severity", "keywords"]], use_container_width=True,
              height=420)








def predict_page(df, rf):




 st.header("Severity Prediction")
 df = df[df["resolution"].astype(str).str.lower().isin([
     "", "none", "n/a", "unconfirmed", "new", "---"
 ])]




 m, v, e, _ = rf
 st.subheader("Find a bug")
 s = st.text_input("Search (ID, summary, keyword, component)",
                   placeholder="Search by ID, summary text, keyword, component…")
 r = df.copy()
 if s:
     ls = s.lower()
     r = df[df["bug_id"].astype(str).str.contains(s) | df["summary"].str.lower().str.contains(ls) | df[
         "component"].astype(str).str.lower().str.contains(ls) | df["keywords"].apply(
         lambda ks: isinstance(ks, list) and any(ls in str(k).lower() for k in ks))]
 r = r.head(50)
 opts = [""] + [f"{int(x.bug_id)} – {str(x.summary)[:80]}" for _, x in r.iterrows()]
 sel = st.selectbox("Select a bug", opts)
 if sel: st.session_state.pred_bug_id = int(sel.split(" – ")[0])
 row = df[df["bug_id"] == st.session_state.get("pred_bug_id")] if st.session_state.get("pred_bug_id") else None
 br = row.iloc[0] if row is not None and not row.empty else None
 st.subheader("Bug summary")
 summary = st.text_area("Summary", br["summary"] if br is not None else "", height=130)
 meta = {mn: (br[mn] if br is not None else "") for mn in META}
 flags = extract_flags(br["raw"], br["keywords"]) if br is not None else {f: 0 for f in FLAGS}
 with st.expander("Metadata"):
     cs = st.columns(4)
     for i, mn in enumerate(META): meta[mn] = cs[i % 4].text_input(mn, str(meta[mn]))
     fs = st.columns(5)
     for i, f in enumerate(FLAGS): flags[f] = 1 if fs[i].checkbox(f, value=bool(flags[f])) else 0
 if st.button("Predict Severity"):
     pr, dfp = predict(summary, {**meta, **flags}, m, v, e)
     st.subheader(f"Prediction: {pr}")
     st.plotly_chart(px.bar(dfp, x="Severity", y="Probability", category_orders={"Severity": TOP_SEV}),
                     use_container_width=True)








def insights_page(df, rf):
 st.header("Advanced Insights: Risk and Process Analysis")
 df = df.copy();
 df = df[df["severity"].isin(TOP_SEV)]
 st.subheader("Top-Line Stats")
 total = len(df);
 uniq_comp = df["component"].nunique();
 uniq_prod = df["product"].nunique()
 c1, c2, c3 = st.columns(3)
 c1.metric("Total S1-S4 Bugs", f"{total:,}");
 c2.metric("Unique Components", f"{uniq_comp:,}");
 c3.metric("Unique Products", f"{uniq_prod:,}")
 st.subheader("Product/Severity Impact (Treemap)")
 ps_data = df.groupby(["product", "severity"]).size().reset_index(name="count")
 fig_tree = px.treemap(ps_data, path=["product", "severity"], values="count", color="severity",
                       color_discrete_sequence=px.colors.qualitative.Plotly,
                       title="Volume of Bugs by Product and Severity", height=600)
 st.plotly_chart(fig_tree, use_container_width=True)
 st.subheader("Top Component Risk Heatmap")
 heat = df.groupby(["component", "severity"]).size().reset_index(name="count")
 pivot = heat.pivot_table(values="count", index="component", columns="severity", fill_value=0)
 pivot = pivot.reindex(columns=TOP_SEV, fill_value=0)




 if not pivot.empty:
     top_comp = pivot.sort_values(by=TOP_SEV, ascending=False).head(20).index
     fig_heat = px.imshow(pivot.loc[top_comp, TOP_SEV], aspect="auto", color_continuous_scale="Reds",
                          title="Top 20 Components by S1/S2/S3/S4 Bug Count", height=600)
     fig_heat.update_xaxes(side="top")
     st.plotly_chart(fig_heat, use_container_width=True)
 else:
     st.info("Insufficient component/severity data.")




 st.subheader("Weighted Component Risk Score")
 if not pivot.empty:
     risk_weights = {"S1": 4, "S2": 3, "S3": 2, "S4": 1}
     pivot_risk = pivot.copy()
     for sev, weight in risk_weights.items():
         if sev in pivot_risk.columns: pivot_risk[sev] = pivot_risk[sev] * weight
     pivot_risk["Risk Score"] = pivot_risk[list(risk_weights.keys())].sum(axis=1)
     top_risk_comp = pivot_risk.sort_values("Risk Score", ascending=False).head(20).reset_index()
     fig_risk = px.bar(top_risk_comp, x="Risk Score", y="component", orientation="h",
                       title="Top 20 Components by Weighted Risk Score", color="Risk Score",
                       color_continuous_scale="Plasma", height=600)
     st.plotly_chart(fig_risk, use_container_width=True)
 else:
     st.info("Insufficient data for risk scoring.")




 st.subheader("Bug Lifecycle Flow (Status to Resolution)")
 sr_data = df.groupby(["status", "resolution"]).size().reset_index(name="count")
 fig_sun = px.sunburst(sr_data, path=['status', 'resolution'], values='count',
                       title='Bug Flow from Status to Resolution', height=600)
 st.plotly_chart(fig_sun, use_container_width=True)








def analytics(df):
 st.header("Analytics")
 # Use a constant for severity list for better consistency
 TOP_SEV = ["S1", "S2", "S3", "S4"]
 df = df[df["severity"].isin(TOP_SEV)]




 if df.empty: st.warning("No S1–S4 severity data."); return




 st.subheader("Severity distribution")
 sev = df["severity"].value_counts().reset_index(name="count").rename(columns={"index": "severity"})
 st.plotly_chart(px.pie(sev, names="severity", values="count", hole=.35), use_container_width=True)




 st.subheader("Product × Severity")
 bp = df.groupby(["product", "severity"]).size().reset_index(name="count")
 st.plotly_chart(px.bar(bp, x="product", y="count", color="severity", barmode="group"), use_container_width=True)




 st.subheader("Top components")
 tc = df["component"].astype(str).value_counts().reset_index(name="count").rename(columns={"index": "component"})
 st.plotly_chart(px.bar(tc.head(25), x="count", y="component", orientation="h"), use_container_width=True)




 # --- FIX APPLIED HERE for Keyword Frequency ---
 st.subheader("Keyword frequency")
 kw = []
 for row in df["keywords"]:
     if isinstance(row, list): kw.extend(row)




 kw_df = pd.Series(kw).value_counts().reset_index().rename(columns={"index": "keyword", 0: "count"})
 if not kw_df.empty:
     st.plotly_chart(px.bar(kw_df.head(30), x="keyword", y="count"), use_container_width=True)
 else:
     st.info("No keywords available for analysis.")
 st.subheader("Component × Severity heatmap")
 heat = df.groupby(["component", "severity"]).size().reset_index(name="count")
 pivot = heat.pivot_table(values="count", index="component", columns="severity", fill_value=0)
 if not pivot.empty:
     pivot = pivot.reindex(columns=TOP_SEV, fill_value=0)
     st.plotly_chart(px.imshow(pivot, aspect="auto", color_continuous_scale="Blues"), use_container_width=True)
 else:
     st.info("Insufficient data to generate component × severity heatmap.")




 st.subheader("Severity trend (by bug_id order)")
 df_sorted = df.sort_values("bug_id")
 df_sorted["idx"] = range(len(df_sorted))
 st.plotly_chart(px.line(df_sorted, x="idx", y="bug_id", color="severity"), use_container_width=True)




 st.subheader("Resolution × Severity")
 rs = df.groupby(["resolution", "severity"]).size().reset_index(name="count")
 st.plotly_chart(px.bar(rs, x="resolution", y="count", color="severity", barmode="group"), use_container_width=True)




 st.subheader("Type × Severity")
 tp = df.groupby(["type", "severity"]).size().reset_index(name="count")
 st.plotly_chart(px.bar(tp, x="type", y="count", color="severity", barmode="group"), use_container_width=True)




 st.subheader("Normalized severity per product")
 tot = bp.groupby("product")["count"].transform("sum")
 bp["pct"] = bp["count"] / tot
 st.plotly_chart(px.bar(bp, x="product", y="pct", color="severity", barmode="stack"), use_container_width=True)








def home(df, m):
 st.title("Bug Prioritization and Risk Analysis Platform")
 st.markdown(
     """<div style="font-size:15px; line-height:1.55; margin-bottom:1.5rem;">This platform provides a unified interface for exploring, analyzing, and predicting bug severity across large-scale software projects.  Use the interactive dashboard below to filter data by key categories, and navigate the sidebar for deep-dive analysis, categorization, and ML-powered severity prediction.</div>""",
     unsafe_allow_html=True)
 df_filtered = df[df["severity"].isin(TOP_SEV)]
 col_prod, col_sev = st.columns([1, 1])
 products = col_prod.multiselect("Filter by Product", sorted(df_filtered["product"].dropna().unique()),
                                 default=df_filtered["product"].dropna().unique())
 severities = col_sev.multiselect("Filter by Severity", TOP_SEV, default=TOP_SEV)
 if products: df_filtered = df_filtered[df_filtered["product"].isin(products)]
 if severities: df_filtered = df_filtered[df_filtered["severity"].isin(severities)]
 t = len(df_filtered);
 c = df_filtered[df_filtered["severity"].str.lower() == "critical"]
 c1, c2, c3, c4 = st.columns(4)
 c1.metric("Bugs in Selection", f"{t:,}")
 c2.metric("ML Accuracy (Model)", f"{m.get('accuracy', 0) * 100:.2f}%")
 c3.metric("ML Macro F1 (Model)", f"{m.get('macro_f1', 0) * 100:.2f}%")
 c4.metric("Critical Bugs (Selection)", f"{len(c):,}")
 sev = df_filtered["severity"].value_counts()
 s1, s2, s3, s4 = [int(sev.get(x, 0)) for x in TOP_SEV]
 x1, x2, x3 = st.columns(3)
 x1.metric("S1 (Highest Priority)", f"{s1:,}")
 x2.metric("S2/S3 (High/Medium)", f"{s2 + s3:,}")
 x3.metric("S4 (Lowest Priority)", f"{s4:,}")
 st.subheader("Filtered Distribution");
 c_pie, c_bar = st.columns(2)
 sev_data = df_filtered["severity"].value_counts().reset_index(name="count").rename(columns={"index": "severity"})
 if not sev_data.empty: c_pie.plotly_chart(
     px.pie(sev_data, names="severity", values="count", hole=.4, title="Severity Distribution in Selection",
            category_orders={"severity": TOP_SEV}, height=500), use_container_width=True)
 tc = df_filtered["component"].astype(str).value_counts().reset_index(name="count").rename(
     columns={"index": "component"})
 if not tc.empty: c_bar.plotly_chart(
     px.bar(tc.head(10), x="count", y="component", orientation="h", title="Top 10 Components in Selection",
            height=500), use_container_width=True)








def explorer(df):
 st.header("Bug Data Explorer")
 df = load_bugs(st.slider("Max bugs to load", 200, 10000, 3000, 400))
 if df.empty: st.warning("No bugs loaded."); return
 df = df[df["severity"].isin(TOP_SEV)]
 with st.expander("Filters", expanded=True):
     c1, c2, c3, c4 = st.columns(4)
     s = c1.multiselect("Severity", TOP_SEV)
     p = c2.multiselect("Product", sorted(df["product"].dropna().unique()))
     t = c3.multiselect("Type", sorted(df["type"].dropna().unique()))
     r = c4.multiselect("Resolution", sorted(df["resolution"].dropna().unique()))
     c5, c6 = st.columns(2)
     stt = c5.multiselect("Status", sorted(df["status"].dropna().unique()))
     kw_opts = sorted({k for row in df["keywords"] if isinstance(row, list) for k in row})
     kw_bug = c6.multiselect("Keywords", kw_opts)
     kw = st.text_input("Search in summary")
 f = df.copy()
 if s: f = f[f["severity"].isin(s)]
 if p: f = f[f["product"].isin(p)]
 if t: f = f[f["type"].isin(t)]
 if r: f = f[f["resolution"].isin(r)]
 if stt: f = f[f["status"].isin(stt)]
 if kw_bug: f = f[f["keywords"].apply(lambda ks: isinstance(ks, list) and any(k in ks for k in kw_bug))]
 if kw: f = f[f["summary"].str.contains(kw, case=False, na=False)]
 st.info(f"{len(f):,} bugs")
 display_cols = [c for c in f.columns if c != "raw"]
 st.dataframe(f[display_cols], use_container_width=True, height=460)
 st.download_button("Download CSV", f[display_cols].to_csv(index=False), "bugs.csv", "text/csv")








def eval_page(df, rf):
 st.header("Model Evaluation: Deep Dive Performance")
 _, _, _, m = rf
 if not m: st.warning("No metrics file loaded."); return




 t = len(df);
 c = df[df["severity"].str.lower() == "critical"]
 pcm = m.get("per_class") or m.get("class_metrics") or {}
 avg_precision = np.mean([v.get('precision', 0) for v in pcm.values() if isinstance(v, dict) and 'precision' in v])
 avg_recall = np.mean([v.get('recall', 0) for v in pcm.values() if isinstance(v, dict) and 'recall' in v])




 st.subheader("Overall Performance Summary")
 c1, c2, c3, c4, c5, c6 = st.columns(6)
 c1.metric("Total Bugs (DF)", f"{t:,}")
 c2.metric("Accuracy", f"{m.get('accuracy', 0) * 100:.2f}%")
 c3.metric("Macro F1", f"{m.get('macro_f1', 0) * 100:.2f}%")
 c4.metric("Critical Bugs (DF)", f"{len(c):,}")
 c5.metric("Avg Precision", f"{avg_precision * 100:.2f}%" if pcm else "N/A")
 c6.metric("Avg Recall", f"{avg_recall * 100:.2f}%" if pcm else "N/A")




 st.subheader("Confusion Matrix: True vs. Predicted")
 cm = m.get("confusion_matrix")
 if cm:
     lab, mat = cm.get("labels", []), cm.get("matrix", [])
     keep = [x for x in TOP_SEV + ["normal"] if x in lab]
     try:
         cm_df = pd.DataFrame(mat, index=lab, columns=lab).loc[keep, keep]
         fig = px.imshow(cm_df, text_auto=True, color_continuous_scale="Blues", aspect="equal",
                         title="True vs. Predicted Class Counts", height=700)
         fig.update_layout(xaxis_title="Predicted", yaxis_title="True", margin=dict(l=60, r=60, t=60, b=60),
                           paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='white', coloraxis_showscale=True)
         fig.update_xaxes(constrain="domain");
         fig.update_yaxes(scaleanchor="x")
         st.plotly_chart(fig, use_container_width=False)
     except Exception as e:
         st.error(f"Unable to render confusion matrix: {e}")
 else:
     st.warning("No confusion matrix available in metrics file.")




 st.subheader("Model & Dataset Info")
 info = {"Model Type": "Random Forest Classifier", "Accuracy": f"{m.get('accuracy', 0) * 100:.2f}%",
         "Macro F1 Score": f"{m.get('macro_f1', 0) * 100:.2f}%",
         "Training Size": f"{m.get('train_size', 0):,} samples", "Test Size": f"{m.get('test_size', 0):,} samples",
         "Classes": m.get('classes', "N/A")}
 st.table(pd.DataFrame(list(info.items()), columns=["Metric", "Value"]))




 st.subheader("Feature Importance Analysis (Top 20)")
 rf_model, vec, enc, _ = load_pack(ART_RF)




 if rf_model is not None and hasattr(rf_model, "feature_importances_"):
     fi = np.array(rf_model.feature_importances_)
     n_meta = len(META);
     n_flags = len(FLAGS)
     meta_flag_names = [f"META:{c}" for c in META] + [f"FLAG:{f}" for f in FLAGS]
     tfidf_names = []
     if hasattr(vec, "get_feature_names_out"): tfidf_names = list(vec.get_feature_names_out())




     all_feature_names = meta_flag_names + tfidf_names




     if len(fi) == len(all_feature_names):
         feature_importance_df = pd.DataFrame({"Feature": all_feature_names, "Importance": fi})
         top_features = feature_importance_df.sort_values("Importance", ascending=False).head(20)




         fig_feat = px.bar(top_features, x="Importance", y="Feature", orientation="h",
                           title="Top 20 Features by Random Forest Importance", color="Importance",
                           color_continuous_scale=px.colors.sequential.Plasma, height=600)
         fig_feat.update_yaxes(autorange="reversed")
         st.plotly_chart(fig_feat, use_container_width=True)




         st.markdown("##### Feature Importance Table (Top 10)")
         st.table(top_features.head(10))
     else:
         st.info(
             f"Feature importance array length mismatch. Expected {len(all_feature_names)}, got {len(fi)}. Check model training consistency.")
 else:
     st.info("No feature importance data available or model not loaded correctly.")






# Yuasa


from datetime import datetime


def resolution_schedule_page(df):
   import streamlit as st
   import pandas as pd
   import numpy as np


   st.header("Bug Resolution Schedule by Days Open")


   df = df.copy()


   if "severity" in df.columns:
       df["severity"] = df["severity"].astype(str).str.strip().str.upper()


   if "raw" in df.columns:
       df["creation_time"] = df["raw"].apply(
           lambda x: x.get("creation_time", "N/A") if isinstance(x, dict) else "N/A"
       )
       df["last_change_time"] = df["raw"].apply(
           lambda x: x.get("last_change_time", "N/A") if isinstance(x, dict) else "N/A"
       )


       if "bug_id" in df.columns:
           df["id"] = df["bug_id"]
       else:
           df["id"] = df["raw"].apply(
               lambda x: x.get("id", 0) if isinstance(x, dict) else 0
           )


   if "days_open" not in df.columns:
       st.error("'days_open' column is missing.")
       return


   st.subheader("Filter Settings")


   min_days_open = st.number_input(
       "Show bugs that have been open at least this many days:",
       min_value=0,
       value=0,
       step=1
   )


   severity_list = sorted(df["severity"].dropna().unique().tolist())
   selected_sev = st.multiselect(
       "Select severity to display:",
       options=severity_list,
       default=severity_list
   )


   df_filtered = df[df["days_open"] >= min_days_open]


   if selected_sev:
       df_filtered = df_filtered[df_filtered["severity"].isin(selected_sev)]


   if df_filtered.empty:
       st.warning("No bugs match the selected filter conditions.")
       return


   df_sorted = df_filtered.sort_values("days_open", ascending=False)


   display_cols = [
       c for c in ["id", "days_open", "creation_time", "last_change_time", "severity"]
       if c in df_sorted.columns
   ]


   st.subheader("Bugs Sorted by Days Open")
   st.dataframe(df_sorted[display_cols], use_container_width=True, height=450)


   TOP_SEV = ["S1", "S2", "S3", "S4"]
   df_rel = df_sorted[df_sorted["severity"].isin(TOP_SEV)]


   if df_rel.empty:
       st.warning("No S1–S4 severity bugs available.")
       return


   stats = (
       df_rel.groupby("severity")["days_open"]
       .agg(["count", "mean", "median", "max", "min"])
       .reset_index()
   )
   stats.rename(
       columns={"count": "Bug Count", "mean": "Average Days Open"}, inplace=True
   )


   st.subheader("Severity ↔ Days Open Relationship")
   st.table(stats)


   st.markdown("#### Top 10 longest-open bugs per severity")
   for sev in TOP_SEV:
       subset = df_rel[df_rel["severity"] == sev].head(10)
       if not subset.empty:
           st.markdown(f"**{sev}**")
           st.table(subset[["id", "days_open"]])
#Yuasa
















def main():
 df = load_bugs(5000);
 rf = load_pack(ART_RF);
 _, _, _, met = rf
 if st.session_state.username: st.sidebar.caption(
     f"Signed in as **{st.session_state.username}** ({st.session_state.role})")
 page = st.sidebar.radio("", ["Home", "Bug data explorer", "Analytics", "Categorization", "Advanced insights",
                              "Severity prediction", "Model evaluation","Resolution schedule", "Logout"])
 if page == "Home":
     home(df, met)
 elif page == "Bug data explorer":
     explorer(df)
 elif page == "Analytics":
     analytics(df)
 elif page == "Categorization":
     categorize_page()
 elif page == "Advanced insights":
     insights_page(df, rf)
 elif page == "Severity prediction":
     predict_page(df, rf)
 elif page == "Model evaluation":
     eval_page(df, rf)
 elif page == "Resolution schedule":
     resolution_schedule_page(df)
 elif page == "Logout":
     for k in list(st.session_state.keys()): del st.session_state[k]
     st.session_state.authenticated = False;
     st.rerun()








_ = main() if st.session_state.authenticated else login_ui()





