import { useState } from 'react';
import axios from 'axios';
import { BrainCircuit, Terminal, CheckCircle } from 'lucide-react';

export default function MLPredictor({ user }) {
  const [summary, setSummary] = useState("");
  const [component, setComponent] = useState("Frontend");
  const [platform, setPlatform] = useState("Windows");
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const components = ["Frontend", "Backend", "Database", "Networking", "Security", "DevTools", "Core"];
  const platforms = ["Windows", "MacOS", "Linux", "Android", "iOS"];

  // Helper to get token
  const getAuthHeader = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  const predict = async () => {
    if(!summary) return;
    setLoading(true); setRes(null); setSaved(false); setFeedbackSent(false);

    try {
        const payload = { summary, component, platform };
        // FIX 1: Use relative path for Vite Proxy and add Auth header
        const r = await axios.post('/api/predict', payload, {
            headers: getAuthHeader()
        });
        setRes(r.data);
    } catch (err) {
        console.error("API Error:", err);
        alert("Error: Prediction failed. Ensure backend is running and you are logged in.");
    }
    setLoading(false);
  }

  const saveToDb = async () => {
      if (!res) return;
      try {
          // Matches your CreateBugRequest Pydantic model
          const bugPayload = {
              bug: {
                  summary,
                  component,
                  severity: res.prediction, // Predicted severity from AI
                  status: "NEW",
                  platform: platform
              },
              company_id: user.company_id
          };
          
          // FIX 2: Correct endpoint and attach token
          await axios.post('/api/bug', bugPayload, {
              headers: getAuthHeader()
          });
          setSaved(true);
      } catch (e) { 
          console.error("Save Error:", e);
          alert("Error saving bug to database."); 
      }
  };

  const sendFeedback = async (actual) => {
      try {
          // FIX 3: Matches Feedback model in models.py
          await axios.post('/api/feedback', {
              summary, 
              predicted_severity: res.prediction, 
              actual_severity: actual, 
              company_id: user.company_id
          }, {
              headers: getAuthHeader()
          });
          setFeedbackSent(true);
      } catch (e) { console.error("Feedback Error:", e); }
  };

  return (
    <div className="page-content centered-page fade-in">
      <div className="sys-card form-wrapper" style={{maxWidth: 600}}>
        <div className="form-header">
          <div style={{background:'#eff6ff', width:64, height:64, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', boxShadow:'0 10px 15px -3px rgba(37, 99, 235, 0.2)'}}>
             <BrainCircuit size={32} color="var(--accent)"/>
          </div>
          <h2 style={{fontSize:24, fontWeight:800, color:'var(--text-main)', textAlign:'center'}}>NEW BUG ANALYSIS</h2>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap: 15}}>
            <div>
                <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>BUG SUMMARY</label>
                <div className="spotlight-search" style={{width:'100%'}}>
                   <Terminal size={18} color="#94a3b8" />
                   <input placeholder="e.g. Application crashes when clicking Login..." value={summary} onChange={e => setSummary(e.target.value)} />
                </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:15}}>
                <div>
                    <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>COMPONENT</label>
                    <select className="sys-input" value={component} onChange={e=>setComponent(e.target.value)}>
                        {components.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>PLATFORM</label>
                    <select className="sys-input" value={platform} onChange={e=>setPlatform(e.target.value)}>
                        {platforms.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>
        </div>

        <button className="sys-btn full" onClick={predict} disabled={loading} style={{marginTop:24}}>
            {loading ? "PROCESSING..." : "PREDICT SEVERITY"}
        </button>

        {res && (
          <div className="result-box fade-in" style={{marginTop:24, background:'#f8fafc', padding:24, borderRadius:12, border:'1px solid #e2e8f0'}}>
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:15}}>
                <span className={`pill ${res.prediction}`} style={{fontSize:16, padding:'6px 14px'}}>{res.prediction}</span>
                <span style={{fontWeight:800, fontSize:18, color:'#0f172a'}}>{(res.confidence * 100).toFixed(0)}% Conf.</span>
             </div>

             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:15}}>
                <div style={{background:'white', padding:10, borderRadius:8, border:'1px solid #e2e8f0'}}>
                    <div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>DIAGNOSIS</div>
                    <div style={{fontSize:13, fontWeight:600}}>{res.diagnosis || "Structural Crash"}</div>
                </div>
                <div style={{background:'white', padding:10, borderRadius:8, border:'1px solid #e2e8f0'}}>
                    <div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>TEAM</div>
                    <div style={{fontSize:13, fontWeight:600, color:'#2563eb'}}>{res.team || "Core Engine"}</div>
                </div>
             </div>

             {!feedbackSent && !saved && (
                 <div style={{display:'flex', gap:10, paddingTop:10, borderTop:'1px dashed #cbd5e1'}}>
                     <button className="sys-btn outline" onClick={() => sendFeedback(res.prediction)} style={{flex:1, color:'#16a34a', borderColor:'#22c55e'}}>✓ Correct</button>
                     <button className="sys-btn outline" onClick={() => {const c=prompt("Correct Severity?"); if(c) sendFeedback(c.toUpperCase())}} style={{flex:1, color:'#ef4444', borderColor:'#ef4444'}}>✕ Wrong</button>
                 </div>
             )}

             {!saved && (
                 <button className="sys-btn full" onClick={saveToDb} style={{background:'#10b981', marginTop:15, color:'white'}}>
                    <CheckCircle size={16}/> SUBMIT TO DATABASE
                 </button>
             )}
             {saved && <div style={{textAlign:'center', color:'#10b981', fontWeight:700, marginTop:15}}>✓ Saved to Database</div>}
          </div>
        )}
      </div>
    </div>
  )
}