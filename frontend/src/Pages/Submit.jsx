import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { mozillaTaxonomy } from '../javascript/taxonomy';
import {
  UploadCloud, AlertCircle, FileText, PenTool,
  Cpu, BarChart3, CheckCircle, Sparkles, Send, Trash2, X,
  FolderTree, Database, RefreshCw, ArrowRight, Info
} from 'lucide-react';
import { GlossaryDrawer, GlossaryTrigger, SEVERITY_DEFS } from '../Components/Glossary';

function Toast({ msg, onClose }) {
  if (!msg.text) return null;
  const isError = msg.type === 'error';
  return (
    <div style={{
      position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
      background: isError ? 'var(--danger)' : '#0f172a', color: 'white',
      padding: '12px 24px', borderRadius: 50, boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: 12, zIndex: 9999, fontWeight: 600,
      fontSize: 13, border: `1px solid ${isError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
      animation: 'fadeInUp 0.3s cubic-bezier(0.16,1,0.3,1)',
    }}>
      {isError ? <AlertCircle size={15} /> : <CheckCircle size={15} color="#10b981" />}
      {msg.text}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 0, marginLeft: 6, display: 'flex' }}><X size={13} /></button>
    </div>
  );
}

const PIPELINE_STEPS = [
  { label: 'Submitted',   sub: 'Bug logged',              color: '#6366f1' },
  { label: 'NEW',         sub: 'Awaiting triage',         color: '#3b82f6' },
  { label: 'UNCONFIRMED', sub: 'Pending reproduction',    color: '#f59e0b' },
  { label: 'CONFIRMED',   sub: 'Verified & assigned',     color: '#10b981' },
  { label: 'RESOLVED',    sub: 'Fix implemented',         color: '#10b981' },
  { label: 'VERIFIED',    sub: 'QA sign-off',             color: '#6366f1' },
];

function PipelineStrip() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <button onClick={() => setExpanded(e => !e)} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none',
        border: 'none', cursor: 'pointer', padding: 0,
        fontSize: 11, fontWeight: 700, color: 'var(--text-sec)',
        fontFamily: 'var(--font-head)', textTransform: 'uppercase', letterSpacing: 0.6,
      }}>
        <Info size={12} color="var(--accent)" />
        Bug lifecycle pipeline
        <span style={{ color: 'var(--accent)', fontSize: 10, marginLeft: 2 }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="fade-in" style={{ marginTop: 12, padding: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: '0 0 14px', lineHeight: 1.6 }}>
            A bug moves through these stages from the moment it is reported until it is closed.
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto' }}>
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 90 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${step.color}18`, border: `2px solid ${step.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: step.color }}>{i + 1}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-main)', textAlign: 'center', fontFamily: 'var(--font-mono)', lineHeight: 1.3 }}>{step.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-sec)', textAlign: 'center', marginTop: 2, lineHeight: 1.4, maxWidth: 82 }}>{step.sub}</span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 14, flexShrink: 0 }}>
                    <div style={{ width: 18, height: 1.5, background: 'var(--border)' }} />
                    <ArrowRight size={10} color="var(--text-sec)" style={{ marginLeft: -2 }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const sevColor = { S1: 'var(--danger)', S2: '#f59e0b', S3: 'var(--accent)', S4: 'var(--text-sec)' };
const sevBg   = { S1: 'rgba(239,68,68,0.08)', S2: 'rgba(245,158,11,0.08)', S3: 'rgba(37,99,235,0.08)', S4: 'var(--hover-bg)' };

export default function Submit({ user, prefill, onClearPrefill }) {
  const [mode, setMode] = useState('manual');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [showGlossary, setShowGlossary] = useState(false);
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
  const newBugIdsRef = useRef(new Set());
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    if (prefill) {
      setTeam(prefill.team || ''); setCategory(prefill.category || ''); setComponent(prefill.component || '');
      setMode('manual'); if (onClearPrefill) onClearPrefill();
    }
  }, [prefill, onClearPrefill]);

  const handleTeamChange = (e) => { setTeam(e.target.value); setCategory(''); setComponent(''); };
  const handleCategoryChange = (e) => { setCategory(e.target.value); setComponent(''); };
  const showMsg = (text, type = 'success', duration = 3500) => {
    setMsg({ text, type }); if (duration) setTimeout(() => setMsg({ text: '', type: '' }), duration);
  };

  const fetchBatches = useCallback(async () => {
    setRefreshingBatches(true);
    try { const res = await axios.get('/api/batches'); setBatches(res.data || []); }
    catch (err) { console.error(err); } finally { setRefreshingBatches(false); }
  }, []);

  const fetchBugs = useCallback(async (silent = false) => {
    if (!silent) setRefreshingBugs(true);
    try {
      const res = await axios.get('/api/hub/explorer?limit=50&sort_key=id&sort_dir=desc');
      const freshBugs = res.data.bugs || [];
      setBugs(prev => {
        const freshIds = new Set(freshBugs.map(b => String(b.id)));
        const pending = prev.filter(b => String(b.id).startsWith('pending-') && !freshIds.has(String(b.id)));
        const merged = freshBugs.map(b => newBugIdsRef.current.has(String(b.id)) ? { ...b, _isNew: true } : b);
        return [...pending, ...merged];
      });
    } catch (err) { console.error(err); } finally { if (!silent) setRefreshingBugs(false); }
  }, []);

  useEffect(() => { fetchBatches(); fetchBugs(); }, [fetchBatches, fetchBugs]);

  const startFastRefresh = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    let count = 0;
    pollIntervalRef.current = setInterval(() => { fetchBugs(true); count++; if (count >= 6) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; } }, 2000);
  }, [fetchBugs]);

  useEffect(() => () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); }, []);

  const handleQuickAnalyze = async () => {
    if (!summary) { showMsg('Enter a summary first.', 'error'); return; }
    setAnalyzing(true);
    try {
      const res = await axios.post(`/api/analyze_bug?bug_text=${encodeURIComponent(summary)}`);
      if (res.data.severity) { setSeverity(res.data.severity.label); showMsg(`AI suggests: ${res.data.severity.label}`); }
    } catch { showMsg('AI analysis failed.', 'error'); } finally { setAnalyzing(false); }
  };

  const handleManualSubmit = async () => {
    if (!summary) { showMsg('Please enter a bug summary.', 'error'); return; }
    if (!component) { showMsg('Please select a component.', 'error'); return; }
    setLoading(true);
    const tempId = `pending-${Date.now()}`;
    setBugs(prev => [{ id: tempId, summary, component, severity, status: 'NEW', _isNew: true }, ...prev].slice(0, 50));
    try {
      const response = await axios.post('/api/bug', { summary, component, severity, status: 'NEW' });
      const realId = response.data?.[0]?.bug_id || response.data?.[0]?.id;
      if (realId) {
        newBugIdsRef.current.add(String(realId));
        setBugs(prev => prev.map(b => b.id === tempId ? { id: realId, summary, component, severity, status: 'NEW', _isNew: true } : b));
        setTimeout(() => { newBugIdsRef.current.delete(String(realId)); setBugs(prev => prev.map(b => String(b.id) === String(realId) ? { ...b, _isNew: false } : b)); }, 8000);
      } else { setBugs(prev => prev.filter(b => b.id !== tempId)); }
      showMsg('Bug logged successfully');
      setSummary(''); setTeam(''); setCategory(''); setComponent(''); setSeverity('S3');
      startFastRefresh();
    } catch { setBugs(prev => prev.filter(b => b.id !== tempId)); showMsg('Failed to save. Please try again.', 'error'); }
    finally { setLoading(false); }
  };

  const handleDeleteBug = async (bugId) => {
    setBugs(prev => prev.filter(b => b.id !== bugId)); newBugIdsRef.current.delete(String(bugId));
    try { await axios.delete(`/api/bug/${bugId}`); showMsg('Bug removed'); }
    catch { showMsg('Could not remove bug', 'error'); fetchBugs(); }
  };

  const handleDeleteBatch = async (batchId) => {
    setBatches(prev => prev.filter(b => b.id !== batchId));
    try { await axios.delete(`/api/batches/${batchId}`); showMsg('Batch removed'); }
    catch { showMsg('Could not remove batch', 'error'); fetchBatches(); }
  };

  const handleBulkUpload = async () => {
    if (!file) return; setLoading(true); showMsg('Uploading…', 'loading', 0);
    const fd = new FormData(); fd.append('file', file); fd.append('batch_name', file.name);
    try {
      const res = await axios.post('/api/upload_and_train', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showMsg(`Uploaded ${res.data?.records_processed || '?'} records`); setFile(null);
      await fetchBatches(); await fetchBugs();
    } catch (err) { showMsg(err.response?.data?.detail || 'Upload failed', 'error'); }
    finally { setLoading(false); }
  };

  const selectedSevDef = SEVERITY_DEFS.find(d => d.code === severity);

  return (
    <div className="page-content fade-in">
      <Toast msg={msg} onClose={() => setMsg({ text: '', type: '' })} />
      {showGlossary && <GlossaryDrawer onClose={() => setShowGlossary(false)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: -0.5 }}>Submit a bug</h1>
          <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: '4px 0 0' }}>Log a new bug report, or upload a batch for bulk ingestion and model training.</p>
        </div>
        <GlossaryTrigger onClick={() => setShowGlossary(true)} label="Severity & status guide" />
      </div>

      <PipelineStrip />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 24, width: '100%', alignItems: 'start' }}>

        {/* Column 1 */}
        <div className="sys-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 650, minWidth: 0 }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>
              <Cpu size={16} color="var(--accent)" /> Bug report
            </h2>
            <div className="segmented-control" style={{ marginTop: 14 }}>
              <button className={`segment-btn ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}><PenTool size={12} /> Manual</button>
              <button className={`segment-btn ${mode === 'bulk' ? 'active' : ''}`} onClick={() => setMode('bulk')}><UploadCloud size={12} /> Bulk import</button>
            </div>
          </div>
          <div style={{ padding: 22, flex: 1, overflowY: 'auto' }}>
            {mode === 'manual' ? (
              <div className="fade-in">
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FolderTree size={11} color="var(--accent)" /> Component (required)
                  </label>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <select className="sys-input" value={team} onChange={handleTeamChange} style={{ height: 40, fontSize: 13 }}>
                      <option value="" disabled>1. Select team</option>
                      {Object.keys(mozillaTaxonomy).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select className="sys-input" value={category} onChange={handleCategoryChange} disabled={!team} style={{ height: 40, fontSize: 13, opacity: team ? 1 : 0.45 }}>
                      <option value="" disabled>2. Select category</option>
                      {team && Object.keys(mozillaTaxonomy[team]).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select className="sys-input" value={component} onChange={e => setComponent(e.target.value)} disabled={!category}
                      style={{ height: 40, fontSize: 13, opacity: category ? 1 : 0.45, borderColor: component ? 'var(--success)' : 'var(--border)', transition: '0.2s' }}>
                      <option value="" disabled>3. Select component</option>
                      {category && mozillaTaxonomy[team][category].map(comp => <option key={comp} value={comp}>{comp}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7, display: 'block' }}>Summary (required)</label>
                  <div style={{ position: 'relative' }}>
                    <textarea className="sys-input" placeholder="Describe the issue clearly and concisely…" value={summary} onChange={e => setSummary(e.target.value)} style={{ height: 85, marginBottom: 0, resize: 'none', paddingBottom: 34, fontSize: 13, lineHeight: 1.6 }} />
                    <button onClick={handleQuickAnalyze} disabled={analyzing || !summary} style={{ position: 'absolute', bottom: 8, right: 8, background: analyzing ? 'var(--hover-bg)' : 'var(--pill-bg)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: 6, color: analyzing ? 'var(--text-sec)' : 'var(--accent)', fontSize: 11, fontWeight: 700, padding: '4px 9px', cursor: analyzing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {analyzing ? <RefreshCw size={10} className="spin" /> : <Sparkles size={10} />}
                      {analyzing ? 'Analysing…' : 'AI suggest'}
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7, display: 'block' }}>Severity</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
                    {SEVERITY_DEFS.map(s => (
                      <button key={s.code} onClick={() => setSeverity(s.code)} style={{ padding: '9px 0', borderRadius: 7, cursor: 'pointer', border: `1.5px solid ${severity === s.code ? s.color : 'var(--border)'}`, background: severity === s.code ? s.bg : 'var(--bg)', color: severity === s.code ? s.color : 'var(--text-sec)', fontWeight: 800, fontSize: 13, transition: 'all 0.15s' }}>
                        {s.code}
                      </button>
                    ))}
                  </div>
                  {selectedSevDef && (
                    <div style={{ padding: '8px 10px', background: selectedSevDef.bg, border: `1px solid ${selectedSevDef.border}`, borderRadius: 7, fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.6 }}>
                      <strong style={{ color: selectedSevDef.color }}>{selectedSevDef.label}</strong> — {selectedSevDef.desc}
                    </div>
                  )}
                </div>
                <button className="sys-btn full" onClick={handleManualSubmit} disabled={loading} style={{ background: loading ? 'var(--border)' : 'var(--success)', color: 'white', height: 44, transition: '0.2s' }}>
                  {loading ? <><RefreshCw size={14} className="spin" /> Saving…</> : <><Send size={14} /> Submit bug report</>}
                </button>
              </div>
            ) : (
              <div className="fade-in" style={{ textAlign: 'center' }}>
                <div style={{ border: `2px dashed ${file ? 'var(--success)' : 'var(--border)'}`, borderRadius: 12, padding: 32, cursor: 'pointer', transition: '0.2s', background: file ? 'rgba(16,185,129,0.04)' : 'var(--bg)' }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}>
                  {file ? (<><CheckCircle size={32} color="var(--success)" style={{ margin: '0 auto 10px' }} /><div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 3 }}>{file.name}</div><div style={{ fontSize: 12, color: 'var(--text-sec)' }}>{(file.size / 1024).toFixed(1)} KB</div></>) : (<><FileText size={32} color="var(--text-sec)" style={{ margin: '0 auto 10px' }} /><div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 10 }}>Drag & drop or browse</div><div style={{ fontSize: 11, color: 'var(--text-sec)', opacity: 0.6 }}>JSON · max 10,000 records</div></>)}
                  <input type="file" id="bulk" hidden accept=".json" onChange={e => setFile(e.target.files[0])} />
                  {!file && <label htmlFor="bulk" className="sys-btn outline" style={{ marginTop: 14, cursor: 'pointer', display: 'inline-flex', fontSize: 12, padding: '7px 14px' }}>Browse files</label>}
                </div>
                <div style={{ marginTop: 14, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 13, textAlign: 'left' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>Expected JSON format</div>
                  <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--success)', margin: 0, lineHeight: 1.7 }}>{`[\n  {\n    "summary": "Login crashes on Safari",\n    "severity": "S1",\n    "component": "Frontend",\n    "predicted_severity": "S2",\n    "actual_severity": "S1"\n  }\n]`}</pre>
                  <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: '8px 0 0', lineHeight: 1.6 }}>Uploaded records are stored in the database and trigger model retraining. Source is labelled <strong>Bulk import</strong>.</p>
                </div>
                {file && (<div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="sys-btn outline" onClick={() => setFile(null)} style={{ flex: 1, height: 40, fontSize: 12 }}>Clear</button><button className="sys-btn" onClick={handleBulkUpload} disabled={loading} style={{ flex: 2, height: 40, fontSize: 12, background: loading ? 'var(--border)' : 'var(--accent)', color: 'white', transition: '0.2s' }}>{loading ? <><RefreshCw size={13} className="spin" /> Processing…</> : 'Upload & train'}</button></div>)}
              </div>
            )}
          </div>
        </div>

        {/* Column 2 */}
        <div className="sys-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 650, minWidth: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><h2 style={{ fontSize: 12, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', color: 'var(--text-main)', letterSpacing: 0.5 }}><Database size={13} color="var(--accent)" /> Recent entries</h2><div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 2 }}>{bugs.length} records shown</div></div>
            <button className="icon-btn" onClick={() => fetchBugs()} disabled={refreshingBugs} title="Refresh"><RefreshCw size={13} className={refreshingBugs ? 'spin' : ''} /></button>
          </div>
          <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: '6px 10px' }}>
            {bugs.length === 0 && !refreshingBugs && (<div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sec)', fontSize: 12 }}><Database size={26} style={{ opacity: 0.15, margin: '0 auto 10px', display: 'block' }} />No entries yet.</div>)}
            {refreshingBugs && bugs.length === 0 && (<div style={{ textAlign: 'center', padding: 40 }}><RefreshCw size={18} className="spin" color="var(--text-sec)" style={{ margin: '0 auto' }} /></div>)}
            {bugs.map(b => (
              <div key={b.id} style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: b._isNew ? 'rgba(16,185,129,0.06)' : 'transparent', borderRadius: 7, marginBottom: 3, borderLeft: b._isNew ? '2px solid var(--success)' : '2px solid transparent' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 800, background: sevBg[b.severity] || 'var(--hover-bg)', color: sevColor[b.severity] || 'var(--text-sec)' }}>{b.severity || 'S3'}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-sec)', fontFamily: 'var(--font-mono)' }}>{String(b.id).startsWith('pending-') ? 'saving…' : `#${b.id}`}</span>
                    {b._isNew && <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--success)', background: 'rgba(16,185,129,0.15)', padding: '1px 5px', borderRadius: 3 }}>NEW</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>{b.summary}</div>
                </div>
                <button onClick={() => handleDeleteBug(b.id)} className="icon-btn" style={{ color: 'var(--text-sec)', flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-sec)'}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3 */}
        <div className="sys-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 650, minWidth: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><h2 style={{ fontSize: 12, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', color: 'var(--text-main)', letterSpacing: 0.5 }}><BarChart3 size={13} color="var(--success)" /> Training batches</h2><div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 2 }}>{batches.length} uploaded</div></div>
            <button className="icon-btn" onClick={fetchBatches} disabled={refreshingBatches} title="Refresh"><RefreshCw size={13} className={refreshingBatches ? 'spin' : ''} /></button>
          </div>
          <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: '6px 10px' }}>
            {batches.length === 0 && !refreshingBatches && (<div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sec)', fontSize: 12 }}><BarChart3 size={26} style={{ opacity: 0.15, margin: '0 auto 10px', display: 'block' }} />No training batches yet.</div>)}
            {batches.map(b => (
              <div key={b.id} style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 7, marginBottom: 3 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.batch_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-sec)', display: 'flex', gap: 8 }}>
                    <span>{b.bug_count} records</span>
                    {b.upload_time && <span>{new Date(b.upload_time).toLocaleDateString()}</span>}
                    {b.status && <span style={{ color: b.status === 'completed' ? 'var(--success)' : 'var(--text-sec)', fontWeight: 600, textTransform: 'capitalize' }}>{b.status}</span>}
                  </div>
                </div>
                <button onClick={() => handleDeleteBatch(b.id)} className="icon-btn" style={{ color: 'var(--text-sec)', flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-sec)'}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}