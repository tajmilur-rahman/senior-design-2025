import { useState, useEffect } from 'react';
import axios from 'axios';
import { mozillaTaxonomy } from '../javascript/taxonomy';
import {
  UploadCloud, AlertCircle, FileText, PenTool,
  Cpu, BarChart3, CheckCircle, Sparkles, Send, Trash2, X, FolderTree, Database, RefreshCw
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
  const [mode, setMode] = useState('manual'); // Default to Manual Entry
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const [summary, setSummary] = useState('');
  const [team, setTeam] = useState('');
  const [category, setCategory] = useState('');
  const [component, setComponent] = useState('');
  const [severity, setSeverity] = useState('S3');

  const [file, setFile] = useState(null);

  const [bugs, setBugs] = useState([]);
  const [batches, setBatches] = useState([]);
  const [refreshingBugs, setRefreshingBugs] = useState(false);
  const [refreshingBatches, setRefreshingBatches] = useState(false);

  // Auto-fill from Directory click
  useEffect(() => {
      if (prefill) {
          setTeam(prefill.team || '');
          setCategory(prefill.category || '');
          setComponent(prefill.component || '');
          setMode('manual');
          if (onClearPrefill) onClearPrefill();
      }
  }, [prefill, onClearPrefill]);

  const handleTeamChange = (e) => { setTeam(e.target.value); setCategory(''); setComponent(''); };
  const handleCategoryChange = (e) => { setCategory(e.target.value); setComponent(''); };

  const fetchBatches = async () => {
      setRefreshingBatches(true);
      try {
          const res = await axios.get('/api/batches');
          setBatches(res.data || []);
      } catch (err) { console.error(err); }
      finally { setRefreshingBatches(false); }
  };

  const fetchBugs = async () => {
      setRefreshingBugs(true);
      try {
          const res = await axios.get('/api/hub/explorer?limit=50&sort_key=id&sort_dir=desc');
          setBugs(res.data.bugs || []);
      } catch (err) { console.error(err); }
      finally { setRefreshingBugs(false); }
  }

  useEffect(() => {
      fetchBatches();
      fetchBugs();
  }, []);

  const handleQuickAnalyze = async () => {
    if (!summary) { setMsg({ text: "Enter a summary first.", type: "error" }); return; }
    setAnalyzing(true);
    try {
      const res = await axios.post(`/api/analyze_bug?bug_text=${encodeURIComponent(summary)}`);
      if (res.data.severity) {
          setSeverity(res.data.severity.label);
          setMsg({ text: `AI suggests ${res.data.severity.label}`, type: "success" });
      }
    } catch (err) { setMsg({ text: "AI Analysis Failed", type: "error" }); } finally { setAnalyzing(false); }
  };

  const handleManualSubmit = async () => {
      if (!summary || !component) { setMsg({ text: "Missing summary or component.", type: "error" }); return; }
      setLoading(true);
      try {
          const payload = { summary, component, severity, status: "NEW", company_id: user?.company_id };
          const response = await axios.post("/api/bug", payload);
          if (response.status === 200) {
              setMsg({ text: "Bug Logged Successfully", type: "success" });
              fetchBugs();
              setSummary(''); setTeam(''); setCategory(''); setComponent('');
              setTimeout(() => setMsg({ text: "", type: "" }), 3000);
          }
      } catch (err) { setMsg({ text: "Failed to save to database.", type: "error" }); }
      finally { setLoading(false); }
  };

  const handleDeleteBug = async (bugId) => {
      try {
          await axios.delete(`/api/bug/${bugId}`);
          setBugs(bugs.filter(b => b.id !== bugId));
          setMsg({ text: "Bug deleted", type: "success" });
      } catch (err) { setMsg({ text: "Could not delete bug", type: "error" }); }
  };

  const handleBulkUpload = async () => {
    if(!file) return;
    setLoading(true);
    setMsg({ text: "Uploading batch...", type: "loading" });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("batch_name", file.name);

    try {
      await axios.post('/api/upload_and_train', fd, { headers: { "Content-Type": "multipart/form-data" }});
      setMsg({ text: "Batch Uploaded!", type: "success" });
      setFile(null);
      fetchBatches();
      fetchBugs();
    } catch (err) {
      setMsg({ text: "Upload Failed", type: "error" });
    } finally { setLoading(false); }
  };

  return (
    <div className="page-content fade-in">
      <Toast msg={msg} onClose={() => setMsg({ text: "", type: "" })} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '24px', width: '100%', alignItems: 'start' }}>

          {/* --- COLUMN 1: MANUAL INTAKE --- */}
          <div className="sys-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '650px', minWidth: 0 }}>
            <div style={{ padding: 25, borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
                <h2 style={{ display:'flex', alignItems:'center', gap: 10, fontSize: 18, margin: 0 }}>
                    <Cpu size={20} color="var(--accent)"/> Entry Engine
                </h2>
                <div className="segmented-control" style={{ marginTop: 20 }}>
                    <button className={`segment-btn ${mode==='manual'?'active':''}`} onClick={()=>setMode('manual')}><PenTool size={14}/> Manual Entry</button>
                    <button className={`segment-btn ${mode==='bulk'?'active':''}`} onClick={()=>setMode('bulk')}><UploadCloud size={14}/> Bulk Training</button>
                </div>
            </div>

            <div style={{ padding: 30, flex: 1, overflowY: 'auto' }}>
                {mode === 'manual' ? (
                    <div className="fade-in">
                        <label className="tiny-label" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FolderTree size={14} color="var(--accent)"/> ROUTING TAXONOMY
                        </label>
                        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                            <select className="sys-input" value={team} onChange={handleTeamChange}>
                                <option value="" disabled>1. Select Team</option>
                                {Object.keys(mozillaTaxonomy).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <select className="sys-input" value={category} onChange={handleCategoryChange} disabled={!team}>
                                <option value="" disabled>2. Select Category</option>
                                {team && Object.keys(mozillaTaxonomy[team]).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select className="sys-input" value={component} onChange={e => setComponent(e.target.value)} disabled={!category} style={{ borderColor: component ? 'var(--success)' : 'var(--border)' }}>
                                <option value="" disabled>3. Final Component</option>
                                {category && mozillaTaxonomy[team][category].map(comp => <option key={comp} value={comp}>{comp}</option>)}
                            </select>
                        </div>

                        <label className="tiny-label" style={{ marginTop: 10 }}>BUG SUMMARY</label>
                        <div style={{ position: 'relative' }}>
                            <textarea className="sys-input" placeholder="Describe the issue..." value={summary} onChange={e => setSummary(e.target.value)} style={{ height: 100, marginBottom: 10, resize: 'none' }}/>
                            <button
                                onClick={handleQuickAnalyze}
                                className="sys-btn outline"
                                disabled={analyzing || !summary}
                                style={{ position: 'absolute', bottom: 20, right: 10, padding: '4px 8px', fontSize: 10, textTransform: 'none', gap: 4 }}
                            >
                                <Sparkles size={12} color="var(--accent)"/> {analyzing ? 'Scanning...' : 'AI Suggest'}
                            </button>
                        </div>

                        <label className="tiny-label">ASSIGN SEVERITY</label>
                        <select className="sys-input" value={severity} onChange={e => setSeverity(e.target.value)} style={{ marginBottom: 20 }}>
                            <option value="S1">S1 — Critical</option>
                            <option value="S2">S2 — Major</option>
                            <option value="S3">S3 — Normal</option>
                            <option value="S4">S4 — Trivial</option>
                        </select>

                        <button className="sys-btn full success" onClick={handleManualSubmit} disabled={loading} style={{ background: 'var(--success)', color: 'white' }}>
                            {loading ? 'SAVING...' : 'SAVE TO DATABASE'} <Send size={16}/>
                        </button>
                    </div>
                ) : (
                    <div className="fade-in" style={{ textAlign:'center' }}>
                        <div className="drop-area-modern" style={{ padding: 40, border: '2px dashed var(--border)', borderRadius: 16 }}>
                            <FileText size={40} color="var(--text-sec)" style={{ margin:'0 auto 15px' }}/>
                            <p style={{ fontSize: 14, color: 'var(--text-sec)' }}>Upload CSV or JSON for Bulk Training</p>
                            <input type="file" id="bulk" hidden onChange={e=>setFile(e.target.files[0])}/>
                            <label htmlFor="bulk" className="sys-btn outline" style={{ marginTop: 15, cursor:'pointer', display: 'inline-flex' }}>
                                {file ? file.name : "Select Training File"}
                            </label>
                        </div>
                        <button className="sys-btn full" onClick={handleBulkUpload} disabled={!file || loading} style={{ marginTop: 20 }}>
                            {loading ? 'PROCESSING...' : 'UPLOAD BATCH'}
                        </button>
                    </div>
                )}
            </div>
          </div>

          {/* --- COLUMN 2: RECENT ENTRIES --- */}
          <div className="sys-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '650px', minWidth: 0 }}>
              <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0, display:'flex', alignItems:'center', gap: 8, textTransform: 'uppercase' }}>
                      <Database size={16} color="var(--accent)"/> Recent Entries
                  </h2>
                  <button className="icon-btn" onClick={fetchBugs} disabled={refreshingBugs}>
                      <RefreshCw size={14} className={refreshingBugs ? "spin" : ""} />
                  </button>
              </div>
              <div className="ledger-list custom-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: 12 }}>
                  {bugs.map(b => (
                      <div key={b.id} className="fade-in" style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', borderRadius: 8, marginBottom: 8 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <span className={`pill ${b.severity} tiny`}>{b.severity}</span>
                                  <span style={{ fontSize: 10, color: 'var(--text-sec)' }}>#{b.id}</span>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.summary}</div>
                          </div>
                          <button onClick={() => handleDeleteBug(b.id)} className="icon-btn" style={{ color: 'var(--danger)' }}><Trash2 size={14}/></button>
                      </div>
                  ))}
              </div>
          </div>

          {/* --- COLUMN 3: MODEL LEDGER --- */}
          <div className="sys-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '650px', minWidth: 0 }}>
              <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0, display:'flex', alignItems:'center', gap: 8, textTransform: 'uppercase' }}>
                      <BarChart3 size={16} color="var(--success)"/> Model Ledger
                  </h2>
                  <button className="icon-btn" onClick={fetchBatches} disabled={refreshingBatches}>
                      <RefreshCw size={14} className={refreshingBatches ? "spin" : ""} />
                  </button>
              </div>
              <div className="ledger-list custom-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: 12 }}>
                  {batches.map(b => (
                      <div key={b.id} className="fade-in" style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', borderRadius: 8, marginBottom: 8 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{b.batch_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-sec)' }}>{b.bug_count} records</div>
                          </div>
                          <button onClick={() => handleDeleteBatch(b.id)} className="icon-btn" style={{ color: 'var(--danger)' }}><Trash2 size={14}/></button>
                      </div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
}