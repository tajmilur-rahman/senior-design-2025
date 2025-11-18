import os, json, joblib, psycopg2, numpy as np, pandas as pd, bcrypt
import streamlit as st, plotly.express as px

st.set_page_config(page_title="Bug Prioritization", layout="wide")

DB={"dbname":"bugbug_data","user":"postgres","password":"1234","host":"localhost","port":"5432"}
ART_RF={"model":"rf_model.pkl","vec":"tfidf_vectorizer.pkl","enc":"label_encoders.pkl","met":"rf_metrics.json"}
ART_XGB={"model":"xgb_model.pkl","vec":"tfidf_vectorizer_xgb.pkl","enc":"label_encoders_xgb.pkl","met":"xgb_metrics.json"}
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

@st.cache_data(show_spinner="Loading bugs...")
def load_bugs(limit=5000):
    try:
        conn=psycopg2.connect(**DB)
        df=pd.read_sql(f"SELECT bug_id,data FROM bugs LIMIT {limit}",conn); conn.close()
    except: return pd.DataFrame()
    def p(x,k):
        try:return(x if isinstance(x,dict) else json.loads(x)).get(k,"N/A")
        except:return"N/A"
    cols=["summary"]+META+["severity"]
    for c in cols: df[c]=df["data"].apply(lambda x:p(x,c))
    return df[["bug_id"]+cols]

@st.cache_resource
def load_pack(s):
    try:return(joblib.load(s["model"]),joblib.load(s["vec"]),joblib.load(s["enc"]),json.load(open(s["met"])) if os.path.exists(s["met"]) else {})
    except:return None,None,None,{}

def login_ui():
    st.markdown("<h2 style='text-align:center;margin-top:2rem;'>🔐 Bug Prioritization Login</h2>", unsafe_allow_html=True)
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
        L,C,R = st.columns([1,1,1])
        with C:
            u = st.text_input("Username", key="login_user")
            p = st.text_input("Password", type="password", key="login_pass")
            if st.button("Login", key="login_btn", use_container_width=True):
                ok,role = check_user(u,p)
                if ok:
                    st.session_state.authenticated=True
                    st.session_state.username=u
                    st.session_state.role=role
                    st.rerun()
                else: st.error("Invalid credentials")
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
    t=len(df); c=df[df["severity"].str.lower()=="critical"]
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
    st.title("Bug Prioritization"); st.info("ML-powered triage.")
    kpi(m,df); st.plotly_chart(px.pie(df,names="severity"),use_container_width=True)

def explorer(df):
    st.header("📊 Bug Data Explorer")
    df=load_bugs(st.slider("Max bugs",200,10000,3000,400))
    with st.expander("Filters",expanded=True):
        c1,c2,c3,c4=st.columns(4)
        s=c1.multiselect("Severity",sorted(df["severity"].unique()))
        p=c2.multiselect("Product",sorted(df["product"].unique()))
        pl=c3.multiselect("Platform",sorted(df["platform"].unique()))
        stt=c4.multiselect("Status",sorted(df["status"].unique()))
        kw=st.text_input("Keyword")
    f=df.copy()
    if s:f=f[f["severity"].isin(s)]
    if p:f=f[f["product"].isin(p)]
    if pl:f=f[f["platform"].isin(pl)]
    if stt:f=f[f["status"].isin(stt)]
    if kw:f=f[f["summary"].astype(str).str.contains(kw,case=False,na=False)]
    st.info(f"Showing {len(f):,}")
    st.dataframe(f,use_container_width=True,height=460)
    st.download_button("Download CSV",f.to_csv(index=False),"bugs.csv","text/csv")

def analytics(df):
    st.header("📊 Analytics")
    bp=df.groupby(["product","severity"]).size().reset_index(name="count")
    st.plotly_chart(px.bar(bp,x="product",y="count",color="severity",barmode="group"),use_container_width=True)
    tc=df["component"].astype(str).value_counts().reset_index(name="count").rename(columns={"index":"component"})
    st.plotly_chart(px.bar(tc.head(15),x="count",y="component",orientation="h"),use_container_width=True)

def predict_page(df,rf,xgbp):
    st.header("🤖 Severity Prediction")
    sel=search(df,"pred")
    if sel: st.session_state.pred_bug_id=sel
    row=df[df["bug_id"]==st.session_state.pred_bug_id]
    br=row.iloc[0] if not row.empty else None
    c1,c2=st.columns([2,1])
    with c1:
        summary=st.text_area("Summary",br["summary"] if br is not None else "",height=150)
        meta={};
        with st.expander("Metadata",expanded=(br is not None)):
            cols=st.columns(4)
            for i,mn in enumerate(META): meta[mn]=cols[i%4].text_input(mn,br[mn] if br is not None else "")
    with c2: st.info("Random Forest & XGBoost use TF-IDF + metadata.")
    if st.button("🔮 Predict Severity",use_container_width=True):
        m,v,e,_=rf; pr,dfp=predict(summary,meta,m,v,e)
        st.markdown(f"<h3 style='text-align:center;color:#a5b4fc;'>RF: <b>{pr}</b></h3>",unsafe_allow_html=True)
        st.plotly_chart(px.bar(dfp,x="Severity",y="Probability"),use_container_width=True)
        mx,vx,ex,_=xgbp
        if mx:
            pr2,df2=predict(summary,meta,mx,vx,ex)
            st.markdown(f"<h3 style='text-align:center;color:#38bdf8;'>XGB: <b>{pr2}</b></h3>",unsafe_allow_html=True)
            st.plotly_chart(px.bar(df2,x="Severity",y="Probability"),use_container_width=True)

def eval_page(df,rf,xgbp):
    st.header("📈 Model Evaluation")
    _,_,_,m=rf
    if not m: st.warning("No metrics"); return
    kpi(m,df); cm=m["confusion_matrix"]; lab,mat=cm["labels"],cm["matrix"]
    keep=[x for x in ["S1","S2","S3","S4","normal"] if x in lab]
    cm_df=pd.DataFrame(mat,index=lab,columns=lab).loc[keep,keep]
    fig=px.imshow(cm_df,text_auto=True,color_continuous_scale=["white","black"],aspect="equal")
    fig.update_layout(title="Confusion Matrix",xaxis_title="Predicted",yaxis_title="True",width=700,height=700,margin=dict(l=60,r=60,t=60,b=60),paper_bgcolor='rgba(0,0,0,0)',plot_bgcolor='white',coloraxis_showscale=False)
    fig.update_xaxes(constrain="domain"); fig.update_yaxes(scaleanchor="x")
    st.plotly_chart(fig,use_container_width=False)

def main():
    df=load_bugs(5000); rf=load_pack(ART_RF); xgbp=load_pack(ART_XGB); _,_,_,met=rf
    if st.session_state.username: st.sidebar.caption(f"Signed in as **{st.session_state.username}** ({st.session_state.role})")
    page=st.sidebar.radio("",["Home","Bug Data Explorer","Analytics","Severity Prediction","Model Evaluation","Logout"])
    if page=="Home": home(df,met)
    elif page=="Bug Data Explorer": explorer(df)
    elif page=="Analytics": analytics(df)
    elif page=="Severity Prediction": predict_page(df,rf,xgbp)
    elif page=="Model Evaluation": eval_page(df,rf,xgbp)
    elif page=="Logout":
        for k in list(st.session_state.keys()): del st.session_state[k]
        st.session_state.authenticated=False; st.rerun()

if st.session_state.authenticated: main()
else: login_ui()
