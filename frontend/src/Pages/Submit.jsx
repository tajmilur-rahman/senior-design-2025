import { useState, useEffect } from 'react';
import axios from 'axios';
import { mozillaTaxonomy } from '../javascript/taxonomy';
import {
  UploadCloud, AlertCircle, FileText, PenTool,
  Cpu, BarChart3, CheckCircle, Sparkles, Send, Trash2, X, FolderTree
} from 'lucide-react';

function Toast({ msg, onClose }) {
    if (!msg.text) return null;
    const isError = msg.type === 'error';
    return (
        <div className="toast-notification fade-in-up" style={{
            position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
            background: isError ? 'var(--danger)' : 'var(--text-main)', color: 'var(--bg)',
            padding: '12px 24px', borderRadius: 50, boxShadow: 'var(--shadow-lg)',
            display: 'flex', alignItems: 'center', gap: 12, zIndex: 9999, fontWeight: 500
        }}>
            {isError ? <AlertCircle size={18}/> : <CheckCircle size={18}/>}
            {msg.text}
            <button onClick={onClose} style={{background:'none', border:'none', color:'inherit', opacity:0.7, cursor:'pointer', padding:0, marginLeft: 10}}><X size={14}/></button>
        </div>
    );
}

export default function Submit({ user, prefill, onClearPrefill }) {
  // UI State
  const [mode, setMode] = useState('single');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  
  // Single Entry State
  const [summary, setSummary] = useState('');
  const [team, setTeam] = useState('');
  const [category, setCategory] = useState('');
  const [component, setComponent] = useState('');
  const [severity, setSeverity] = useState('S3');
  const [aiResult, setAiResult] = useState(null);
  const [recentBugs, setRecentBugs] = useState([]);
  
  // Bulk Upload State
  const [file, setFile] = useState(null);
  const [batches, setBatches] = useState([]);

  useEffect(() => {
      if (prefill) {
          setTeam(prefill.team || ''); setCategory(prefill.category || ''); setComponent(prefill.component || '');
          if (onClearPrefill) onClearPrefill();
      }
  }, [prefill, onClearPrefill]);

  const handleTeamChange = (e) => { setTeam(e.target.value); setCategory(''); setComponent(''); };
  const handleCategoryChange = (e) => { setCategory(e.target.value); setComponent(''); };

  const getHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

  useEffect(() => { fetchBatches(); }, []);
  const fetchBatches = async () => { 
      try { 
          const res = await axios.get(`/api/batches`, getHeaders()); 
          setBatches(res.data || []); 
      } catch (err) { console.error(err); } 
  };

  const handleAnalyze = async () => {
    if (!summary || !component) { setMsg({ text: "Please provide a summary and select a component.", type: "error" }); return; }
    setLoading(true);
    try {
      const res = await axios.post(`/api/analyze_bug?bug_text=${encodeURIComponent(summary)}`, {}, getHeaders());
      setAiResult(res.data);
      if (res.data.severity) setSeverity(res.data.severity.label);
    } catch (err) { setMsg({ text: "AI Analysis Failed", type: "error" }); } finally { setLoading(false); }
  };

  const handleFinalSubmit = async () => {
    try {
        const payload = { summary, component, severity, status: "NEW", company_id: user?.company_id };
        const response = await axios.post("/api/bug", payload, getHeaders());
        if (response.status === 200) {
            setMsg({ text: "Bug Logged Successfully", type: "success" });
            const newBug = { ...response.data, summary };
            setRecentBugs([newBug, ...recentBugs]);
            setSummary(''); setTeam(''); setCategory(''); setComponent(''); setAiResult(null);
            setTimeout(() => setMsg({ text: "", type: "" }), 3000);
        }
    } catch (err) { setMsg({ text: "Failed to save to database.", type: "error" }); }
  };

  const handleDeleteBug = async (bugId) => {
      try {
          await axios.delete(`/api/bug/${bugId}`, getHeaders());
          setRecentBugs(recentBugs.filter(b => b.bug_id !== bugId));
      } catch (err) { setMsg({ text: "Could not delete bug", type: "error" }); }
  };

  // RESTORED: Bulk Upload Logic with correct multipart/form-data headers
  const handleBulkUpload = async () => {
    if(!file) return;
    setLoading(true);
    setMsg({ text: "Uploading and processing batch...", type: "loading" });
    
    const fd = new FormData();
    fd.append("file", file);
    fd.append("batch_name", file.name); 

    try {
      await axios.post('/api/upload_and_train', fd, {
          headers: {
              "Authorization": `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "multipart/form-data" 
          }
      });
      
      setMsg({ text: "Batch Processed Successfully!", type: "success" });
      setFile(null);
      fetchBatches(); 
    } catch (err) {
      console.error("Upload Error:", err);
      setMsg({ text: "Upload Failed. Check console for details.", type: "error" });
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="page-content centered-page" style={{alignItems:'flex-start', gap: 30, padding: 40}}>
      <Toast msg={msg} onClose={() => setMsg({ text: "", type: "" })} />

      <div className="sys-card" style={{flex: 1.6, padding: 0, overflow:'hidden', minHeight: 600, display:'flex', flexDirection:'column'}}>
        <div style={{padding: 30, borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)'}}>
            <h2 style={{display:'flex', alignItems:'center', gap: 10, fontSize: 20}}>
                <Cpu size={22} color="var(--accent)"/> Intelligent Intake
            </h2>
            <div className="segmented-control" style={{marginTop: 20}}>
                <button className={`segment-btn ${mode==='single'?'active':''}`} onClick={()=>setMode('single')}><PenTool size={14}/> AI Analysis</button>
                <button className={`segment-btn ${mode==='bulk'?'active':''}`} onClick={()=>setMode('bulk')}><UploadCloud size={14}/> Bulk Training</button>
            </div>
        </div>

        <div style={{padding: 30, flex: 1}}>
            {mode === 'single' ? (
                <div className="fade-in">
                    <label className="tiny-label" style={{marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6}}>
                        <FolderTree size={14} color="var(--accent)"/> ROUTING TAXONOMY
                    </label>
                    <div className="cascading-grid">
                        <select className="sys-input" value={team} onChange={handleTeamChange} style={{marginBottom: 0}}>
                            <option value="" disabled>1. Select Team</option>
                            {Object.keys(mozillaTaxonomy).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select className="sys-input" value={category} onChange={handleCategoryChange} disabled={!team} style={{marginBottom: 0}}>
                            <option value="" disabled>2. Select Category</option>
                            {team && Object.keys(mozillaTaxonomy[team]).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="sys-input" value={component} onChange={e => setComponent(e.target.value)} disabled={!category} style={{marginBottom: 0, borderColor: component ? 'var(--success)' : 'var(--border)'}}>
                            <option value="" disabled>3. Final Component</option>
                            {category && mozillaTaxonomy[team][category].map(comp => <option key={comp} value={comp}>{comp}</option>)}
                        </select>
                    </div>

                    <label className="tiny-label" style={{marginTop: 20}}>BUG SUMMARY</label>
                    <textarea className="sys-input" placeholder="Describe the issue..." value={summary} onChange={e => setSummary(e.target.value)} style={{height: 120, marginBottom: 20}}/>

                    <button className="sys-btn full" onClick={handleAnalyze} disabled={!summary || !component || loading}>
                        {loading ? 'ANALYZING...' : 'RUN AI CLASSIFICATION'} <Sparkles size={16}/>
                    </button>

                    {aiResult && (
                        <div className="ai-result-box fade-in" style={{marginTop: 25, padding: 20, background: 'var(--pill-bg)', borderRadius: 12, border: '1px solid var(--accent)'}}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <span className="tiny-label">PREDICTED SEVERITY</span>
                                <span className={`predicted-sev ${aiResult.severity.label}`}>{aiResult.severity.label}</span>
                            </div>
                            <button className="sys-btn full success" onClick={handleFinalSubmit} style={{marginTop: 20, background: 'var(--success)', color: 'white'}}>
                                CONFIRM & SAVE <Send size={16}/>
                            </button>
                        </div>
                    )}

                    {recentBugs.length > 0 && (
                        <div style={{marginTop: 40, borderTop:'1px solid var(--border)', paddingTop: 20}}>
                            <label className="tiny-label" style={{marginBottom:10, display:'block'}}>RECENT SUBMISSIONS</label>
                            <div style={{display:'flex', flexDirection:'column', gap: 10}}>
                                {recentBugs.map((b, i) => (
                                    <div key={i} className="fade-in" style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding: '10px 15px', background:'var(--card-bg)', borderRadius: 8, border: '1px solid var(--border)'}}>
                                        <div style={{display:'flex', gap: 10, alignItems:'center', overflow:'hidden'}}>
                                            <span className={`pill ${b.severity} tiny`}>{b.severity}</span>
                                            <span style={{fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth: 200}}>{b.summary}</span>
                                        </div>
                                        <button onClick={() => handleDeleteBug(b.bug_id)} style={{background:'none', border:'none', color:'var(--danger)', cursor:'pointer'}}><Trash2 size={14}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="fade-in" style={{textAlign:'center'}}>
                    <div className="drop-area-modern" style={{padding: 40, border: '2px dashed var(--border)', borderRadius: 16}}>
                        <FileText size={40} color="var(--text-sec)" style={{margin:'0 auto 15px'}}/>
                        <p style={{fontSize: 14, color: 'var(--text-sec)'}}>Upload CSV or JSON to improve model knowledge</p>
                        
                        {/* RESTORED: File Input */}
                        <input type="file" id="bulk" hidden onChange={e=>setFile(e.target.files[0])}/>
                        <label htmlFor="bulk" className="sys-btn outline" style={{marginTop: 15, cursor:'pointer'}}>
                            {file ? file.name : "Select Training File"}
                        </label>
                    </div>

                    {/* RESTORED: Upload Button */}
                    <button className="sys-btn full" onClick={handleBulkUpload} disabled={!file || loading} style={{marginTop: 20}}>
                        {loading ? 'PROCESSING...' : 'UPLOAD TO DATABASE'}
                    </button>
                </div>
            )}
        </div>
      </div>

      <div className="sys-card" style={{flex: 1, padding: 0, minHeight: 600}}>
          <div style={{padding: 25, borderBottom: '1px solid var(--border)'}}>
              <h2 style={{fontSize: 16, fontWeight: 800, display:'flex', alignItems:'center', gap: 10}}>
                  <BarChart3 size={18}/> Model Ledger
              </h2>
          </div>
          <div className="ledger-list" style={{overflowY:'auto', maxHeight: 500}}>
              {/* RESTORED: Ledger Mapping */}
              {batches.length === 0 ? (
                  <div style={{padding: 30, textAlign: 'center', color: 'var(--text-sec)', fontSize: 13}}>
                      No batches uploaded yet.
                  </div>
              ) : (
                  batches.map((b, i) => (
                      <div key={i} style={{padding: 20, borderBottom: '1px solid var(--border)', display:'flex', justifyContent:'space-between'}}>
                          <div>
                              <div style={{fontSize: 13, fontWeight: 700}}>{b.batch_name || 'Unknown Batch'}</div>
                              <div style={{fontSize: 11, color: 'var(--text-sec)'}}>{b.bug_count || 0} records</div>
                          </div>
                          <div style={{fontSize: 13, fontWeight: 800, color: 'var(--success)'}}>
                              {b.status === 'completed' ? 'Done' : 'Pending'}
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>
    </div>
  );
}