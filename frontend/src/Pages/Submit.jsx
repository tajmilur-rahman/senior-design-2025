import { useState, useEffect, useCallback } from 'react';
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
        <div style={{
            position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
            background: isError ? 'var(--danger)' : '#0f172a',
            color: 'white',
            padding: '12px 24px', borderRadius: 50, boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', gap: 12, zIndex: 9999, fontWeight: 600,
            fontSize: 13, border: `1px solid ${isError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
            animation: 'fadeInUp 0.3s cubic-bezier(0.16,1,0.3,1)'
        }}>
            {isError ? <AlertCircle size={16}/> : <CheckCircle size={16} color="#10b981"/>}
            {msg.text}
            <button onClick={onClose} style={{background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', padding:0, marginLeft: 6, display:'flex'}}><X size={14}/></button>
        </div>
    );
}

export default function Submit({ user, prefill, onClearPrefill }) {
  const [mode, setMode] = useState('manual');
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

  const showMsg = (text, type = 'success', duration = 3000) => {
      setMsg({ text, type });
      if (duration) setTimeout(() => setMsg({ text: "", type: "" }), duration);
  };

  const fetchBatches = useCallback(async () => {
      setRefreshingBatches(true);
      try {
          const res = await axios.get('/api/batches');
          setBatches(res.data || []);
      } catch (err) { console.error(err); }
      finally { setRefreshingBatches(false); }
  }, []);

  const fetchBugs = useCallback(async () => {
      setRefreshingBugs(true);
      try {
          const res = await axios.get('/api/hub/explorer?limit=50&sort_key=id&sort_dir=desc');
          setBugs(res.data.bugs || []);
      } catch (err) { console.error(err); }
      finally { setRefreshingBugs(false); }
  }, []);

  useEffect(() => {
      fetchBatches();
      fetchBugs();
  }, [fetchBatches, fetchBugs]);

  const handleQuickAnalyze = async () => {
    if (!summary) { showMsg("Enter a summary first.", "error"); return; }
    setAnalyzing(true);
    try {
      const res = await axios.post(`/api/analyze_bug?bug_text=${encodeURIComponent(summary)}`);
      if (res.data.severity) {
          setSeverity(res.data.severity.label);
          showMsg(`✦ AI suggests severity: ${res.data.severity.label}`, "success");
      }
    } catch (err) { showMsg("AI Analysis Failed", "error"); }
    finally { setAnalyzing(false); }
  };

  const handleManualSubmit = async () => {
      if (!summary || !component) { showMsg("Missing summary or component.", "error"); return; }
      setLoading(true);
      try {
          const payload = { summary, component, severity, status: "NEW", company_id: user?.company_id };
          const response = await axios.post("/api/bug", payload);
          if (response.status === 200) {
              // Optimistic prepend for real-time feel
              const newBug = {
                  id: response.data?.[0]?.bug_id || response.data?.[0]?.id || `new-${Date.now()}`,
                  summary,
                  component,
                  severity,
                  status: 'NEW',
                  _isNew: true
              };
              setBugs(prev => [newBug, ...prev].slice(0, 50));
              showMsg("✦ Bug logged successfully");
              setSummary(''); setTeam(''); setCategory(''); setComponent(''); setSeverity('S3');
              // Then re-fetch to get real IDs
              setTimeout(() => fetchBugs(), 1000);
          }
      } catch (err) {
          showMsg("Failed to save to database.", "error");
      } finally { setLoading(false); }
  };

  const handleDeleteBug = async (bugId) => {
      try {
          await axios.delete(`/api/bug/${bugId}`);
          setBugs(prev => prev.filter(b => b.id !== bugId));
          showMsg("Bug deleted");
      } catch (err) { showMsg("Could not delete bug", "error"); }
  };

  // FIX: handleDeleteBatch was missing — defined here
  const handleDeleteBatch = async (batchId) => {
      try {
          await axios.delete(`/api/batches/${batchId}`);
          setBatches(prev => prev.filter(b => b.id !== batchId));
          showMsg("Batch removed");
      } catch (err) { showMsg("Could not remove batch", "error"); }
  };

  const handleBulkUpload = async () => {
    if (!file) return;
    setLoading(true);
    showMsg("Uploading batch...", "loading", 0);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("batch_name", file.name);
    try {
      await axios.post('/api/upload_and_train', fd, { headers: { "Content-Type": "multipart/form-data" }});
      showMsg("✦ Batch uploaded & training triggered");
      setFile(null);
      fetchBatches();
      fetchBugs();
    } catch (err) {
      showMsg("Upload Failed", "error");
    } finally { setLoading(false); }
  };

  const sevColor = { S1: 'var(--danger)', S2: '#f59e0b', S3: 'var(--accent)', S4: 'var(--text-sec)' };
  const sevBg   = { S1: 'rgba(239,68,68,0.08)', S2: 'rgba(245,158,11,0.08)', S3: 'rgba(37,99,235,0.08)', S4: 'var(--hover-bg)' };

  return (
    <div className="page-content fade-in">
      <Toast msg={msg} onClose={() => setMsg({ text: "", type: "" })} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '24px', width: '100%', alignItems: 'start' }}>

        {/* ── COLUMN 1: ENTRY ENGINE ── */}
        <div className="sys-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '650px', minWidth: 0 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
              <h2 style={{ display:'flex', alignItems:'center', gap: 10, fontSize: 16, margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>
                  <Cpu size={18} color="var(--accent)"/> Entry Engine
              </h2>
              <div className="segmented-control" style={{ marginTop: 16 }}>
                  <button className={`segment-btn ${mode==='manual'?'active':''}`} onClick={()=>setMode('manual')}><PenTool size={13}/> Manual Entry</button>
                  <button className={`segment-btn ${mode==='bulk'?'active':''}`} onClick={()=>setMode('bulk')}><UploadCloud size={13}/> Bulk Training</button>
              </div>
          </div>

          <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
            {mode === 'manual' ? (
              <div className="fade-in">
                {/* Taxonomy */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FolderTree size={12} color="var(--accent)"/> Routing Taxonomy
                  </label>
                  <div style={{ display: 'grid', gap: 10 }}>
                      <select className="sys-input" value={team} onChange={handleTeamChange} style={{ height: 42, fontSize: 13 }}>
                          <option value="" disabled>1. Select Team</option>
                          {Object.keys(mozillaTaxonomy).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select className="sys-input" value={category} onChange={handleCategoryChange} disabled={!team} style={{ height: 42, fontSize: 13, opacity: team ? 1 : 0.5 }}>
                          <option value="" disabled>2. Select Category</option>
                          {team && Object.keys(mozillaTaxonomy[team]).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select className="sys-input" value={component} onChange={e => setComponent(e.target.value)} disabled={!category}
                          style={{ height: 42, fontSize: 13, opacity: category ? 1 : 0.5, borderColor: component ? 'var(--success)' : 'var(--border)', transition: '0.2s' }}>
                          <option value="" disabled>3. Final Component</option>
                          {category && mozillaTaxonomy[team][category].map(comp => <option key={comp} value={comp}>{comp}</option>)}
                      </select>
                  </div>
                </div>

                {/* Summary */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'block' }}>Bug Summary</label>
                  <div style={{ position: 'relative' }}>
                      <textarea className="sys-input" placeholder="Describe the issue in detail..." value={summary}
                          onChange={e => setSummary(e.target.value)}
                          style={{ height: 90, marginBottom: 0, resize: 'none', paddingBottom: 36, fontSize: 13, lineHeight: 1.6 }}/>
                      <button onClick={handleQuickAnalyze} disabled={analyzing || !summary}
                          style={{
                              position: 'absolute', bottom: 10, right: 10,
                              background: analyzing ? 'var(--hover-bg)' : 'var(--pill-bg)',
                              border: '1px solid rgba(37,99,235,0.3)', borderRadius: 6,
                              color: 'var(--accent)', fontSize: 11, fontWeight: 700,
                              padding: '5px 10px', cursor: analyzing ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: 5
                          }}>
                          <Sparkles size={11}/> {analyzing ? 'Scanning…' : 'AI Suggest'}
                      </button>
                  </div>
                </div>

                {/* Severity */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'block' }}>Severity</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                      {['S1','S2','S3','S4'].map(s => (
                          <button key={s} onClick={() => setSeverity(s)}
                              style={{
                                  padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                                  border: `1.5px solid ${severity === s ? sevColor[s] : 'var(--border)'}`,
                                  background: severity === s ? sevBg[s] : 'var(--bg)',
                                  color: severity === s ? sevColor[s] : 'var(--text-sec)',
                                  fontWeight: 800, fontSize: 13, transition: 'all 0.15s'
                              }}>
                              {s}
                          </button>
                      ))}
                  </div>
                </div>

                <button className="sys-btn full" onClick={handleManualSubmit} disabled={loading}
                    style={{ background: loading ? 'var(--border)' : 'var(--success)', color: 'white', height: 46 }}>
                    {loading ? <><RefreshCw size={15} className="spin"/> Saving…</> : <><Send size={15}/> Save to Database</>}
                </button>
              </div>
            ) : (
              <div className="fade-in" style={{ textAlign: 'center' }}>
                <div style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: 36, cursor: 'pointer', transition: '0.2s', background: file ? 'rgba(16,185,129,0.04)' : 'var(--bg)', borderColor: file ? 'var(--success)' : 'var(--border)' }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}>
                    {file
                      ? <><CheckCircle size={36} color="var(--success)" style={{ margin: '0 auto 12px' }}/><div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>{file.name}</div><div style={{ fontSize: 12, color: 'var(--text-sec)' }}>{(file.size/1024).toFixed(1)} KB — ready to upload</div></>
                      : <><FileText size={36} color="var(--text-sec)" style={{ margin: '0 auto 12px' }}/><div style={{ fontSize: 14, color: 'var(--text-sec)', marginBottom: 12 }}>Drag & drop or browse</div><div style={{ fontSize: 12, color: 'var(--text-sec)', opacity: 0.6 }}>CSV or JSON · max 10,000 records</div></>
                    }
                    <input type="file" id="bulk" hidden accept=".csv,.json" onChange={e => setFile(e.target.files[0])}/>
                    {!file && <label htmlFor="bulk" className="sys-btn outline" style={{ marginTop: 16, cursor: 'pointer', display: 'inline-flex', fontSize: 12, padding: '8px 16px' }}>Browse Files</label>}
                </div>
                {file && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button className="sys-btn outline" onClick={() => setFile(null)} style={{ flex: 1, height: 42, fontSize: 13 }}>Clear</button>
                        <button className="sys-btn" onClick={handleBulkUpload} disabled={loading} style={{ flex: 2, height: 42, fontSize: 13, background: 'var(--accent)', color: 'white' }}>
                            {loading ? 'Processing…' : 'Upload Batch'}
                        </button>
                    </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── COLUMN 2: RECENT ENTRIES (real-time) ── */}
        <div className="sys-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '650px', minWidth: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: 13, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', color: 'var(--text-main)' }}>
                        <Database size={15} color="var(--accent)"/> Recent Entries
                    </h2>
                    <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 2 }}>{bugs.length} records shown</div>
                </div>
                <button className="icon-btn" onClick={fetchBugs} disabled={refreshingBugs} title="Refresh">
                    <RefreshCw size={14} className={refreshingBugs ? "spin" : ""} />
                </button>
            </div>
            <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
                {bugs.length === 0 && !refreshingBugs && (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sec)', fontSize: 13 }}>
                        <Database size={28} style={{ opacity: 0.2, margin: '0 auto 10px', display: 'block' }}/> No entries yet
                    </div>
                )}
                {refreshingBugs && bugs.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40 }}><RefreshCw size={20} className="spin" color="var(--text-sec)" style={{ margin: '0 auto' }}/></div>
                )}
                {bugs.map(b => (
                    <div key={b.id} style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: b._isNew ? 'rgba(16,185,129,0.06)' : 'transparent',
                        borderRadius: 8, marginBottom: 4,
                        transition: 'background 1.5s ease',
                        animation: b._isNew ? 'fadeIn 0.4s ease-out' : 'none'
                    }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                <span style={{
                                    padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800,
                                    background: sevBg[b.severity] || 'var(--hover-bg)',
                                    color: sevColor[b.severity] || 'var(--text-sec)',
                                    border: `1px solid ${sevColor[b.severity] || 'var(--border)'}40`
                                }}>{b.severity || 'S3'}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-sec)', fontFamily: 'var(--font-mono)' }}>#{b.id}</span>
                                {b._isNew && <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 0.5 }}>NEW</span>}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{b.summary}</div>
                        </div>
                        <button onClick={() => handleDeleteBug(b.id)} className="icon-btn" style={{ color: 'var(--text-sec)', flexShrink: 0 }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-sec)'}>
                            <Trash2 size={13}/>
                        </button>
                    </div>
                ))}
            </div>
        </div>

        {/* ── COLUMN 3: MODEL LEDGER ── */}
        <div className="sys-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '650px', minWidth: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: 13, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', color: 'var(--text-main)' }}>
                        <BarChart3 size={15} color="var(--success)"/> Model Ledger
                    </h2>
                    <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 2 }}>{batches.length} training batches</div>
                </div>
                <button className="icon-btn" onClick={fetchBatches} disabled={refreshingBatches} title="Refresh">
                    <RefreshCw size={14} className={refreshingBatches ? "spin" : ""} />
                </button>
            </div>
            <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
                {batches.length === 0 && !refreshingBatches && (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sec)', fontSize: 13 }}>
                        <BarChart3 size={28} style={{ opacity: 0.2, margin: '0 auto 10px', display: 'block' }}/> No batches yet
                    </div>
                )}
                {batches.map(b => (
                    <div key={b.id} style={{
                        padding: '10px 12px', borderBottom: '1px solid var(--border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderRadius: 8, marginBottom: 4,
                    }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.batch_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-sec)', display: 'flex', gap: 10 }}>
                                <span>{b.bug_count} records</span>
                                {b.upload_time && <span>{new Date(b.upload_time).toLocaleDateString()}</span>}
                            </div>
                        </div>
                        <button onClick={() => handleDeleteBatch(b.id)} className="icon-btn" style={{ color: 'var(--text-sec)', flexShrink: 0 }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-sec)'}>
                            <Trash2 size={13}/>
                        </button>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
}
