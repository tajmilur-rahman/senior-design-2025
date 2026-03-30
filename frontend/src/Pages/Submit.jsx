import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { mozillaTaxonomy } from '../javascript/taxonomy';
import {
  UploadCloud, AlertCircle, FileText, PenTool,
  Cpu, CheckCircle, Send, Trash2, X,
  FolderTree, Database, RefreshCw, ArrowRight, Info,
  Globe, Building2, Zap, Lock
} from 'lucide-react';
import { GlossaryDrawer, GlossaryTrigger, SEVERITY_DEFS } from '../Components/Glossary';

function Toast({ msg, onClose }) {
  if (!msg.text) return null;
  const isError = msg.type === 'error';
  return (
    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full flex items-center gap-3 z-[9999] text-sm font-bold shadow-2xl border animate-in slide-in-from-bottom-5 backdrop-blur-md ${isError ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
      {isError ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
      {msg.text}
      <button onClick={onClose} className="ml-2 text-foreground/50 hover:text-foreground transition-colors"><X size={14} /></button>
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
    <div className="mb-6">
      <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 bg-transparent border-none cursor-pointer p-0 text-xs font-bold text-white/50 uppercase tracking-widest hover:text-white transition-colors">
        <Info size={14} className="text-blue-400" />
        Bug Lifecycle Pipeline
        <span className="text-blue-400 text-[10px] ml-1">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="animate-in fade-in duration-300 mt-4 p-6 lg:p-8 bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl backdrop-blur-md">
          <p className="text-sm text-white/50 mb-8">Every anomaly moves through these stages — from first report to final QA close.</p>
          <div className="flex items-start overflow-x-auto pb-2 custom-scrollbar">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-start flex-shrink-0">
                <div className="flex flex-col items-center w-28">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 border-2" style={{ backgroundColor: `${step.color}15`, borderColor: `${step.color}50`, color: step.color }}>
                    <span className="text-sm font-bold">{i + 1}</span>
                  </div>
                  <span className="text-[10px] font-bold text-white text-center uppercase tracking-widest leading-tight">{step.label}</span>
                  <span className="text-[10px] text-white/40 text-center mt-2 leading-snug max-w-[5.5rem]">{step.sub}</span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="flex items-center mt-4 mx-2 flex-shrink-0 opacity-40">
                    <div className="w-6 h-0.5 bg-white/20" />
                    <ArrowRight size={14} className="text-white/40" />
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
  const badgeStyle = {
    S1: 'text-red-400 bg-red-500/10 border-red-500/20',
    S2: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    S3: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    S4: 'text-white/50 bg-white/5 border-white/10'
  }[sev] || 'text-white/50 bg-white/5 border-white/10';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border font-mono whitespace-nowrap ${badgeStyle}`}>
      {sev || '—'}
    </span>
  );
}

export default function SubmitTab({ user, prefill, onClearPrefill }) {
  const [mode,             setMode]             = useState('manual');
  const [team,             setTeam]             = useState('');
  const [category,         setCategory]         = useState('');
  const [component,        setComponent]        = useState('');
  const [summary,          setSummary]          = useState('');
  const [severity,         setSeverity]         = useState('S3');
  const [loading,          setLoading]          = useState(false);
  const [msg,              setMsg]              = useState({ text: '', type: '' });
  const [file,             setFile]             = useState(null);
  const [bugs,             setBugs]             = useState([]);
  const [batches,          setBatches]          = useState([]);
  const [showGlossary,     setShowGlossary]     = useState(false);
  const [refreshingBugs,   setRefreshingBugs]   = useState(false);
  const [analyzing,        setAnalyzing]        = useState(false);
  const [analyzeResult,    setAnalyzeResult]    = useState(null);
  const [consentGlobal,    setConsentGlobal]    = useState(true);
  const [hasOwnModel,      setHasOwnModel]      = useState(false);
  const [companies,        setCompanies]        = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const pollIntervalRef = useRef(null);
  const newBugIdsRef    = useRef(new Set());

  const isSuperAdmin = user?.role === 'super_admin';

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setMsg({ text: '', type: '' });
    // Reset manual form fields
    setTeam(''); setCategory(''); setComponent(''); setSummary(''); setSeverity('S3');
    // Reset bulk fields
    setFile(null);
    // Reset analysis fields
    setAnalyzeResult(null); setAnalyzing(false);
  };

  useEffect(() => {
    if (prefill) {
      setSummary(prefill.summary || ''); setSeverity(prefill.severity || 'S3');
      if (prefill.team)      setTeam(prefill.team);
      if (prefill.category)  setCategory(prefill.category);
      if (prefill.component) setComponent(prefill.component);
      onClearPrefill?.();
    }
  }, [prefill, onClearPrefill]);

  useEffect(() => {
    if (!isSuperAdmin && user?.company_id) {
      axios.get('/api/admin/company_profile').then(res => {
        setHasOwnModel(res.data?.has_own_model || false);
      }).catch(() => {});
    }
  }, [isSuperAdmin, user?.company_id]);

  useEffect(() => {
    if (isSuperAdmin) {
      axios.get('/api/companies/list').then(res => setCompanies(res.data || [])).catch(() => {});
    }
  }, [isSuperAdmin]);

  const teams = Object.keys(mozillaTaxonomy || {});
  const categories = team ? Object.keys(mozillaTaxonomy[team] || {}) : [];
  const components = team && category ? (mozillaTaxonomy[team]?.[category] || []) : [];

  const handleTeamChange = (e) => { setTeam(e.target.value); setCategory(''); setComponent(''); };
  const handleCategoryChange = (e) => { setCategory(e.target.value); setComponent(''); };

  const fetchBatches = useCallback(async () => {
    try { const res = await axios.get('/api/batches'); setBatches(res.data || []); }
    catch (err) { console.error(err); }
  }, []);

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
    pollIntervalRef.current = setInterval(() => {
      fetchBugs(true);
      if (++count >= 6) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    }, 2000);
  }, [fetchBugs]);

  useEffect(() => () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); }, []);

  const handleAnalyze = async (source) => {
    if (!summary) { showMsg('Please enter a bug summary first.', 'error'); return; }
    setAnalyzing(true); setAnalyzeResult(null);
    try {
      const res = await axios.get('/api/analyze_bug', { params: { bug_text: summary, model_source: source } });
      setAnalyzeResult({ ...res.data?.severity, _source: source });
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Analysis failed', 'error');
    } finally { setAnalyzing(false); }
  };

  const handleManualSubmit = async () => {
    if (!summary) { showMsg('Please enter a bug summary.', 'error'); return; }
    if (!component) { showMsg('Please select a component.', 'error'); return; }
    if (isSuperAdmin && !selectedCompanyId) { showMsg('Super Admin: please select a company.', 'error'); return; }
    setLoading(true);
    const tempId = `pending-${Date.now()}`;
    setBugs(prev => [{ id: tempId, summary, component, severity, status: 'NEW', _isNew: true }, ...prev].slice(0, 50));
    try {
      const payload = { summary, component, severity, status: 'NEW' };
      if (isSuperAdmin && selectedCompanyId) payload.company_id = Number(selectedCompanyId);
      const response = await axios.post('/api/bug', payload);
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
      showMsg(err.response?.data?.detail || 'Could not remove bug', 'error');
      fetchBugs();
    }
  };

  const handleDeleteBatch = async (batchId) => {
    setBatches(prev => prev.filter(b => b.id !== batchId));
    try {
      const res = await axios.delete(`/api/batches/${batchId}`);
      const n = res.data?.bugs_deleted;
      showMsg(n > 0 ? `Batch deleted — ${n} bugs removed from database` : 'Batch record removed');
    } catch {
      showMsg('Could not remove batch', 'error');
      fetchBatches();
    }
  };

  const handleDeleteAllBatches = async () => {
    setBatches([]);
    try {
      const res = await axios.delete('/api/batches');
      const { batches_deleted: b, bugs_deleted: bugs } = res.data;
      showMsg(`Cleared ${b} batch${b !== 1 ? 'es' : ''} — ${bugs} bugs removed from database`);
      fetchBugs();
    } catch {
      showMsg('Could not clear batches', 'error');
      fetchBatches();
    }
  };

  const [resetting, setResetting]           = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleResetTable = async () => {
    setConfirmingReset(false);
    setResetting(true);
    try {
      const res = await axios.post('/api/admin/table/reset');
      setBatches([]);
      showMsg(res.data.message || 'Database reset complete.');
      fetchBugs();
    } catch (e) {
      showMsg(e.response?.data?.detail || 'Reset failed.', 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!file) return; setLoading(true); showMsg('Uploading…');
    const fd = new FormData(); fd.append('file', file); fd.append('batch_name', file.name);
    try {
      const res = await axios.post('/api/bulk_submit', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showMsg(`Imported ${res.data?.records_processed || '?'} bugs into your database`); setFile(null);
      await fetchBatches(); await fetchBugs();
    } catch (err) { showMsg(err.response?.data?.detail || 'Upload failed', 'error'); }
    finally { setLoading(false); }
  };

  const selectedSevDef = SEVERITY_DEFS.find(d => d.code === severity);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      <Toast msg={msg} onClose={() => setMsg({ text: '', type: '' })} />
      {showGlossary && <GlossaryDrawer onClose={() => setShowGlossary(false)} />}

      {/* Header matching Liquid Glass aesthetic */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-400 w-max mb-4">
            <Cpu size={12} className="text-blue-500" />
            <span className="text-[10px] font-bold tracking-widest uppercase">Severity Analysis</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Submit <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Issue</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            Log a new anomaly manually for AI severity prediction, or bulk import a batch of bugs into your company database.
          </p>
        </div>
        <div className="relative z-10">
           <GlossaryTrigger onClick={() => setShowGlossary(true)} label="Severity & Status Guide" />
        </div>
        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-blue-500/20 via-white/5 to-transparent" />
      </div>

      <PipelineStrip />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start mt-8">

        {/* Left Column: Bug Report Form */}
        <div className="lg:col-span-7 bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl backdrop-blur-md overflow-hidden flex flex-col relative">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50" />
          <div className="p-6 lg:p-8 border-b border-white/5 bg-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-widest"><Cpu size={16} className="text-blue-400" /> Triage Entry</h2>
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
              <button className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-widest ${mode === 'manual' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white hover:bg-white/5'}`} onClick={() => switchMode('manual')}><PenTool size={14} /> Manual</button>
              <button className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-widest ${mode === 'bulk' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white hover:bg-white/5'}`} onClick={() => switchMode('bulk')}><UploadCloud size={14} /> Bulk import</button>
            </div>
          </div>

          <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
            {mode === 'manual' ? (
              <div className="animate-in fade-in duration-300">
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <FolderTree size={14} className="text-blue-400" />
                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Component</span>
                    <span className="text-[9px] text-red-400 font-bold border border-red-500/20 bg-red-500/10 px-2 py-0.5 rounded tracking-widest uppercase">required</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Team</label>
                      <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all text-sm appearance-none" value={team} onChange={handleTeamChange}>
                        <option value="" disabled>Select a team…</option>
                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Category</label>
                      <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all text-sm appearance-none disabled:opacity-50" value={category} onChange={handleCategoryChange} disabled={!team}>
                        <option value="" disabled>{team ? 'Select a category…' : 'Select a team first'}</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Component</label>
                      <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all text-sm appearance-none disabled:opacity-50" value={component} onChange={e => setComponent(e.target.value)} disabled={!category}>
                        <option value="" disabled>{category ? 'Select a component…' : 'Select a category first'}</option>
                        {components.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Summary</span>
                    <span className="text-[9px] text-red-400 font-bold border border-red-500/20 bg-red-500/10 px-2 py-0.5 rounded tracking-widest uppercase">required</span>
                    <span className="ml-auto text-[9px] font-bold text-white/30 uppercase tracking-widest">Demo samples →</span>
                  </div>
                  {/* Quick sample bug chips for demo purposes */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[
                      'Application crashes on form submit with empty fields',
                      'Dashboard freezes when loading large datasets',
                      'Login button unresponsive after failed auth',
                      'Export CSV produces wrong column order',
                    ].map(s => (
                      <button key={s} type="button" onClick={() => setSummary(s)}
                        className="text-[10px] px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/50 hover:text-white rounded-lg transition-all font-medium truncate max-w-[200px]">
                        {s}
                      </button>
                    ))}
                  </div>
                  <textarea className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all text-sm min-h-[120px] resize-y"
                    placeholder="Describe the bug — what happened, what was expected, and how to reproduce it."
                    value={summary} onChange={e => setSummary(e.target.value)} />
                </div>

                <div className="mb-8">
                  <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-4">Severity Selection</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {SEVERITY_DEFS.map(def => {
                      const isSelected = severity === def.code;
                      const activeColors = {
                        S1: 'border-red-500/50 bg-red-500/10 text-red-400',
                        S2: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
                        S3: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
                        S4: 'border-white/30 bg-white/10 text-white'
                      }[def.code];
                      
                      return (
                        <button key={def.code} onClick={() => setSeverity(def.code)} 
                          className={`p-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 ${isSelected ? activeColors : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}>
                          <div className={`text-base font-bold font-mono ${isSelected ? '' : 'text-white/60'}`}>{def.code}</div>
                          <div className="text-[10px] font-bold uppercase tracking-widest">{def.label}</div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedSevDef && (
                    <p className="text-xs text-white/60 mt-4 leading-relaxed p-4 bg-white/5 rounded-xl border-l-2 border-white/20">
                      {selectedSevDef.desc}
                    </p>
                  )}
                </div>

                {isSuperAdmin && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 size={14} className="text-amber-500" />
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Company</span>
                      <span className="text-[9px] text-red-400 font-bold border border-red-500/20 bg-red-500/10 px-2 py-0.5 rounded tracking-widest uppercase">required</span>
                    </div>
                    <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 focus:bg-white/10 outline-none transition-all text-sm appearance-none" value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)}>
                      <option value="" disabled>Select a company…</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="mb-8 p-6 bg-white/[0.03] rounded-2xl border border-white/10">
                  <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Zap size={14} /> AI Severity Analysis</div>
                  <div className={`flex flex-col sm:flex-row gap-3 ${analyzeResult ? 'mb-4' : ''}`}>
                    <button onClick={() => handleAnalyze('universal')} disabled={analyzing || !summary}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      <Globe size={14} /> Universal Model
                    </button>
                    <button onClick={() => hasOwnModel && handleAnalyze('company')} disabled={analyzing || !summary || !hasOwnModel}
                      title={!hasOwnModel ? 'Train your company model first via the Retrain button' : undefined}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${hasOwnModel ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500' : 'bg-transparent border-white/10 text-white/40 disabled:opacity-50 disabled:cursor-not-allowed'}`}>
                      {hasOwnModel ? <Zap size={14} /> : <Lock size={14} />} Company Model
                    </button>
                  </div>
                  {analyzeResult && (
                    <div className="animate-in fade-in duration-300 p-5 bg-black/40 rounded-xl border border-white/10 text-sm shadow-inner mt-4">
                      <div className="flex items-center gap-3 mb-3">
                        <SevBadge sev={analyzeResult.prediction} />
                        <span className="font-bold text-white">{Math.round((analyzeResult.confidence || 0) * 100)}% confidence</span>
                        <span className="ml-auto text-[10px] font-bold text-white/40 uppercase tracking-widest">
                          via {analyzeResult.model_source === 'company' ? '🏢 Company' : '🌐 Universal'}
                          {analyzeResult.fallback ? ' (fallback)' : ''}
                        </span>
                      </div>
                      {analyzeResult.diagnosis && (
                        <div className="text-white/60 mb-2">
                          <span className="font-bold text-white">Diagnosis:</span> {analyzeResult.diagnosis}
                        </div>
                      )}
                      {analyzeResult.team && (
                        <div className="text-white/60">
                          <span className="font-bold text-white">Suggested team:</span> {analyzeResult.team}
                        </div>
                      )}
                      {analyzeResult.keywords?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {analyzeResult.keywords.map(k => (
                            <span key={k} className="text-[10px] font-bold px-2 py-1 rounded-md bg-white/10 text-white/70 uppercase tracking-widest">{k}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-3 mb-6 cursor-pointer group">
                  <input type="checkbox" checked={consentGlobal} onChange={e => setConsentGlobal(e.target.checked)} className="mt-1 w-4 h-4 rounded border-white/20 text-blue-500 focus:ring-blue-500/50 bg-black/50 cursor-pointer" />
                  <div>
                    <span className="text-xs text-white/60 font-semibold group-hover:text-white/90 transition-colors">
                      Contribute to the <strong className="text-white">Universal Model</strong>
                    </span>
                    <p className="text-[10px] text-white/30 mt-0.5 leading-relaxed">
                      When checked, this bug report is anonymously added to the shared training dataset — improving severity predictions across all companies. Uncheck to keep it private to your company only.
                    </p>
                  </div>
                </label>

                <button onClick={handleManualSubmit} disabled={loading || !summary || !component || (isSuperAdmin && !selectedCompanyId)}
                  className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                  {loading ? <><RefreshCw size={16} className="animate-spin" /> Submitting…</> : <><Send size={16} /> Submit bug</>}
                </button>
              </div>
            ) : (
              <div className="animate-in fade-in duration-300">
                <div className={`border-2 border-dashed rounded-[2rem] p-12 text-center mb-8 cursor-pointer transition-all ${file ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/20 hover:border-white/40 hover:bg-white/5'}`}
                  onClick={() => document.getElementById('file-upload-input').click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}>
                  <UploadCloud size={40} className="mx-auto mb-4 text-blue-400 opacity-80" />
                  <p className="text-base font-bold text-white mb-2 truncate max-w-xs mx-auto">{file ? file.name : 'Drop a file or click to browse'}</p>
                  <p className="text-xs text-white/40 font-medium">JSON or CSV · Max 50 MB</p>
                  <input id="file-upload-input" type="file" accept=".json,.csv" className="hidden" onChange={e => setFile(e.target.files[0])} />
                </div>
                <button onClick={handleBulkUpload} disabled={loading || !file}
                  className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mb-8">
                  {loading ? <><RefreshCw size={16} className="animate-spin" /> Importing…</> : <><UploadCloud size={16} /> Import Bugs</>}
                </button>
                {batches.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Previous batches</div>
                      <button onClick={handleDeleteAllBatches}
                        className="text-[10px] font-bold text-red-400/70 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-1">
                        <Trash2 size={10} /> Clear all
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      {batches.slice(0, 5).map(b => (
                        <div key={b.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                          <FileText size={18} className="text-blue-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white truncate">{b.batch_name || `Batch #${b.id}`}</div>
                            <div className="text-[10px] text-white/50 uppercase tracking-widest mt-1">{b.records_processed?.toLocaleString() || '?'} records</div>
                          </div>
                          <button onClick={() => handleDeleteBatch(b.id)} className="p-2.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reset database to original seeded state */}
                <div className="mt-6 pt-6 border-t border-white/5">
                  <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Danger zone</div>
                  {confirmingReset ? (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                      <p className="text-xs text-white/70 mb-4 leading-relaxed">
                        This will permanently delete all bulk-imported bugs for your company. The Firefox baseline dataset will not be affected.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={handleResetTable} disabled={resetting}
                          className="flex-1 py-2 bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-xs rounded-xl hover:bg-red-500/30 transition-all disabled:opacity-50">
                          {resetting ? 'Resetting…' : 'Yes, delete imported bugs'}
                        </button>
                        <button onClick={() => setConfirmingReset(false)}
                          className="flex-1 py-2 bg-white/5 border border-white/10 text-white/50 font-bold text-xs rounded-xl hover:bg-white/10 transition-all">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmingReset(true)} disabled={resetting}
                      className="w-full flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl hover:bg-red-500/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed">
                      <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/20 transition-colors">
                        {resetting ? <RefreshCw size={15} className="text-red-400 animate-spin" /> : <Trash2 size={15} className="text-red-400" />}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-red-400">{resetting ? 'Resetting…' : 'Reset to Original Database'}</div>
                        <div className="text-[10px] text-white/30 mt-0.5">Removes all bulk-imported bugs — Firefox baseline data stays intact</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Bugs & Guide */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl backdrop-blur-md overflow-hidden flex flex-col min-h-[400px] max-h-[500px]">
            <div className="p-6 border-b border-white/10 bg-black/20 flex justify-between items-center">
              <h2 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-widest">
                <Database size={14} className="text-blue-400" /> Recent bugs
              </h2>
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                <button onClick={() => fetchBugs()} className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                  <RefreshCw size={14} className={refreshingBugs ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {bugs.length === 0 ? (
                <div className="p-10 text-center text-white/40 text-sm font-medium">No bugs yet — submit your first one.</div>
              ) : bugs.slice(0, 30).map(b => (
                <div key={b.id} className={`flex items-center gap-3 p-3 rounded-2xl mx-2 my-1 transition-all border border-transparent ${b._isNew ? 'border-blue-500/30 bg-blue-500/10' : 'hover:border-white/10 hover:bg-white/5'}`}>
                  <SevBadge sev={b.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{b.summary}</div>
                    <div className="text-[10px] text-white/50 mt-1 uppercase tracking-widest">{b.component || 'General'} · {b.status || 'NEW'}</div>
                  </div>
                  <button onClick={() => handleDeleteBug(b.id)} className="p-1.5 text-white/40 hover:text-red-400 opacity-50 hover:opacity-100 transition-opacity">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl backdrop-blur-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/10 bg-black/20">
              <h2 className="text-xs font-bold text-white uppercase tracking-widest mb-1.5">Severity reference</h2>
              <p className="text-xs text-white/50">Quick guide for triage classification.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col gap-4">
                {SEVERITY_DEFS.map(def => {
                   const activeColors = {
                     S1: 'border-red-500/20 bg-red-500/5 text-red-500',
                     S2: 'border-amber-500/20 bg-amber-500/5 text-amber-500',
                     S3: 'border-blue-500/20 bg-blue-500/5 text-blue-500',
                     S4: 'border-zinc-500/20 bg-zinc-500/5 text-zinc-400'
                   }[def.code];
                   return (
                    <div key={def.code} className={`p-5 rounded-2xl border ${activeColors}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="font-bold text-sm font-mono">{def.code}</span>
                        <span className="font-bold text-sm text-white">{def.label}</span>
                      </div>
                      <p className="text-xs text-white/60 mb-4 leading-relaxed">{def.desc}</p>
                      <div className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <ArrowRight size={12} /> {def.action}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
