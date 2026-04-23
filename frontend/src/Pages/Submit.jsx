import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { mozillaTaxonomy } from '../javascript/taxonomy';
import {
  UploadCloud, AlertCircle, FileText, PenTool,
  Cpu, CheckCircle, Send, Trash2, X,
  FolderTree, Database, RefreshCw, ArrowRight, Info,
  Globe, Building2, Zap, Lock, ChevronDown,
  BrainCircuit, ClipboardCheck, Archive,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlossaryDrawer, GlossaryTrigger, SEVERITY_DEFS } from '../Components/Glossary';
import { LiquidButton as Button } from '../liquid-glass-button';
import { MotionBentoCard } from '../bento-card';

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
        className={`sf-select-trigger h-12 flex items-center justify-between px-5 border rounded-xl cursor-pointer text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-indigo-500/30
          ${open
            ? 'sf-select-trigger--open border-indigo-500/40 bg-white/[0.08] text-white'
            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20'
          }`}
      >
        <span className={`sf-select-value tracking-wide ${selected ? 'text-white' : ''}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`sf-select-chevron flex-shrink-0 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div
          id={listId}
          role="listbox"
          ref={listRef}
          aria-label={ariaLabel || placeholder}
          className="sf-select-panel absolute z-[9999] w-full mt-2 border border-white/10 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-200" style={{ backgroundColor: 'var(--bg-elevated)', backdropFilter: 'blur(16px)' }}
        >
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
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
                  className={`sf-select-option px-5 py-3 text-[13px] font-semibold tracking-wide cursor-pointer transition-colors mx-2 my-0.5 rounded-lg
                    ${isSelected
                      ? 'sf-select-option--active bg-indigo-500/15 text-indigo-400'
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
  { label: 'NEW',         sub: 'Awaiting triage',     color: '#6366f1' },
  { label: 'UNCONFIRMED', sub: 'Needs reproduction',  color: '#f59e0b' },
  { label: 'CONFIRMED',   sub: 'Verified & assigned', color: '#10b981' },
  { label: 'RESOLVED',    sub: 'Fix implemented',     color: '#10b981' },
  { label: 'VERIFIED',    sub: 'QA sign-off',         color: '#6366f1' },
];

const SEVERITY_QUICK = {
  S1: { tone: 'red',    pill: 'border-red-500/30 bg-red-500/5 text-red-400',       dotShadow: '0 0 12px rgba(239,68,68,0.4)',  hex: '#ef4444', summary: 'Crash or data loss. Fix immediately.',      sla: '4h SLA',  icon: 'error' },
  S2: { tone: 'amber',  pill: 'border-amber-500/30 bg-amber-500/5 text-amber-400', dotShadow: '0 0 12px rgba(245,158,11,0.4)', hex: '#f59e0b', summary: 'Major feature broken. Fix this sprint.',     sla: '24h SLA', icon: 'warning' },
  S3: { tone: 'blue',   pill: 'border-blue-500/30 bg-indigo-500/5 text-indigo-400',    dotShadow: '0 0 12px rgba(99,102,241,0.4)', hex: '#6366f1', summary: 'Works but unexpected. Schedule next sprint.', sla: '7d SLA',  icon: 'report' },
  S4: { tone: 'slate',  pill: 'border-white/15 bg-white/5 text-white/60',           dotShadow: '0 0 12px rgba(148,163,184,0.2)', hex: '#94a3b8', summary: 'Cosmetic or minor. Add to backlog.',         sla: '30d SLA', icon: 'info' },
};

function SevBadge({ sev }) {
  const badgeStyle = {
    S1: 'text-red-400 bg-red-500/10 border-red-500/20',
    S2: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    S3: 'text-indigo-400 bg-indigo-500/10 border-blue-500/20',
    S4: 'text-white/50 bg-white/5 border-white/10'
  }[sev] || 'text-white/50 bg-white/5 border-white/10';
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-widest border font-mono whitespace-nowrap ${badgeStyle}`}>
      {sev || '—'}
    </span>
  );
}

/* Severity badge for the recent bugs table — pill style matching Stitch layout */
function SevPillBadge({ sev }) {
  const styles = {
    S1: { pill: 'text-red-400 bg-red-500/10 border-red-500/20',   dot: '#ef4444' },
    S2: { pill: 'text-amber-400 bg-amber-500/10 border-amber-500/20', dot: '#f59e0b' },
    S3: { pill: 'text-indigo-400 bg-indigo-500/10 border-blue-500/20',  dot: '#6366f1' },
    S4: { pill: 'text-white/50 bg-white/5 border-white/10',         dot: '#94a3b8' },
  }[sev] || { pill: 'text-white/50 bg-white/5 border-white/10', dot: '#94a3b8' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${styles.pill}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: styles.dot }} />
      {sev || '—'}
    </span>
  );
}

export default function SubmitTab({ user, prefill, onClearPrefill, onNavigate }) {
  const [mode,             setMode]             = useState('manual');
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
    setComponent(''); setSummary(''); setSeverity('S3');
    setFile(null);
    setAnalyzeResult(null); setAnalyzing(false);
  };

  useEffect(() => {
    if (prefill) {
      setSummary(prefill.summary || ''); setSeverity(prefill.severity || 'S3');
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
    if (isSuperAdmin && !selectedCompanyId) { showMsg('Super Admin: please select a company.', 'error'); return; }
    const hadExistingBugs = bugs.some(b => !String(b.id).startsWith('pending-'));
    setLoading(true);
    const tempId = `pending-${Date.now()}`;
    const finalComponent = component || 'General';
    setBugs(prev => [{ id: tempId, summary, component: finalComponent, severity, status: 'NEW', _isNew: true }, ...prev].slice(0, 50));
    try {
      const payload = { summary, component: finalComponent, severity, status: 'NEW' };
      if (isSuperAdmin && selectedCompanyId) payload.company_id = Number(selectedCompanyId);
      const response = await axios.post('/api/bug', payload);
      const savedRow = response.data?.[0] || {};
      const savedComponent = savedRow.component || finalComponent;
      const realId = response.data?.[0]?.bug_id || response.data?.[0]?.id;
      if (realId) {
        newBugIdsRef.current.add(String(realId));
        setBugs(prev => prev.map(b => b.id === tempId ? { id: realId, summary, component: savedComponent, severity, status: 'NEW', _isNew: true } : b));
        setTimeout(() => { newBugIdsRef.current.delete(String(realId)); setBugs(prev => prev.map(b => String(b.id) === String(realId) ? { ...b, _isNew: false } : b)); }, 8000);
      } else { setBugs(prev => prev.filter(b => b.id !== tempId)); }
      showMsg(`Bug logged successfully (${savedComponent})`);
      setSummary(''); setComponent(''); setSeverity('S3');
      startFastRefresh();

      // First-time flow: after the first successful bug, jump to Directory
      // so users immediately see component discovery begin.
      if (!hadExistingBugs && typeof onNavigate === 'function') {
        setTimeout(() => onNavigate('directory'), 900);
      }
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

  const handleDownloadTemplate = () => {
    const csvTemplate = [
      'summary,component,severity,status',
      'Database connection timeout causing complete system crash,Database,S1,NEW',
      'Security vulnerability allows unauthorized database access,Security,S1,NEW',
      'Login page button misaligned on mobile,Frontend,S3,NEW',
      'Example without component (auto-detect),,S3,NEW',
    ].join('\n');

    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bug_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedSevDef = SEVERITY_DEFS.find(d => d.code === severity);

  const PIPELINE = [
    { icon: <PenTool size={16} />, step: 'Describe the bug', detail: 'Title, component, and a clear reproduction path' },
    { icon: <BrainCircuit size={16} />, step: 'AI classifies', detail: 'Model predicts severity in under a second' },
    { icon: <ClipboardCheck size={16} />, step: 'Review & confirm', detail: 'Accept the result or correct it to retrain' },
    { icon: <Archive size={16} />, step: 'Logged to backlog', detail: "Tracked in your team's live database" },
  ];

  return (
    <div
      className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10"
      style={{ background: 'var(--bg)' }}
    >
      <Toast msg={msg} onClose={() => setMsg({ text: '', type: '' })} />
      {showGlossary && <GlossaryDrawer onClose={() => setShowGlossary(false)} />}

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[1.75rem] font-semibold text-white tracking-tight mb-1">
            Bug <span style={{ color: 'var(--accent)' }}>Ingestion</span>
          </h1>
          <p className="text-white/50 text-sm">
            Ingest bugs manually or in bulk — AI classifies severity and routes to the right team.
          </p>
        </div>
        <GlossaryTrigger onClick={() => setShowGlossary(true)} label="Severity & Status Guide" />
      </div>

      {/* ── Bug lifecycle pipeline ───────────────────────────────────────────── */}
      <div className="flex items-stretch mb-8 overflow-x-auto rounded-xl border border-white/[0.07]" style={{ background: 'var(--card-bg)' }}>
        {PIPELINE.map((s, i) => (
          <div key={s.step} className="flex items-center flex-1 min-w-[160px]">
            <div className="flex items-start gap-3.5 px-6 py-4 flex-1">
              <div className="mt-0.5 text-white/30 flex-shrink-0">{s.icon}</div>
              <div>
                <div className="text-[15px] font-semibold text-white leading-snug">{s.step}</div>
                <div className="text-[13px] text-white/40 leading-snug mt-0.5">{s.detail}</div>
              </div>
            </div>
            {i < PIPELINE.length - 1 && (
              <div className="w-px self-stretch bg-white/[0.06] flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* ── Main Two-Column Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ── LEFT col-span-8: Triage Form Card ───────────────────────────────── */}
        <MotionBentoCard
          className="lg:col-span-8 overflow-visible flex flex-col"
          style={{ background: 'var(--card-bg)' }}
          whileInView={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 16 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* Card header with mode toggle */}
          <div
            className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-t-2xl"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 uppercase tracking-widest">
              <Cpu size={16} style={{ color: 'var(--accent)' }} />
              Issue Details
            </h2>
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-widest ${mode === 'manual' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                onClick={() => switchMode('manual')}
              >
                <PenTool size={14} /> Manual
              </button>
              <button
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-widest ${mode === 'bulk' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                onClick={() => switchMode('bulk')}
              >
                <UploadCloud size={14} /> Bulk Import
              </button>
            </div>
          </div>

          <div className="p-6 lg:p-8 flex-1">
            <AnimatePresence mode="wait">
              {mode === 'manual' ? (
                <motion.div
                  key="manual"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  {/* Super admin company picker — required first field */}
                  {isSuperAdmin && (
                    <div className="mb-6 p-4 rounded-2xl border-2 border-amber-500/30 bg-amber-500/5">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 size={14} className="text-amber-500" />
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Target Company</span>
                        <span className="text-[11px] text-red-400 font-bold border border-red-500/20 bg-red-500/10 px-2 py-0.5 rounded tracking-widest uppercase">required</span>
                      </div>
                      <SubmitSelect
                        value={selectedCompanyId}
                        onChange={v => setSelectedCompanyId(v)}
                        placeholder="Select which company to ingest this bug into…"
                        options={companies.map(c => ({ value: c.id, label: c.name }))}
                      />
                    </div>
                  )}

                  {/* Description textarea */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Describe the Issue</label>
                      <span className="text-[11px] text-red-400 font-bold border border-red-500/20 bg-red-500/10 px-2 py-0.5 rounded tracking-widest uppercase">required</span>
                      <span className="ml-auto text-[11px] font-bold text-white/30 uppercase tracking-widest">Demo samples →</span>
                    </div>
                    {/* Quick sample chips */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {[
                        'Database connection timeout causing complete system crash',
                        'Severe memory leak in the login component causes UI to freeze',
                        'API exception thrown when authentication fails',
                        'Security vulnerability allows unauthorized database access',
                      ].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSummary(s)}
                          className="text-xs px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/50 hover:text-white rounded-lg transition-all font-medium truncate max-w-[280px]"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none transition-all text-sm min-h-[120px] resize-y font-mono"
                      style={{ '--tw-ring-color': 'var(--accent)' }}
                      placeholder="Expected behavior vs actual behavior… Stack traces…"
                      value={summary}
                      onChange={e => setSummary(e.target.value)}
                      onFocus={e => { e.target.style.borderColor = 'var(--accent)40'; }}
                      onBlur={e => { e.target.style.borderColor = ''; }}
                    />
                  </div>

                  {/* Severity selection */}
                  <div className="mb-6">
                    <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">Severity Selection</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {SEVERITY_DEFS.map(def => {
                        const isSelected = severity === def.code;
                        const activeColors = {
                          S1: 'border-red-500/50 bg-red-500/10 text-red-400',
                          S2: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
                          S3: 'border-blue-500/50 bg-indigo-500/10 text-indigo-400',
                          S4: 'border-white/30 bg-white/10 text-white'
                        }[def.code];
                        return (
                          <button
                            key={def.code}
                            onClick={() => setSeverity(def.code)}
                            className={`p-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 ${isSelected ? activeColors : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                          >
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

                  {/* Analyze button — green solid, full-width */}
                  <Button
                    onClick={() => handleAnalyze('universal')}
                    disabled={analyzing || !summary}
                    className="w-full font-bold py-3 px-4 mb-2 shadow-lg"
                    style={{ background: 'var(--accent)', color: '#003822' }}
                  >
                    {analyzing
                      ? <><RefreshCw size={16} className="animate-spin" /> Analyzing…</>
                      : <><Zap size={16} /> Analyze Issue</>
                    }
                  </Button>

                  {/* Company model button (secondary) */}
                  <button
                    onClick={() => hasOwnModel && handleAnalyze('company')}
                    disabled={analyzing || !summary || !hasOwnModel}
                    title={!hasOwnModel ? 'Train your company model first via the Retrain button' : undefined}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border mb-6 ${hasOwnModel ? 'border-white/20 text-white/70 hover:bg-white/5 hover:text-white' : 'border-white/10 text-white/30 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                    style={{ background: 'transparent' }}
                  >
                    {hasOwnModel ? <Zap size={13} /> : <Lock size={13} />}
                    Company Model
                  </button>

                  {/* AI analysis result panel */}
                  <AnimatePresence>
                    {analyzeResult && (
                      <motion.div
                        key="analyze-result"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        className="mb-6 p-5 rounded-xl border border-white/10 text-sm relative overflow-hidden"
                        style={{ background: 'var(--bg-elevated)' }}
                      >
                        <div
                          className="absolute top-0 left-0 w-1 h-full rounded-l-xl"
                          style={{ background: 'var(--accent)' }}
                        />
                        <div className="flex items-center gap-3 mb-3 pl-2">
                          <SevBadge sev={analyzeResult.prediction} />
                          <span className="font-bold text-white">{Math.round((analyzeResult.confidence || 0) * 100)}% confidence</span>
                          <span className="ml-auto text-xs font-bold text-white/40 uppercase tracking-widest">
                            via {analyzeResult.model_source === 'company' ? '🏢 Company' : '🌐 Universal'}
                            {analyzeResult.fallback ? ' (fallback)' : ''}
                          </span>
                        </div>
                        {analyzeResult.keywords?.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-white/10 pl-2">
                            <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">
                              Key Predictive Features
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {analyzeResult.keywords.map(k => (
                                <span key={k} className="text-[11px] font-bold px-2 py-1 rounded-md border uppercase tracking-widest" style={{ background: 'var(--accent)10', borderColor: 'var(--accent)30', color: 'var(--accent)' }}>{k}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Consent checkbox */}
                  <label className="flex items-start gap-3 mb-6 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={consentGlobal}
                      onChange={e => setConsentGlobal(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-white/20 focus:ring-offset-0 bg-black/50 cursor-pointer"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <div>
                      <span className="text-xs text-white/60 font-semibold group-hover:text-white/90 transition-colors">
                        Contribute to the <strong className="text-white">Universal Model</strong>
                      </span>
                      <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
                        When checked, this bug report is anonymously added to the shared training dataset — improving severity predictions across all companies. Uncheck to keep it private to your company only.
                      </p>
                    </div>
                  </label>

                  {/* Submit button */}
                  <Button
                    onClick={handleManualSubmit}
                    disabled={loading}
                    className="w-full font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    style={{ background: 'var(--accent)', color: '#003822' }}
                  >
                    {loading
                      ? <><RefreshCw size={16} className="animate-spin" /> Submitting…</>
                      : <><Send size={16} /> Submit Bug</>
                    }
                  </Button>
                  {!summary && (
                    <p className="mt-2 text-xs text-white/40">Tip: click Submit to see required-field guidance, or add a short bug summary first.</p>
                  )}
                  {isSuperAdmin && !selectedCompanyId && (
                    <p className="mt-2 text-xs text-amber-400/80">Select a company to enable submit.</p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="bulk"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  <div className="flex items-center justify-between mb-4 gap-3">
                    <p className="text-xs text-white/40">First time here? Download the template and upload your bug list.</p>
                    <button
                      onClick={handleDownloadTemplate}
                      type="button"
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-white/15 text-white/70 hover:text-white hover:bg-white/5 transition-all"
                    >
                      Download CSV Template
                    </button>
                  </div>

                  <div
                    className={`border-2 border-dashed rounded-2xl p-12 text-center mb-8 cursor-pointer transition-all ${file ? 'bg-white/5' : 'border-white/20 hover:border-white/40 hover:bg-white/5'}`}
                    style={file ? { borderColor: 'var(--accent)50', background: 'var(--accent)08' } : {}}
                    onClick={() => document.getElementById('file-upload-input').click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
                  >
                    <UploadCloud size={40} className="mx-auto mb-4 opacity-80" style={{ color: 'var(--accent)' }} />
                    <p className="text-base font-bold text-white mb-2 truncate max-w-xs mx-auto">{file ? file.name : 'Drop a file or click to browse'}</p>
                    <p className="text-xs text-white/40 font-medium">JSON or CSV · Max 50 MB</p>
                    <input id="file-upload-input" type="file" accept=".json,.csv" className="hidden" onChange={e => setFile(e.target.files[0])} />
                  </div>
                  <Button
                    onClick={handleBulkUpload}
                    disabled={loading || !file}
                    className="w-full font-bold py-4 shadow-lg mb-8"
                    style={{ background: 'var(--accent)', color: '#003822' }}
                  >
                    {loading ? <><RefreshCw size={16} className="animate-spin" /> Importing…</> : <><UploadCloud size={16} /> Import Bugs</>}
                  </Button>

                  {batches.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Previous batches</div>
                        <button
                          onClick={handleDeleteAllBatches}
                          className="text-xs font-bold text-red-400/70 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-1"
                        >
                          <Trash2 size={10} /> Clear all
                        </button>
                      </div>
                      <div className="flex flex-col gap-3">
                        {batches.slice(0, 5).map(b => (
                          <div key={b.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                            <FileText size={18} className="text-white/50 flex-shrink-0" style={{ color: 'var(--accent)' }} />
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

                  {/* Danger zone */}
                  <div className="mt-6 pt-6 border-t border-white/5">
                    <div className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Danger zone</div>
                    {confirmingReset ? (
                      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                        <p className="text-xs text-white/70 mb-4 leading-relaxed">
                          This will permanently delete all bulk-imported bugs for your company. The Firefox baseline dataset will not be affected.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleResetTable}
                            disabled={resetting}
                            className="flex-1 py-2 bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-xs rounded-xl hover:bg-red-500/30 transition-all disabled:opacity-50"
                          >
                            {resetting ? 'Resetting…' : 'Yes, delete imported bugs'}
                          </button>
                          <button
                            onClick={() => setConfirmingReset(false)}
                            className="flex-1 py-2 bg-white/5 border border-white/10 text-white/50 font-bold text-xs rounded-xl hover:bg-white/10 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingReset(true)}
                        disabled={resetting}
                        className="w-full flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl hover:bg-red-500/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
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
        </MotionBentoCard>

        {/* ── RIGHT col-span-4: Severity Quick Reference ──────────────────────── */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <MotionBentoCard
            className="p-6"
            style={{ background: 'var(--card-bg)' }}
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 16 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
          >
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <Info size={16} className="text-white/40" />
              Severity Quick Reference
            </h2>
            <div className="space-y-3">
              {SEVERITY_DEFS.map(def => {
                const q = SEVERITY_QUICK[def.code];
                return (
                  <div
                    key={def.code}
                    className="flex items-center gap-4 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors cursor-default"
                    style={{ background: 'var(--bg-elevated)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border"
                      style={{ background: `${q.hex}18`, borderColor: `${q.hex}30`, color: q.hex }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: q.hex, boxShadow: q.dotShadow }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm font-bold text-white">{def.code} {def.label}</span>
                        <span
                          className="text-[11px] font-mono px-1.5 py-0.5 rounded border ml-2 flex-shrink-0"
                          style={{ color: q.hex, borderColor: `${q.hex}30` }}
                        >
                          {q.sla}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 truncate">{q.summary}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </MotionBentoCard>
        </div>
      </div>

      {/* ── Below-the-fold: Recent Bugs panel (full width) ──── */}
      <MotionBentoCard
        className="mt-8 overflow-hidden"
        style={{ background: 'var(--card-bg)' }}
        whileInView={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 16 }}
        viewport={{ once: true, amount: 0.05 }}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.15 }}
      >
        {/* Panel header */}
        <div
          className="p-5 border-b border-white/5 flex items-center justify-between"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 uppercase tracking-widest">
            <Database size={15} className="text-white/40" />
            Recent Bugs
          </h2>
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)80' }} />
            <button
              onClick={() => fetchBugs()}
              className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <RefreshCw size={14} className={refreshingBugs ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          {bugs.length === 0 ? (
            <div className="p-12 text-center text-white/40 text-sm font-medium">
              No bugs yet — submit your first one.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--card-bg)' }}>
                <tr className="border-b border-white/5">
                  <th className="pb-3 pt-4 text-[11px] text-white/40 uppercase tracking-widest font-medium pl-6">Severity</th>
                  <th className="pb-3 pt-4 text-[11px] text-white/40 uppercase tracking-widest font-medium">Summary</th>
                  <th className="pb-3 pt-4 text-[11px] text-white/40 uppercase tracking-widest font-medium hidden sm:table-cell">Component</th>
                  <th className="pb-3 pt-4 text-[11px] text-white/40 uppercase tracking-widest font-medium hidden md:table-cell">Product</th>
                  <th className="pb-3 pt-4 text-[11px] text-white/40 uppercase tracking-widest font-medium text-right pr-6 hidden lg:table-cell">Status</th>
                  <th className="pb-3 pt-4 pr-4"></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {bugs.slice(0, 30).map(b => (
                  <tr
                    key={b.id}
                    className={`border-b border-white/[0.03] transition-colors group ${b._isNew ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}
                  >
                    <td className="py-3 pl-6">
                      <SevPillBadge sev={b.severity} />
                    </td>
                    <td className="py-3 pr-4 max-w-md">
                      <span className={`text-sm font-medium truncate block ${b._isNew ? 'text-white' : 'text-white/80'}`}>
                        {b.summary}
                      </span>
                    </td>
                    <td className="py-3 pr-4 hidden sm:table-cell">
                      <span className="text-xs text-white/50 font-mono">{b.component || 'General'}</span>
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell">
                      <span className="text-xs text-white/50 font-mono">{b.product || 'Firefox'}</span>
                    </td>
                    <td className="py-3 pr-6 text-right hidden lg:table-cell">
                      <span className="text-[11px] text-white/40 uppercase tracking-widest font-mono">{b.status || 'NEW'}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => handleDeleteBug(b.id)}
                        className="p-1.5 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-500/10"
                      >
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </MotionBentoCard>
    </div>
  );
}
