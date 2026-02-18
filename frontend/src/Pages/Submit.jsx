import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  UploadCloud, RotateCcw, AlertCircle, FileText, PenTool, 
  Cpu, Activity, Layers, BarChart3, Database, CheckCircle,
  Sparkles, ChevronRight, Send, ShieldAlert 
} from 'lucide-react';

export default function Submit({ user, onNavigate }) {
  // UI State
  const [mode, setMode] = useState('single');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  
  // Single Entry / AI State
  const [summary, setSummary] = useState('');
  const [component, setComponent] = useState('Core');
  const [severity, setSeverity] = useState('S3');
  const [aiResult, setAiResult] = useState(null);

  // Bulk / Training State
  const [file, setFile] = useState(null);
  const [batches, setBatches] = useState([]);

  useEffect(() => { fetchBatches(); }, []);

  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
  });

  const fetchBatches = async () => {
    try {
      const res = await axios.get(`/api/batches`, getHeaders());
      setBatches(res.data);
    } catch (err) { console.error("History error", err); }
  };

  const handleAnalyze = async () => {
    if (!summary) return;
    setLoading(true);
    try {
      const res = await axios.post(
        `/api/analyze_bug?bug_text=${encodeURIComponent(summary)}`, 
        {}, 
        getHeaders()
      );
      setAiResult(res.data);
      if (res.data.severity) setSeverity(res.data.severity.label);
    } catch (err) {
      setMsg({ text: "AI Analysis Failed", type: "error" });
    } finally { setLoading(false); }
  };

  const handleFinalSubmit = async () => {
    try {
        const payload = {
            bug: { summary, component, severity, status: "NEW" },
            company_id: user.company_id
        };
        const response = await axios.post("/api/bug", payload, getHeaders());
        if (response.status === 200) {
            setMsg({ text: "Bug Logged Successfully!", type: "success" });
            setTimeout(() => {
                setMsg({ text: "", type: "" });
                onNavigate('database');
            }, 2000); 
        }
    } catch (err) {
        setMsg({ text: "Failed to save to database.", type: "error" });
    }
  };

  const handleBulkUpload = async () => {
    if(!file) return;
    setLoading(true);
    setMsg({ text: "Retraining Neural Network...", type: "loading" });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("company_id", user.company_id);

    try {
      await axios.post('/api/upload_and_train', fd, getHeaders());
      setMsg({ text: "Model Retrained Successfully", type: "success" });
      setFile(null);
      fetchBatches();
    } catch (err) {
      setMsg({ text: "Training Failed", type: "error" });
    } finally { setLoading(false); }
  };

  return (
    <div className="page-content centered-page" style={{alignItems:'flex-start', gap: 30, padding: 40}}>
      
      {/* LEFT: ACTION STATION */}
      <div className="sys-card" style={{flex: 1.6, padding: 0, overflow:'hidden', minHeight: 600, display:'flex', flexDirection:'column'}}>
        <div style={{padding: 30, borderBottom: '1px solid var(--border)', background: '#f8fafc'}}>
            <h2 style={{display:'flex', alignItems:'center', gap: 10, fontSize: 20}}>
                <Cpu size={22} color="var(--accent)"/> Intelligent Intake
            </h2>
            <div className="segmented-control" style={{marginTop: 20}}>
                <button className={`segment-btn ${mode==='single'?'active':''}`} onClick={()=>setMode('single')}>
                    <PenTool size={14}/> AI Analysis
                </button>
                <button className={`segment-btn ${mode==='bulk'?'active':''}`} onClick={()=>setMode('bulk')}>
                    <UploadCloud size={14}/> Bulk Training
                </button>
            </div>
        </div>

        <div style={{padding: 30, flex: 1}}>
            {mode === 'single' ? (
                <div className="fade-in">
                    <label className="tiny-label">BUG SUMMARY</label>
                    <textarea 
                        className="sys-input" 
                        placeholder="Describe the issue..."
                        value={summary}
                        onChange={e => setSummary(e.target.value)}
                        style={{height: 120, marginBottom: 20}}
                    />
                    <button className="sys-btn full" onClick={handleAnalyze} disabled={!summary || loading}>
                        {loading ? 'ANALYZING...' : 'RUN AI CLASSIFICATION'} <Sparkles size={16}/>
                    </button>

                    {aiResult && (
                        <div className="ai-result-box fade-in" style={{marginTop: 25, padding: 20, background: '#f0f9ff', borderRadius: 12, border: '1px solid #bae6fd'}}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <span className="tiny-label">PREDICTED SEVERITY</span>
                                <span className={`predicted-sev ${aiResult.severity.label}`}>{aiResult.severity.label}</span>
                            </div>

                            {msg.text && (
                                <div className={`alert-banner-modern ${msg.type}`} style={{marginTop: 15, padding: '10px', borderRadius: '8px', textAlign: 'center', fontSize: '13px', fontWeight: '600'}}>
                                    {msg.text}
                                </div>
                            )}

                            <button className="sys-btn full success" onClick={handleFinalSubmit} style={{marginTop: 20, background: '#10b981'}} disabled={msg.type === 'success'}>
                                CONFIRM & SAVE <Send size={16}/>
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="fade-in" style={{textAlign:'center'}}>
                    <div className="drop-area-modern" style={{padding: 40, border: '2px dashed #cbd5e1', borderRadius: 16}}>
                        <FileText size={40} color="#94a3b8" style={{margin:'0 auto 15px'}}/>
                        <p style={{fontSize: 14, color: 'var(--text-sec)'}}>Upload CSV to improve model knowledge</p>
                        <input type="file" id="bulk" hidden onChange={e=>setFile(e.target.files[0])}/>
                        <label htmlFor="bulk" className="sys-btn outline" style={{marginTop: 15, cursor:'pointer'}}>
                            {file ? file.name : "Select Training File"}
                        </label>
                    </div>
                    <button className="sys-btn full" onClick={handleBulkUpload} disabled={!file || loading} style={{marginTop: 20}}>
                        {loading ? 'TRAINING...' : 'INITIATE RETRAINING'}
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* RIGHT: MODEL LEDGER */}
      <div className="sys-card" style={{flex: 1, padding: 0, minHeight: 600}}>
          <div style={{padding: 25, borderBottom: '1px solid var(--border)'}}>
              <h2 style={{fontSize: 16, fontWeight: 800, display:'flex', alignItems:'center', gap: 10}}>
                  <BarChart3 size={18}/> Model Ledger
              </h2>
          </div>
          <div className="ledger-list" style={{overflowY:'auto', maxHeight: 500}}>
              {batches.map((b) => (
                  <div key={b.batch_id} style={{padding: 20, borderBottom: '1px solid #f1f5f9', display:'flex', justifyContent:'space-between'}}>
                      <div>
                          <div style={{fontSize: 13, fontWeight: 700}}>{b.filename}</div>
                          <div style={{fontSize: 11, color: '#94a3b8'}}>{b.record_count} records • {b.upload_time}</div>
                      </div>
                      <div style={{fontSize: 13, fontWeight: 800, color: '#16a34a'}}>{Math.round(b.accuracy || 0)}%</div>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
}