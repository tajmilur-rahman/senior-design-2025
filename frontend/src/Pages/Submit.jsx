import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { mozillaTaxonomy } from '../javascript/taxonomy';
import {
  UploadCloud, AlertCircle, FileText, PenTool,
  Cpu, CheckCircle, Send, Trash2, X,
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
  { label: 'Submitted',   sub: 'Bug logged',          color: '#6366f1' },
  { label: 'NEW',         sub: 'Awaiting triage',     color: '#3b82f6' },
  { label: 'UNCONFIRMED', sub: 'Needs reproduction',  color: '#f59e0b' },
  { label: 'CONFIRMED',   sub: 'Verified & assigned', color: '#10b981' },
  { label: 'RESOLVED',    sub: 'Fix implemented',     color: '#10b981' },
  { label: 'VERIFIED',    sub: 'QA sign-off',         color: '#6366f1' },
];

function PipelineStrip() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <button onClick={() => setExpanded(e => !e)} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none',
        border: 'none', cursor: 'pointer', padding: 0,
        fontSize: 12, fontWeight: 700, color: 'var(--text-sec)',
        fontFamily: 'var(--font-head)', textTransform: 'uppercase', letterSpacing: 0.6,
      }}>
        <Info size={13} color="var(--accent)" />
        Bug Lifecycle Pipeline
        <span style={{ color: 'var(--accent)', fontSize: 11, marginLeft: 2 }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="fade-in" style={{ marginTop: 14, padding: '20px 24px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: '0 0 20px', lineHeight: 1.7 }}>
            Every bug moves through these stages — from first report to final close.
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 110 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${step.color}18`, border: `2px solid ${step.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: step.color }}>{i + 1}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', textAlign: 'center', fontFamily: 'var(--font-mono)', lineHeight: 1.3 }}>{step.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-sec)', textAlign: 'center', marginTop: 3, lineHeight: 1.4, maxWidth: 96 }}>{step.sub}</span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 17, flexShrink: 0 }}>
                    <div style={{ width: 14, height: 1.5, background: 'var(--border)' }} />
                    <ArrowRight size={13} color="var(--border)" />
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

function SevBadge({ sev }) {
  const map = {
    S1: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
    S2: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
    S3: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
    S4: { bg: 'var(--hover-bg)', color: 'var(--text-sec)', border: 'var(--border)' },
  };
  const s = map[sev] || map.S4;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 800, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
      {sev || '—'}
    </span>
  );
}

export default function SubmitTab({ user, prefill, onClearPrefill }) {
  const [mode, setMode] = useState('manual');
  const [team, setTeam] = useState('');
  const [category, setCategory] = useState('');
  const [component, setComponent] = useState('');
  const [summary, setSummary] = useState('');
  const [severity, setSeverity] = useState('S3');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [file, setFile] = useState(null);
  const [bugs, setBugs] = useState([]);
  const [batches, setBatches] = useState([]);
  const [showGlossary, setShowGlossary] = useState(false);
  const [refreshingBugs, setRefreshingBugs] = useState(false);
  const pollIntervalRef = useRef(null);
  const newBugIdsRef = useRef(new Set());

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
  };

  useEffect(() => {
    if (prefill) {
      setSummary(prefill.summary || '');
      setSeverity(prefill.severity || 'S3');
      if (prefill.component) setComponent(prefill.component);
      onClearPrefill?.();
    }
  }, [prefill, onClearPrefill]);

  const teams = Object.keys(mozillaTaxonomy || {});
  const categories = team ? Object.keys(mozillaTaxonomy[team] || {}) : [];
  const components = team && category ? (mozillaTaxonomy[team]?.[category] || []) : [];

  const handleTeamChange = (e) => { setTeam(e.target.value); setCategory(''); setComponent(''); };
  const handleCategoryChange = (e) => { setCategory(e.target.value); setComponent(''); };

  const fetchBatches = useCallback(async () => {
    try { const res = await axios.get('/api/batches'); setBatches(res.data || []); }
    catch (err) { console.error(err); }
  }, []);

  // Use /api/hub/explorer — the correct endpoint (not /api/bugs which 404s)
  const fetchBugs = useCallback(async (silent = false) => {
    if (!silent) setRefreshingBugs(true);
    try {
      const res = await axios.get('/api/hub/explorer?limit=50&sort_key=id&sort_dir=desc');
      const fetched = res.data?.bugs || [];
      setBugs(prev => {
        const pending = prev.filter(b => String(b.id).startsWith('pending-'));
        const merged = fetched.map(b => newBugIdsRef.current.has(String(b.id)) ? { ...b, _isNew: true } : b);
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
    setBugs(prev => prev.filter(b => b.id !== bugId));
    newBugIdsRef.current.delete(String(bugId));
    try {
      await axios.delete(`/api/bug/${bugId}`);
      showMsg('Bug removed');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Could not remove bug';
      showMsg(msg, 'error');
      fetchBugs();
    }
  };

  const handleDeleteBatch = async (batchId) => {
    setBatches(prev => prev.filter(b => b.id !== batchId));
    try { await axios.delete(`/api/batches/${batchId}`); showMsg('Batch removed'); }
    catch { showMsg('Could not remove batch', 'error'); fetchBatches(); }
  };

  const handleBulkUpload = async () => {
    if (!file) return; setLoading(true); showMsg('Uploading…');
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
        <div className="sys-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>
              <Cpu size={16} color="var(--accent)" /> Bug report
            </h2>
            <div className="segmented-control" style={{ marginTop: 14 }}>
              <button className={`segment-btn ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}><PenTool size={12} /> Manual</button>
              <button className={`segment-btn ${mode === 'bulk' ? 'active' : ''}`} onClick={() => setMode('bulk')}><UploadCloud size={12} /> Bulk import</button>
            </div>
          </div>

          <div style={{ padding: '24px 22px', flex: 1, overflowY: 'auto' }}>
            {mode === 'manual' ? (
              <div className="fade-in">

                {/* Component — clearly separated stacked selects */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                    <FolderTree size={13} color="var(--accent)" />
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1 }}>Component</span>
                    <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 700, background: 'rgba(239,68,68,0.08)', padding: '1px 6px', borderRadius: 4 }}>required</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-sec)', marginBottom: 6 }}>Team</label>
                      <select className="sys-input" value={team} onChange={handleTeamChange}
                        style={{ height: 44, fontSize: 13, width: '100%', cursor: 'pointer' }}>
                        <option value="" disabled>Select a team…</option>
                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-sec)', marginBottom: 6 }}>Category</label>
                      <select className="sys-input" value={category} onChange={handleCategoryChange}
                        disabled={!team}
                        style={{ height: 44, fontSize: 13, width: '100%', cursor: team ? 'pointer' : 'not-allowed', opacity: !team ? 0.45 : 1 }}>
                        <option value="" disabled>{team ? 'Select a category…' : 'Select a team first'}</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-sec)', marginBottom: 6 }}>Component</label>
                      <select className="sys-input" value={component} onChange={e => setComponent(e.target.value)}
                        disabled={!category}
                        style={{ height: 44, fontSize: 13, width: '100%', cursor: category ? 'pointer' : 'not-allowed', opacity: !category ? 0.45 : 1 }}>
                        <option value="" disabled>{category ? 'Select a component…' : 'Select a category first'}</option>
                        {components.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1 }}>Summary</span>
                    <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 700, background: 'rgba(239,68,68,0.08)', padding: '1px 6px', borderRadius: 4 }}>required</span>
                  </div>
                  <textarea className="sys-input"
                    placeholder="Describe the bug — what happened, what was expected, and how to reproduce it."
                    value={summary} onChange={e => setSummary(e.target.value)} rows={4}
                    style={{ resize: 'vertical', fontSize: 13, lineHeight: 1.6, width: '100%', boxSizing: 'border-box' }} />
                </div>

                {/* Severity */}
                <div style={{ marginBottom: 26 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Severity</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {SEVERITY_DEFS.map(def => (
                      <button key={def.code} onClick={() => setSeverity(def.code)} style={{
                        padding: '10px 6px', borderRadius: 8,
                        border: `1.5px solid ${severity === def.code ? def.border : 'var(--border)'}`,
                        background: severity === def.code ? def.bg : 'var(--hover-bg)',
                        cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: severity === def.code ? def.color : 'var(--text-sec)' }}>{def.code}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-sec)', marginTop: 2 }}>{def.label}</div>
                      </button>
                    ))}
                  </div>
                  {selectedSevDef && (
                    <p style={{ fontSize: 12, color: 'var(--text-sec)', margin: '10px 0 0', lineHeight: 1.6, padding: '9px 12px', background: selectedSevDef.bg, borderRadius: 7, borderLeft: `3px solid ${selectedSevDef.color}` }}>
                      {selectedSevDef.desc}
                    </p>
                  )}
                </div>

                <button className="sys-btn" onClick={handleManualSubmit}
                  disabled={loading || !summary || !component}
                  style={{ width: '100%', justifyContent: 'center', padding: '12px 0', fontSize: 13, opacity: (!summary || !component) ? 0.5 : 1 }}>
                  {loading ? <><RefreshCw size={13} className="spin" /> Submitting…</> : <><Send size={13} /> Submit bug</>}
                </button>
              </div>
            ) : (
              <div className="fade-in">
                <div style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: 28, textAlign: 'center', marginBottom: 18, cursor: 'pointer', background: file ? 'var(--hover-bg)' : 'transparent' }}
                  onClick={() => document.getElementById('file-upload-input').click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}>
                  <UploadCloud size={28} color="var(--accent)" style={{ marginBottom: 10, opacity: 0.7 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px' }}>{file ? file.name : 'Drop a file or click to browse'}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: 0 }}>JSON or CSV · Max 50 MB</p>
                  <input id="file-upload-input" type="file" accept=".json,.csv" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
                </div>
                <button className="sys-btn" onClick={handleBulkUpload} disabled={loading || !file}
                  style={{ width: '100%', justifyContent: 'center', padding: '12px 0', fontSize: 13, marginBottom: 20, opacity: !file ? 0.5 : 1 }}>
                  {loading ? <><RefreshCw size={13} className="spin" /> Uploading…</> : <><UploadCloud size={13} /> Upload & train</>}
                </button>
                {batches.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Previous batches</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {batches.slice(0, 5).map(b => (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', background: 'var(--hover-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <FileText size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.batch_name || `Batch #${b.id}`}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-sec)' }}>{b.records_processed?.toLocaleString() || '?'} records</div>
                          </div>
                          <button onClick={() => handleDeleteBatch(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)', padding: 4, display: 'flex' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-sec)'}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Recent bugs */}
        <div className="sys-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Database size={15} color="var(--accent)" /> Recent bugs
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="pulse-dot" style={{ width: 6, height: 6 }} />
              <button onClick={() => fetchBugs()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)', padding: 4, display: 'flex' }}>
                <RefreshCw size={13} className={refreshingBugs ? 'spin' : ''} />
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0', minHeight: 300 }}>
            {bugs.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-sec)', fontSize: 13 }}>
                No bugs yet — submit your first one above.
              </div>
            ) : bugs.slice(0, 30).map(b => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px',
                borderLeft: b._isNew ? '3px solid var(--accent)' : '3px solid transparent',
                background: b._isNew ? 'var(--pill-bg)' : 'transparent',
                transition: 'all 0.3s',
              }}>
                <SevBadge sev={b.severity} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.summary}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-sec)', marginTop: 2 }}>{b.component || 'General'} · {b.status || 'NEW'}</div>
                </div>
                <button onClick={() => handleDeleteBug(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)', padding: 3, display: 'flex', flexShrink: 0, opacity: 0.4 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Severity guide */}
        <div className="sys-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
            <h2 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>Severity guide</h2>
            <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: '4px 0 0' }}>Reference when selecting a severity level.</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {SEVERITY_DEFS.map(def => (
                <div key={def.code} style={{ padding: '14px 16px', background: def.bg, border: `1px solid ${def.border}`, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: def.color, fontFamily: 'var(--font-mono)' }}>{def.code}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>{def.label}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-sec)', margin: '0 0 8px', lineHeight: 1.6 }}>{def.desc}</p>
                  <div style={{ fontSize: 11, fontWeight: 700, color: def.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ArrowRight size={11} /> {def.action}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}