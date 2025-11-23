import os, json, joblib, psycopg2, numpy as np, pandas as pd, bcrypt
import streamlit as st, plotly.express as px

st.set_page_config(page_title="Bug prioritization", layout="wide")

DB={"dbname":"bugbug_data","user":"postgres","password":"2331","host":"localhost","port":"5432"}
ART_RF={"model":"rf_model.pkl","vec":"tfidf_vectorizer.pkl","enc":"label_encoders.pkl","met":"rf_metrics.json"}
META=["component","product","priority","platform","op_sys","type","resolution","status"]

for k,v in {"authenticated":False,"username":None,"role":None,"pred_bug_id":None,"notes":{}}.items():
    st.session_state.setdefault(k,v)

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
""",unsafe_allow_html=True)

def sql(q,p=(),one=False):
    conn=psycopg2.connect(**DB); cur=conn.cursor(); cur.execute(q,p)
    if q.strip().lower().startswith("select"):
        r=cur.fetchone() if one else cur.fetchall(); conn.close(); return r
    conn.commit(); conn.close()

def user_exists():
    return sql("SELECT COUNT(*) FROM users",one=True)[0]>0

def create_user(u,p,r):
    h=bcrypt.hashpw(p.encode(),bcrypt.gensalt()).decode()
    sql("INSERT INTO users(username,password_hash,role) VALUES(%s,%s,%s)",(u,h,r))

def check_user(u,p):
    r=sql("SELECT password_hash,role FROM users WHERE username=%s",(u,),one=True)
    if not r:return False,None
    return (bcrypt.checkpw(p.encode(),r[0].encode()),r[1])

@st.cache_data(show_spinner="Loading bugs")
def load_bugs(limit=5000):
    try:
        conn=psycopg2.connect(**DB)
        df=pd.read_sql(f"SELECT bug_id,data FROM bugs LIMIT {limit}",conn); conn.close()
    except: return pd.DataFrame()
    def p(x,k):
        try:
            d=x if isinstance(x,dict) else json.loads(x)
            return d.get(k,"N/A")
        except:return "N/A"
    cols=["summary","keywords"]+META+["severity"]
    for c in cols: df[c]=df["data"].apply(lambda x:p(x,c))
    return df[["bug_id"]+cols]

@st.cache_resource
def load_pack(s):
    try:return(joblib.load(s["model"]),joblib.load(s["vec"]),joblib.load(s["enc"]),json.load(open(s["met"])) if os.path.exists(s["met"]) else {})
    except:return None,None,None,{}

def login_ui():
    st.markdown("<h2 style='text-align:center;margin-top:2rem;'>Bug Prioritization Login</h2>", unsafe_allow_html=True)
    tabs = st.tabs(["Login","Create User","Manage Users","Reset Password"] if user_exists() else ["Initial Setup"])
    if not user_exists():
        with tabs[0]:
            L,C,R = st.columns([1,1,1])
            with C:
                a = st.text_input("Admin Username", key="setup_admin_user")
                b = st.text_input("Admin Password", type="password", key="setup_admin_pass")
                if st.button("Create Admin", key="setup_admin_btn", use_container_width=True):
                    if a and b: create_user(a,b,"admin"); st.rerun()
                    else: st.error("All fields required.")
        return
    with tabs[0]:
        L, C, R = st.columns([1, 1, 1])
        with C:
            with st.form("login_form", clear_on_submit=False):
                u = st.text_input("Username")
                p = st.text_input("Password", type="password")
                submit = st.form_submit_button("Login")  # Enter key triggers this

            if submit:
                ok, role = check_user(u, p)
                if ok:
                    st.session_state.authenticated = True
                    st.session_state.username = u
                    st.session_state.role = role
                    st.rerun()
                else:
                    st.error("Invalid credentials")

    with tabs[1]:
        L,C,R = st.columns([1,1,1])
        with C:
            new_u = st.text_input("New Username", key="create_user_user")
            new_p = st.text_input("New Password", type="password", key="create_user_pass")
            new_r = st.selectbox("Role", ["user","admin"], key="create_user_role")
            if st.button("Create User", key="create_user_btn", use_container_width=True):
                if new_u and new_p: create_user(new_u,new_p,new_r); st.success("Created.")
                else: st.error("Required.")
    with tabs[2]:
        L,C,R = st.columns([1,1,1])
        with C:
            users = sql("SELECT username, role FROM users ORDER BY username")
            st.table(pd.DataFrame(users, columns=["Username","Role"]))
            du = st.text_input("Delete Username", key="delete_user_user")
            if st.button("Delete User", key="delete_user_btn", use_container_width=True) and du:
                sql("DELETE FROM users WHERE username=%s",(du,)); st.rerun()
    with tabs[3]:
        L,C,R = st.columns([1,1,1])
        with C:
            ru = st.text_input("Username", key="reset_user_user")
            npw = st.text_input("New Password", type="password", key="reset_user_pass")
            if st.button("Reset Password", key="reset_user_btn", use_container_width=True) and ru and npw:
                h = bcrypt.hashpw(npw.encode(),bcrypt.gensalt()).decode()
                sql("UPDATE users SET password_hash=%s WHERE username=%s",(h,ru))
                st.success("Reset.")

def predict(summary,meta,m,v,e):
    if not all([m,v,e]):return"N/A",pd.DataFrame()
    xt=v.transform([summary]).toarray()
    xm=np.array([[e[c].transform([meta.get(c,"N/A")])[0] if meta.get(c,"") in e[c].classes_ else 0 for c in META]])
    pro=m.predict_proba(np.hstack([xm,xt]))[0]
    lab=e["severity"].inverse_transform(np.arange(len(pro)))
    return lab[np.argmax(pro)],pd.DataFrame({"Severity":lab,"Probability":pro}).sort_values("Probability",ascending=False)

def kpi(m,df):
    t=len(df); c=df[df["severity"].astype(str).str.lower()=="critical"]
    c1,c2,c3,c4=st.columns(4)
    c1.metric("Total Bugs",f"{t:,}"); c2.metric("Accuracy",f"{m.get('accuracy',0)*100:.2f}%")
    c3.metric("Macro F1",f"{m.get('macro_f1',0)*100:.2f}%"); c4.metric("Critical Bugs",f"{len(c):,}")

def search(df,key):
    q=st.text_input("Search bugs",key=f"{key}_q")
    r=df[df["summary"].astype(str).str.contains(q,case=False,na=False)].head(20) if q else df.head(15)
    with st.expander("Results",expanded=bool(q)):
        for _,x in r.iterrows():
            if st.button(f"[{x['bug_id']}] {x['summary'][:80]}",key=f"{key}_{x['bug_id']}"): return int(x["bug_id"])

def home(df,m):
    st.title("Bug Prioritization based on Severity")
    st.info("Welcome to the Bug Severity dashboard. Use this app to explore data, analyze severity patterns, and predict severity for new or existing bugs.")
    kpi(m,df)
    c1,c2,c3=st.columns(3)
    sev_counts=df["severity"].value_counts()
    s1,s2,s3,s4=[int(sev_counts.get(x,0)) for x in ["S1","S2","S3","S4"]]
    with c1: st.metric("S1 (Highest)",f"{s1:,}")
    with c2: st.metric("S2/S3 (Medium)",f"{s2+s3:,}")
    with c3: st.metric("S4 (Lowest)",f"{s4:,}")
    st.markdown("""
**How to use this app:**
- **Bug data explorer**: Filter and drill into bugs by severity, product, type, resolution, status, and Bugzilla keywords.
- **Analytics**: View distribution of severities across products and high-level component volumes.
- **Severity prediction**: Paste or load a bug summary and metadata to get ML-based severity suggestions.
- **Model evaluation**: Inspect confusion matrix and metrics for the Random Forest model.
""")

def explorer(df):
    st.header("Bug data explorer")
    df=load_bugs(st.slider("Max bugs",200,10000,3000,400))
    if df.empty:
        st.warning("No bugs loaded.");return

    valid_sev=["S1","S2","S3","S4"]
    df=df[df["severity"].isin(valid_sev)]

    with st.expander("Filters",expanded=True):
        c1,c2,c3,c4=st.columns(4)
        s=c1.multiselect("Severity",valid_sev)
        p=c2.multiselect("Product",sorted(df["product"].dropna().unique()))
        t=c3.multiselect("Type",sorted(df["type"].dropna().unique()))
        r=c4.multiselect("Resolution",sorted(df["resolution"].dropna().unique()))

        c5,c6=st.columns(2)
        stt=c5.multiselect("Status",sorted(df["status"].dropna().unique()))

        kw_series=df["keywords"] if "keywords" in df.columns else pd.Series([])
        kw_opts=sorted({k for row in kw_series if isinstance(row,list) for k in row})
        kw_bug=c6.multiselect("Keywords (Bugzilla)",kw_opts)

        kw=st.text_input("Search in summary")

    f=df.copy()
    if s:f=f[f["severity"].isin(s)]
    if p:f=f[f["product"].isin(p)]
    if t:f=f[f["type"].isin(t)]
    if r:f=f[f["resolution"].isin(r)]
    if stt:f=f[f["status"].isin(stt)]
    if kw_bug and "keywords" in f.columns:
        f=f[f["keywords"].apply(lambda ks:isinstance(ks,list) and any(k in ks for k in kw_bug))]
    if kw:f=f[f["summary"].astype(str).str.contains(kw,case=False,na=False)]

    st.info(f"Showing {len(f):,} bugs")
    st.dataframe(f,use_container_width=True,height=460)
    st.download_button("Download CSV",f.to_csv(index=False),"bugs.csv","text/csv")


def analytics(df):
    st.header("Analytics")
    df_s=df[df["severity"].isin(["S1","S2","S3","S4"])]
    if df_s.empty:
        st.warning("No S1–S4 severity data available.");return
    bp=df_s.groupby(["product","severity"]).size().reset_index(name="count")
    st.plotly_chart(px.bar(bp,x="product",y="count",color="severity",barmode="group"),use_container_width=True)
    tc=df_s["component"].astype(str).value_counts().reset_index(name="count").rename(columns={"index":"component"})
    st.plotly_chart(px.bar(tc.head(15),x="count",y="component",orientation="h"),use_container_width=True)

def predict_page(df,rf):
    st.header("Severity prediction")
    sel=search(df,"pred")
    if sel: st.session_state.pred_bug_id=sel
    row=df[df["bug_id"]==st.session_state.pred_bug_id]
    br=row.iloc[0] if not row.empty else None
    c1,c2=st.columns([2,1])
    with c1:
        summary=st.text_area("Summary",br["summary"] if br is not None else "",height=150)
        meta={}
        with st.expander("Metadata",expanded=(br is not None)):
            cols=st.columns(4)
            for i,mn in enumerate(META): meta[mn]=cols[i%4].text_input(mn,br[mn] if br is not None else "")
    with c2: st.info("The Random Forest model uses TF-IDF features combined with selected Bugzilla metadata to suggest a likely severity class.")
    if st.button("🔮 Predict Severity",use_container_width=True):
        m,v,e,_=rf
        pr,dfp=predict(summary,meta,m,v,e)
        st.markdown(f"<h3 style='text-align:center;color:#a5b4fc;'>Random Forest: <b>{pr}</b></h3>",unsafe_allow_html=True)
        if not dfp.empty:
            st.plotly_chart(px.bar(dfp,x="Severity",y="Probability"),use_container_width=True)

def eval_page(df,rf):
    st.header("Model evaluation")
    _,_,_,m=rf
    if not m: st.warning("No metrics"); return
    kpi(m,df)
    cm=m.get("confusion_matrix")
    if not cm: st.warning("No confusion matrix found.");return
    lab,mat=cm["labels"],cm["matrix"]
    keep=[x for x in ["S1","S2","S3","S4","normal"] if x in lab]
    cm_df=pd.DataFrame(mat,index=lab,columns=lab).loc[keep,keep]
    fig=px.imshow(cm_df,text_auto=True,color_continuous_scale=["white","black"],aspect="equal")
    fig.update_layout(title="Confusion Matrix",xaxis_title="Predicted",yaxis_title="True",width=700,height=700,margin=dict(l=60,r=60,t=60,b=60),paper_bgcolor='rgba(0,0,0,0)',plot_bgcolor='white',coloraxis_showscale=False)
    fig.update_xaxes(constrain="domain"); fig.update_yaxes(scaleanchor="x")
    st.plotly_chart(fig,use_container_width=False)

def main():
    df=load_bugs(5000); rf=load_pack(ART_RF); _,_,_,met=rf
    if st.session_state.username: st.sidebar.caption(f"Signed in as **{st.session_state.username}** ({st.session_state.role})")
    page=st.sidebar.radio("",["Home","Bug data explorer","Analytics","Severity prediction","Model evaluation","Logout"])
    if page=="Home": home(df,met)
    elif page=="Bug data explorer": explorer(df)
    elif page=="Analytics": analytics(df)
    elif page=="Severity prediction": predict_page(df,rf)
    elif page=="Model evaluation": eval_page(df,rf)
    elif page=="Logout":
        for k in list(st.session_state.keys()): del st.session_state[k]
        st.session_state.authenticated=False; st.rerun()

if st.session_state.authenticated: main()
else: login_ui()
