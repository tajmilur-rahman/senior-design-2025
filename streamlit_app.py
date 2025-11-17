import os, json, joblib, psycopg2, numpy as np, pandas as pd, bcrypt
import streamlit as st, plotly.express as px
from dotenv import load_dotenv

st.set_page_config(page_title="Bug Prioritization based on Severity", layout="wide")
load_dotenv()

DB={"dbname":os.getenv("BUGBUG_DB","bugbug_data"),
    "user":os.getenv("BUGBUG_DB_USER","postgres"),
    "password":os.getenv("BUGBUG_DB_PASSWORD","2331"),
    "host":os.getenv("BUGBUG_DB_HOST","localhost"),
    "port":os.getenv("BUGBUG_DB_PORT","5432")}

ART_RF={"model":"rf_model.pkl","vec":"tfidf_vectorizer.pkl","enc":"label_encoders.pkl","met":"rf_metrics.json"}
ART_XGB={"model":"xgb_model.pkl","vec":"tfidf_vectorizer_xgb.pkl","enc":"label_encoders_xgb.pkl","met":"xgb_metrics.json"}
META=["component","product","priority","platform","op_sys","type","resolution","status"]

defaults={"authenticated":False,"username":None,"pred_bug_id":None,"detail_bug_id":None,"notes":{}}
for k,v in defaults.items(): st.session_state.setdefault(k,v)

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
</style>
""",unsafe_allow_html=True)

@st.cache_data(show_spinner="Loading bugs...")
def load_bugs(limit=5000):
    try:
        conn=psycopg2.connect(**DB)
        df=pd.read_sql(f"SELECT bug_id,data FROM bugs LIMIT {limit}",conn)
        conn.close()
    except: return pd.DataFrame()
    def p(x,k):
        try: return (x if isinstance(x,dict) else json.loads(x)).get(k,"N/A")
        except: return "N/A"
    cols=["summary"]+META+["severity"]
    for c in cols: df[c]=df["data"].apply(lambda x:p(x,c))
    return df[["bug_id"]+cols]

@st.cache_resource
def load_pack(s):
    try:
        return(joblib.load(s["model"]),joblib.load(s["vec"]),joblib.load(s["enc"]),
               json.load(open(s["met"])) if os.path.exists(s["met"]) else {})
    except: return None,None,None,{}

def predict(summary,meta,m,v,e):
    if not all([m,v,e]): return"N/A",pd.DataFrame()
    X_text=v.transform([summary]).toarray()
    X_meta=np.array([[e[c].transform([meta.get(c,"N/A")])[0] if meta.get(c,"") in e[c].classes_ else 0 for c in META]])
    proba=m.predict_proba(np.hstack([X_meta,X_text]))[0]
    labels=e["severity"].inverse_transform(np.arange(len(proba)))
    return labels[np.argmax(proba)], pd.DataFrame({"Severity":labels,"Probability":proba}).sort_values("Probability",ascending=False)

def kpi(m,df):
    total=len(df); crit=df[df["severity"].str.lower()=="critical"]
    c1,c2,c3,c4=st.columns(4)
    c1.metric("Total Bugs",f"{total:,}"); c2.metric("Accuracy",f"{m.get('accuracy',0)*100:.2f}%")
    c3.metric("Macro F1",f"{m.get('macro_f1',0)*100:.2f}%")
    c4.metric("Critical Bugs",f"{len(crit):,} ({len(crit)/total*100 if total else 0:.1f}%)")

def search(df,key):
    q=st.text_input("Search bugs",key=f"{key}_q")
    res=df[df["summary"].astype(str).str.contains(q,case=False,na=False)].head(20) if q else df.head(15)
    with st.expander("Results",expanded=bool(q)):
        for _,r in res.iterrows():
            if st.button(f"[{r['bug_id']}] {str(r['summary'])[:80]}...",key=f"{key}_{r['bug_id']}"):
                return int(r["bug_id"])
    return None

USERS={os.getenv("ADMIN_USER","admin"):os.getenv("ADMIN_PASS_HASH"),
        os.getenv("STUDENT_USER","student"):os.getenv("STUDENT_PASS_HASH")}

def login():
    st.markdown("<h2 style='text-align:center;margin-top:2rem;'>🔐 Secure Login</h2>",unsafe_allow_html=True)
    l,c,r=st.columns([1,1.2,1])
    with c:
        with st.form("login_form"):
            u=st.text_input("Username")
            p=st.text_input("Password",type="password")
            s=st.form_submit_button("Login")
            if s:
                if u in USERS and USERS[u] and bcrypt.checkpw(p.encode(),USERS[u].encode()):
                    st.session_state.authenticated=True; st.session_state.username=u; st.rerun()
                else: st.error("Invalid credentials")

def home(df,m):
    st.title("Bug Prioritization based on Severity"); st.info("ML-powered triage.")
    kpi(m,df); st.plotly_chart(px.pie(df,names="severity"),use_container_width=True)

def explorer(df):
    st.header("📊 Bug Data Explorer")
    limit=st.slider("Max bugs",200,10000,3000,400); df=load_bugs(limit)
    with st.expander("Filters",expanded=True):
        c1,c2,c3,c4=st.columns(4)
        sev=c1.multiselect("Severity",sorted(df["severity"].unique()))
        prod=c2.multiselect("Product",sorted(df["product"].unique()))
        plat=c3.multiselect("Platform",sorted(df["platform"].unique()))
        stat=c4.multiselect("Status",sorted(df["status"].unique()))
        kw=st.text_input("Keyword")
    f=df.copy()
    if sev:f=f[f["severity"].isin(sev)]
    if prod:f=f[f["product"].isin(prod)]
    if plat:f=f[f["platform"].isin(plat)]
    if stat:f=f[f["status"].isin(stat)]
    if kw:f=f[f["summary"].astype(str).str.contains(kw,case=False,na=False)]
    st.info(f"Showing {len(f):,} bugs")
    st.dataframe(f,use_container_width=True,height=460)
    st.download_button("Download CSV",f.to_csv(index=False),"bugs_filtered.csv","text/csv")

def detail(df):
    st.header("🔎 Bug Detail")
    sel=search(df,"detail")
    if sel: st.session_state.detail_bug_id=sel
    row=df[df["bug_id"]==st.session_state.detail_bug_id]
    if row.empty: st.caption("Select a bug."); return
    b=row.iloc[0]
    st.subheader(f"Bug {b['bug_id']}: {b['summary']}")
    c1,c2,c3=st.columns(3)
    c1.metric("Severity",b["severity"]); c1.metric("Status",b["status"])
    c2.metric("Product",b["product"]); c2.metric("Component",b["component"])
    c3.metric("Priority",b["priority"]); c3.metric("Platform",b["platform"])
    st.json({c:b[c] for c in META})
    n=st.text_area("Notes",value=st.session_state.notes.get(str(b["bug_id"]),""))
    st.session_state.notes[str(b["bug_id"])]=n

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
        meta={}
        with st.expander("Metadata",expanded=(br is not None)):
            cols=st.columns(4)
            for i,m in enumerate(META): meta[m]=cols[i%4].text_input(m,br[m] if br is not None else "")
    with c2: st.info("Random Forest and XGBoost use TF-IDF + metadata.")
    if st.button("🔮 Predict Severity",use_container_width=True):
        if not summary.strip(): st.warning("Enter summary."); return
        m,v,e,_=rf; pred,dfp=predict(summary,meta,m,v,e)
        st.markdown(f"<h3 style='text-align:center;color:#a5b4fc;'>RF: <b>{pred}</b></h3>",unsafe_allow_html=True)
        st.plotly_chart(px.bar(dfp,x="Severity",y="Probability"),use_container_width=True)
        mx,vx,ex,_=xgbp
        if mx:
            pxg,pxdf=predict(summary,meta,mx,vx,ex)
            st.markdown(f"<h3 style='text-align:center;color:#38bdf8;'>XGB: <b>{pxg}</b></h3>",unsafe_allow_html=True)
            st.plotly_chart(px.bar(pxdf,x="Severity",y="Probability"),use_container_width=True)

def eval_page(df,rf,xgbp):
    st.header("📈 Model Evaluation")
    _,_,_,m=rf
    if not m: st.warning("No metrics."); return
    kpi(m,df)
    cm=m["confusion_matrix"]; labels,mat=cm["labels"],cm["matrix"]
    keep=[x for x in ["S1","S2","S3","S4","normal"] if x in labels]
    cm_df=pd.DataFrame(mat,index=labels,columns=labels).loc[keep,keep]
    fig=px.imshow(cm_df,text_auto=True,color_continuous_scale=["white","black"],aspect="equal")
    fig.update_layout(title="Confusion Matrix",xaxis_title="Predicted",yaxis_title="True",
                      width=700,height=700,margin=dict(l=60,r=60,t=60,b=60),
                      paper_bgcolor='rgba(0,0,0,0)',plot_bgcolor='white',coloraxis_showscale=False)
    fig.update_xaxes(constrain="domain"); fig.update_yaxes(scaleanchor="x")
    st.plotly_chart(fig,use_container_width=False)

def main():
    df=load_bugs(5000); rf=load_pack(ART_RF); xgbp=load_pack(ART_XGB); _,_,_,met=rf
    if st.session_state.username: st.sidebar.caption(f"Signed in as **{st.session_state.username}**")
    page=st.sidebar.radio("",["Home","Bug Data Explorer","Bug Detail & Notes","Analytics","Severity Prediction","Model Evaluation","Logout"])
    if page=="Home": home(df,met)
    elif page=="Bug Data Explorer": explorer(df)
    elif page=="Bug Detail & Notes": detail(df)
    elif page=="Analytics": analytics(df)
    elif page=="Severity Prediction": predict_page(df,rf,xgbp)
    elif page=="Model Evaluation": eval_page(df,rf,xgbp)
    elif page=="Logout":
        for k in list(st.session_state.keys()): del st.session_state[k]
        st.session_state.authenticated=False; st.session_state.username=None; st.rerun()

if st.session_state.authenticated: main()
else: login()
