import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { mozillaTaxonomy } from '../javascript/taxonomy';
import {
  UploadCloud, AlertCircle, FileText, PenTool,
  Cpu, CheckCircle, Send, Trash2, X,
  FolderTree, Database, RefreshCw, ArrowRight, Info,
  Globe, Building2, Zap, Lock, ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlossaryDrawer, GlossaryTrigger, SEVERITY_DEFS } from '../Components/Glossary';

/* Keyboard-accessible dropdown matching the Database/Explorer tab style.
   Implements the listbox pattern: arrows navigate, Enter selects, Esc closes. */
function SubmitSelect({ value, onChange, options, placeholder, disabled = false, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);
  const listId = useRef(`sf-listbox-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedIdx = options.findIndex(o => String(o.value) === String(value));
  const selected = selectedIdx >= 0 ? options[selectedIdx] : null;

  useEffect(() => {
    if (!open) return;
    setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAnd = (idx) => { if (disabled) return; setOpen(true); setActiveIdx(idx); };
  const commit = (idx) => {
    if (idx < 0 || idx >= options.length) return;
    onChange(options[idx].value);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) openAnd(selectedIdx >= 0 ? selectedIdx : 0);
        else commit(activeIdx);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) openAnd(selectedIdx >= 0 ? selectedIdx : 0);
        else setActiveIdx(i => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) openAnd(Math.max(0, selectedIdx));
        else setActiveIdx(i => Math.max(0, i - 1));
        break;
      case 'Home':
        if (open) { e.preventDefault(); setActiveIdx(0); }
        break;
      case 'End':
        if (open) { e.preventDefault(); setActiveIdx(options.length - 1); }
        break;
      case 'Escape':
        if (open) { e.preventDefault(); setOpen(false); }
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={ref} className={`sf-select relative select-none w-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-disabled={disabled}
        aria-label={ariaLabel || placeholder}
        onClick={() => { if (!disabled) setOpen(o => !o); }}
        onKeyDown={onKeyDown}
        className={`sf-select-trigger h-12 flex items-center justify-between px-4 border rounded-xl cursor-pointer text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-blue-500/40
          ${open
            ? 'sf-select-trigger--open border-blue-500/50 bg-white/10 text-white'
            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20'
          }`}
      >
        <span className={`sf-select-value ${selected ? 'text-white' : ''}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`sf-select-chevron flex-shrink-0 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div
          id={listId}
          role="listbox"
          ref={listRef}
          aria-label={ariaLabel || placeholder}
          className="sf-select-panel absolute z-[9999] w-full mt-1.5 bg-[#1a1d27] border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] overflow-hidden py-1.5"
        >
          <div className="max-h-52 overflow-y-auto custom-scrollbar">
            {options.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              const isActive   = i === activeIdx;
              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => commit(i)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`sf-select-option px-4 py-2.5 text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors mx-1.5 rounded-xl
                    ${isSelected
                      ? 'sf-select-option--active bg-blue-500/20 text-blue-400'
                      : isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  {opt.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Toast({ msg, onClose }) {
  if (!msg.text) return null;
  const isError = msg.type === 'error';
  return (
    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full flex items-center gap-3 z-[9999] text-sm font-bold shadow-2xl border animate-in slide-in-from-bottom-5 backdrop-blur-md ${isError ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
      {isError ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
      {msg.text}
      <button onClick={onClose} className="ml-2 text-white/50 hover:text-white transition-colors"><X size={14} /></button>
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
  return (
    <div className="mb-8 p-6 lg:p-8 bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-2 mb-2">
        <Info size={18} className="text-blue-400" />
        <span className="text-base font-bold text-white uppercase tracking-widest">Bug Lifecycle</span>
      </div>
      <p className="text-base text-white/50 mb-8">Every bug moves through six stages — from first report to QA sign-off.</p>
          <div className="flex items-start justify-between gap-2 overflow-x-auto pb-4 custom-scrollbar">
        {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center flex-shrink-0 group cursor-default">
                <div className="flex flex-col items-center w-28 lg:w-32 transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center mb-4 border bg-black/40 transition-all duration-300 group-hover:shadow-lg" style={{ borderColor: `${step.color}50`, color: step.color, boxShadow: `inset 0 0 12px ${step.color}20` }}>
                    <span className="text-lg lg:text-xl font-bold">{i + 1}</span>
              </div>
              <span className="text-sm font-bold text-white text-center uppercase tracking-wider leading-tight">{step.label}</span>
              <span className="text-xs text-white/50 text-center mt-1.5 leading-snug">{step.sub}</span>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight size={18} className="text-white/20 mx-1 lg:mx-3 flex-shrink-0 mb-11 transition-colors group-hover:text-white/40" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const SEVERITY_QUICK = {
  S1: { tone: 'red',    pill: 'border-red-500/30 bg-red-500/5 text-red-400',       dotShadow: '0 0 12px rgba(239,68,68,0.4)',  hex: '#ef4444', summary: 'Crash or data loss. Fix immediately.' },
  S2: { tone: 'amber',  pill: 'border-amber-500/30 bg-amber-500/5 text-amber-400', dotShadow: '0 0 12px rgba(245,158,11,0.4)', hex: '#f59e0b', summary: 'Major feature broken. Fix this sprint.' },
  S3: { tone: 'blue',   pill: 'border-blue-500/30 bg-blue-500/5 text-blue-400',    dotShadow: '0 0 12px rgba(59,130,246,0.4)', hex: '#3b82f6', summary: 'Works but unexpected. Schedule next sprint.' },
  S4: { tone: 'slate',  pill: 'border-white/15 bg-white/5 text-white/60',           dotShadow: '0 0 12px rgba(148,163,184,0.2)', hex: '#94a3b8', summary: 'Cosmetic or minor. Add to backlog.' },
};

function SeverityQuickRef() {
  return (
    <div className="mb-8 p-6 lg:p-8 bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
        <div>
          <div className="text-base font-bold text-white uppercase tracking-widest mb-2">Severity at a glance</div>
          <p className="text-sm text-white/50">How serious is the bug? Pick one — the AI predicts, you confirm.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {SEVERITY_DEFS.map(def => {
          const q = SEVERITY_QUICK[def.code];
          return (
            <div key={def.code} className={`group p-6 rounded-2xl border ${q.pill} flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-opacity-20 cursor-default`}>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform duration-300 group-hover:scale-125" style={{ background: q.hex, boxShadow: q.dotShadow }} />
                <span className="font-bold text-lg font-mono">{def.code}</span>
                <span className="font-bold text-base text-white">{def.label}</span>
              </div>
              <p className="text-sm text-white/70 leading-relaxed group-hover:text-white/90 transition-colors">{q.summary}</p>
            </div>
          );
        })}
      </div>
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

  const handleTeamChange = (val) => { setTeam(val); setCategory(''); setComponent(''); };
  const handleCategoryChange = (val) => { setCategory(val); setComponent(''); };

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
            Submit <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">issue</span>
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
      <SeverityQuickRef />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start mt-8">

        {/* Left Column: Bug Report Form */}
        <div className="sf-triage-card lg:col-span-7 bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl overflow-visible flex flex-col relative">
          <div className="sf-triage-accent absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50 rounded-t-[2rem]" />
          <div className="sf-triage-header p-6 lg:p-8 border-b border-white/5 bg-white/[0.03] flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-t-[2rem]">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-widest"><Cpu size={16} className="text-blue-400" /> Triage Entry</h2>
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
              <button className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-widest ${mode === 'manual' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white hover:bg-white/5'}`} onClick={() => switchMode('manual')}><PenTool size={14} /> Manual</button>
              <button className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-widest ${mode === 'bulk' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white hover:bg-white/5'}`} onClick={() => switchMode('bulk')}><UploadCloud size={14} /> Bulk import</button>
            </div>
          </div>

          <div className="p-6 lg:p-8 flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {mode === 'manual' ? (
                <motion.div
                  key="manual"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <FolderTree size={14} className="text-blue-400" />
                      <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Component</span>
                      <span className="text-[10px] text-red-400 font-bold border border-red-500/20 bg-red-500/10 px-2 py-0.5 rounded tracking-widest uppercase">required</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Team</label>
                      <SubmitSelect
                        value={team}
                        onChange={handleTeamChange}
                        placeholder="Select a team…"
                        options={teams.map(t => ({ value: t, label: t }))}
                      />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Category</label>
                      <SubmitSelect
                        value={category}
                        onChange={handleCategoryChange}
                        placeholder={team ? 'Select a category…' : 'Select a team first'}
                        options={categories.map(c => ({ value: c, label: c }))}
                        disabled={!team}
                      />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Component</label>
                      <SubmitSelect
                        value={component}
                        onChange={v => setComponent(v)}
                        placeholder={category ? 'Select a component…' : 'Select a category first'}
                        options={components.map(c => ({ value: c, label: c }))}
                        disabled={!category}
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Summary</span>
                    <span className="text-[10px] text-red-400 font-bold border border-red-500/20 bg-red-500/10 px-2 py-0.5 rounded tracking-widest uppercase">required</span>
                    <span className="ml-auto text-[10px] font-bold text-white/30 uppercase tracking-widest">Demo samples →</span>
                  </div>
                  {/* Quick sample bug chips for demo purposes */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[
                      'Database connection timeout causing complete system crash',
                      'Severe memory leak in the login component causes UI to freeze',
                      'API exception thrown when authentication fails',
                      'Security vulnerability allows unauthorized database access',
                    ].map(s => (
                      <button key={s} type="button" onClick={() => setSummary(s)}
                        className="text-xs px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/50 hover:text-white rounded-lg transition-all font-medium truncate max-w-[280px]">
                        {s}
                      </button>
                    ))}
                  </div>
                  <textarea className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all text-sm min-h-[120px] resize-y"
                    placeholder="Describe the bug — what happened, what was expected, and how to reproduce it."
                    value={summary} onChange={e => setSummary(e.target.value)} />
                </div>

                <div className="mb-8">
                  <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Severity Selection</div>
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
                          <div className="text-xs font-bold uppercase tracking-widest">{def.label}</div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedSevDef && (
                    <p className="text-sm text-white/70 mt-4 leading-relaxed p-4 bg-white/5 rounded-xl border-l-2 border-white/20">
                      {selectedSevDef.desc}
                    </p>
                  )}
                </div>

                {isSuperAdmin && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 size={14} className="text-amber-500" />
                      <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Company</span>
                      <span className="text-[10px] text-red-400 font-bold border border-red-500/20 bg-red-500/10 px-2 py-0.5 rounded tracking-widest uppercase">required</span>
                    </div>
                    <SubmitSelect
                      value={selectedCompanyId}
                      onChange={v => setSelectedCompanyId(v)}
                      placeholder="Select a company…"
                      options={companies.map(c => ({ value: c.id, label: c.name }))}
                    />
                  </div>
                )}

                <div className="mb-8 p-6 bg-white/[0.03] rounded-2xl border border-white/10">
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Zap size={14} /> AI Severity Analysis</div>
                  <div className={`flex flex-col sm:flex-row gap-3 ${analyzeResult ? 'mb-4' : ''}`}>
                    <button onClick={() => handleAnalyze('universal')} disabled={analyzing || !summary}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      <Globe size={14} /> Universal Model
                    </button>
                    <button onClick={() => hasOwnModel && handleAnalyze('company')} disabled={analyzing || !summary || !hasOwnModel}
                      title={!hasOwnModel ? 'Train your company model first via the Retrain button' : undefined}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${hasOwnModel ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500' : 'bg-transparent border-white/10 text-white/40 disabled:opacity-50 disabled:cursor-not-allowed'}`}>
                      {hasOwnModel ? <Zap size={14} /> : <Lock size={14} />} Company Model
                    </button>
                  </div>
                  {analyzeResult && (
                    <div className="animate-in fade-in duration-300 p-5 bg-black/40 rounded-xl border border-white/10 text-sm shadow-inner mt-4">
                      <div className="flex items-center gap-3 mb-3">
                        <SevBadge sev={analyzeResult.prediction} />
                        <span className="font-bold text-white">{Math.round((analyzeResult.confidence || 0) * 100)}% confidence</span>
                        <span className="ml-auto text-xs font-bold text-white/40 uppercase tracking-widest">
                          via {analyzeResult.model_source === 'company' ? '🏢 Company' : '🌐 Universal'}
                          {analyzeResult.fallback ? ' (fallback)' : ''}
                        </span>
                      </div>
                      {analyzeResult.keywords?.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">
                            Key Predictive Features
                          </div>
                          <div className="flex flex-wrap gap-2">
                          {analyzeResult.keywords.map(k => (
                              <span key={k} className="text-[10px] font-bold px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 uppercase tracking-widest">{k}</span>
                          ))}
                          </div>
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
                    <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
                      When checked, this bug report is anonymously added to the shared training dataset — improving severity predictions across all companies. Uncheck to keep it private to your company only.
                    </p>
                  </div>
                </label>

                <button onClick={handleManualSubmit} disabled={loading || !summary || !component || (isSuperAdmin && !selectedCompanyId)}
                  className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                  {loading ? <><RefreshCw size={16} className="animate-spin" /> Submitting…</> : <><Send size={16} /> Submit bug</>}
                </button>
                </motion.div>
              ) : (
                <motion.div
                  key="bulk"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
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
                      <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Previous batches</div>
                      <button onClick={handleDeleteAllBatches}
                        className="text-xs font-bold text-red-400/70 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-1">
                        <Trash2 size={10} /> Clear all
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      {batches.slice(0, 5).map(b => (
                        <div key={b.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                          <FileText size={18} className="text-blue-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white truncate">{b.batch_name || `Batch #${b.id}`}</div>
                            <div className="text-xs text-white/50 uppercase tracking-widest mt-1">{b.records_processed?.toLocaleString() || '?'} records</div>
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
                  <div className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Danger zone</div>
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
                        <div className="text-xs text-white/40 mt-0.5">Removes all bulk-imported bugs — Firefox baseline data stays intact</div>
                      </div>
                    </button>
                  )}
                </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                    <div className="text-xs text-white/50 mt-1 uppercase tracking-widest">{b.component || 'General'} · {b.status || 'NEW'}</div>
                  </div>
                  <button onClick={() => handleDeleteBug(b.id)} className="p-1.5 text-white/40 hover:text-red-400 opacity-50 hover:opacity-100 transition-opacity">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
