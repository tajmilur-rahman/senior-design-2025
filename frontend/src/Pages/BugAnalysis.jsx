import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  AlertTriangle, Search, Bug,
  ThumbsUp, ThumbsDown, Sparkles, ArrowRight,
  RefreshCw, CheckCircle, RotateCcw, Database, Zap, Globe, Building2, X, ChevronRight, ChevronDown
} from 'lucide-react';
import { GlossaryDrawer, GlossaryTrigger, SEVERITY_DEFS } from '../Components/Glossary';
import { motion } from 'framer-motion';
import { LiquidButton as Button } from '../liquid-glass-button';
import { BentoCard } from '../bento-card';

function CustomSelect({ value, onChange, options, placeholder, disabled = false, ariaLabel, triggerClassName, dropUp = false }) {
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
  useEffect(() => { if (!open) return; setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0); }, [open]);
  const openAnd = (idx) => { if (disabled) return; setOpen(true); setActiveIdx(idx); };
  const commit = (idx) => { if (idx < 0 || idx >= options.length) return; onChange(options[idx].value); setOpen(false); };
  const onKeyDown = (e) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter': case ' ': e.preventDefault(); if (!open) openAnd(selectedIdx >= 0 ? selectedIdx : 0); else commit(activeIdx); break;
      case 'ArrowDown': e.preventDefault(); if (!open) openAnd(selectedIdx >= 0 ? selectedIdx : 0); else setActiveIdx(i => Math.min(options.length - 1, i + 1)); break;
      case 'ArrowUp': e.preventDefault(); if (!open) openAnd(Math.max(0, selectedIdx)); else setActiveIdx(i => Math.max(0, i - 1)); break;
      case 'Escape': if (open) { e.preventDefault(); setOpen(false); } break;
      case 'Tab': setOpen(false); break;
      default: break;
    }
  };
  return (
    <div ref={ref} className={`relative select-none w-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div role="combobox" tabIndex={disabled ? -1 : 0} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-disabled={disabled} aria-label={ariaLabel || placeholder} onClick={() => { if (!disabled) setOpen(o => !o); }} onKeyDown={onKeyDown}
        className={triggerClassName || `h-12 flex items-center justify-between px-5 border rounded-xl cursor-pointer text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-indigo-500/30 ${open ? 'border-indigo-500/40 bg-white/[0.08] text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20'}`}>
        <span className={`truncate pr-2 tracking-wide ${selected ? 'text-white' : ''}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div id={listId} role="listbox" ref={listRef} aria-label={ariaLabel || placeholder} className={`absolute z-[9999] w-full border border-white/10 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-200 ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'}`} style={{ backgroundColor: 'var(--bg-elevated)', backdropFilter: 'blur(16px)' }}>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              return (<div key={opt.value} role="option" aria-selected={isSelected} onClick={() => commit(i)} onMouseEnter={() => setActiveIdx(i)} className={`px-5 py-3 text-[13px] font-semibold tracking-wide cursor-pointer transition-colors mx-2 my-0.5 rounded-lg ${isSelected ? 'bg-indigo-500/15 text-indigo-400' : i === activeIdx ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>{opt.label}</div>);
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const SAMPLE_BUGS = [
  'Database connection timeout causing complete system crash',
  'Severe memory leak in the login component causes UI to freeze',
  'API exception thrown when authentication fails',
  'Performance is extremely slow when loading the dashboard',
  'Security vulnerability allows unauthorized database access',
  'Button color and alignment is broken on the settings page',
];

// Mini floating database search panel
function DbSearchOverlay({ onSelect, onClose }) {
  const [q,       setQ]       = useState('');
  const [bugs,    setBugs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetchBugs('');
  }, []);

  const fetchBugs = async (search) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/hub/explorer', {
        params: { page: 1, limit: 12, search: search || undefined },
      });
      setBugs(res.data?.bugs || []);
    } catch { setBugs([]); }
    finally { setLoading(false); }
  };

  const handleSearch = (val) => {
    setQ(val);
    fetchBugs(val);
  };

  const SEV_COLORS = {
    S1: 'bg-red-500/10 text-red-400 border-red-500/20',
    S2: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    S3: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    S4: 'bg-white/5 text-white/50 border-white/10',
  };

  return (
    <div className="absolute top-full left-0 right-0 mt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="border border-white/15 rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--card-bg)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Database size={14} className="text-indigo-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search your database…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-white/30 text-sm">
              <RefreshCw size={14} className="animate-spin" /> Loading bugs…
            </div>
          ) : bugs.length === 0 ? (
            <div className="py-8 text-center text-white/30 text-sm">No bugs found</div>
          ) : bugs.map((bug, i) => (
            <button
              key={i}
              onClick={() => { onSelect(bug.summary || ''); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/[0.04] last:border-0 group"
            >
              {bug.severity && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border font-mono flex-shrink-0 ${SEV_COLORS[bug.severity] || SEV_COLORS.S4}`}>
                  {bug.severity}
                </span>
              )}
              <span className="flex-1 text-sm text-white/70 group-hover:text-white transition-colors truncate">
                {bug.summary || '—'}
              </span>
              <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 flex-shrink-0 transition-colors" />
            </button>
          ))}
        </div>
        <div className="px-4 py-2.5 border-t border-white/10 flex items-center gap-2">
          <span className="text-[11px] text-white/30 font-bold uppercase tracking-widest">
            Click any bug to analyze its severity
          </span>
        </div>
      </div>
    </div>
  );
}

export default function BugAnalysis({ user }) {
  const [query,              setQuery]              = useState('');
  const [analyzing,          setAnalyzing]          = useState(false);
  const [prediction,         setPrediction]         = useState(null);
  const [duplicates,         setDuplicates]         = useState([]);
  const [error,              setError]              = useState(null);
  const [feedbackSent,       setFeedbackSent]       = useState(false);
  const [showCorrection,     setShowCorrection]     = useState(false);
  const [correctedSev,       setCorrectedSev]       = useState('S2');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [showGlossary,       setShowGlossary]       = useState(false);
  const [modelSource,        setModelSource]        = useState('universal');
  const [hasOwnModel,        setHasOwnModel]        = useState(false);
  const [showDbOverlay,      setShowDbOverlay]      = useState(false);
  const searchWrapRef = useRef(null);

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (isSuperAdmin) return; // super_admin always uses universal
    const token = localStorage.getItem('token');
    axios.get('/api/admin/company_profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (res.data?.has_own_model) { setHasOwnModel(true); setModelSource('company'); } })
      .catch(() => {});
  }, [isSuperAdmin]);

  // Close DB overlay when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowDbOverlay(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAnalyze = async (overrideQuery = null) => {
    const text = overrideQuery || query;
    if (!text.trim()) return;
    setShowDbOverlay(false);
    setAnalyzing(true); setError(null); setPrediction(null); setFeedbackSent(false); setShowCorrection(false);
    if (overrideQuery) setQuery(overrideQuery);
    try {
      const src = isSuperAdmin ? 'universal' : modelSource;
      const res = await axios.get('/api/analyze_bug', { params: { bug_text: text, model_source: src } });
      setPrediction(res.data.severity);
      setDuplicates(res.data.similar_bugs || []);
    } catch (err) {
      setError(err.response?.status === 401
        ? 'Session expired — please sign in again.'
        : 'Unable to reach the server. Check that the backend is running.');
    } finally { setAnalyzing(false); }
  };

  const handleReset = () => {
    setQuery(''); setPrediction(null); setDuplicates([]);
    setError(null); setFeedbackSent(false); setShowCorrection(false);
  };

  // Submit positive confirmation to improve the model
  const submitPositiveFeedback = async () => {
    if (!prediction) { setFeedbackSent(true); return; }
    try {
      await axios.post('/api/feedback', {
        summary:            query,
        predicted_severity: prediction.prediction,
        actual_severity:    prediction.prediction, // confirmed correct
        confidence:         prediction.confidence || 0.6,
        component:          'General',
        is_correction:      false,
        consent_global_model: true,
      });
    } catch { /* best-effort */ }
    finally { setFeedbackSent(true); }
  };

  const submitCorrection = async () => {
    if (!prediction) return;
    setSubmittingFeedback(true);
    try {
      await axios.post('/api/feedback', {
        summary:              query,
        predicted_severity:   prediction.prediction,
        actual_severity:      correctedSev,
        confidence:           prediction.confidence || 0.6,
        component:            'General',
        is_correction:        true,
        consent_global_model: true,
      });
      setFeedbackSent(true); setShowCorrection(false);
    } catch { setFeedbackSent(true); setShowCorrection(false); }
    finally { setSubmittingFeedback(false); }
  };

  const sevDef = SEVERITY_DEFS.find(d => d.code === prediction?.prediction);

  const SEV_BADGE_COLORS = {
    S1: 'bg-red-500/10 text-red-400 border-red-500/30',
    S2: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    S3: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    S4: 'bg-white/5 text-white/50 border-white/20',
  };

  const SEV_BAR_COLORS = {
    S1: 'bg-red-500',
    S2: 'bg-amber-500',
    S3: 'bg-blue-500',
    S4: 'bg-white/40',
  };

  const DUP_SEV_COLORS = {
    S1: 'bg-red-500/10 text-red-400 border-red-500/20',
    S2: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    S3: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    S4: 'bg-white/5 text-white/50 border-white/10',
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10" style={{ background: 'var(--bg)' }}>
      {showGlossary && <GlossaryDrawer onClose={() => setShowGlossary(false)} />}

      {/* ── Page Header ── */}
      <header className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-white mb-2">
            AI <span style={{ color: 'var(--accent)' }}>analytics</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-2xl leading-relaxed">
            Analyze any bug description for AI-predicted severity and duplicate detection.
          </p>
        </div>
        <GlossaryTrigger onClick={() => setShowGlossary(true)} label="Severity guide" />
      </header>

      {/* ── Configuration & Input Section ── */}
      <section className="mb-10 space-y-5">

        {/* Model selector — hidden for super_admin */}
        {!isSuperAdmin && hasOwnModel && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Model</span>
            <div className="flex p-1 rounded-xl border border-white/10" style={{ background: 'var(--bg-elevated)' }}>
              <button
                onClick={() => setModelSource('universal')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  modelSource === 'universal'
                    ? 'text-white shadow-sm'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
                style={modelSource === 'universal' ? { background: 'var(--card-bg)' } : {}}
              >
                <Globe size={14} style={modelSource === 'universal' ? { color: 'var(--accent)' } : {}} />
                Universal Model
              </button>
              <button
                onClick={() => setModelSource('company')}
                disabled={!hasOwnModel}
                title={!hasOwnModel ? 'Train a company model first on the Performance tab' : ''}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  modelSource === 'company'
                    ? 'text-white shadow-sm'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
                style={modelSource === 'company' ? { background: 'var(--card-bg)' } : {}}
              >
                <Building2 size={14} style={modelSource === 'company' ? { color: 'var(--accent)' } : {}} />
                Company Model
              </button>
            </div>
            {modelSource === 'company' && (
              <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: 'var(--accent)' }} />
                Using your trained model
              </span>
            )}
          </div>
        )}

        {/* Bug input card */}
        <BentoCard
          className="p-1 flex flex-col focus-within:!border-white/20 !overflow-visible relative z-20"
          style={{ background: 'var(--card-bg)' }}
        >
          {/* Textarea area */}
          <div
            className="rounded-xl p-4 flex flex-col"
            style={{ background: 'var(--bg-elevated)', minHeight: '11rem' }}
          >
            <label className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3 select-none">
              Bug Description
            </label>
            <div ref={searchWrapRef} className="flex-1 relative">
              <textarea
                placeholder="Describe the bug or paste from your tracker — or click 'From Database' to browse…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleAnalyze()}
                className="w-full h-full bg-transparent resize-none text-white placeholder:text-white/50 focus:outline-none text-sm leading-relaxed"
                style={{ minHeight: '7rem' }}
              />
              {showDbOverlay && (
                <DbSearchOverlay
                  onSelect={(text) => { setQuery(text); setShowDbOverlay(false); }}
                  onClose={() => setShowDbOverlay(false)}
                />
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            {/* Left: secondary actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDbOverlay(v => !v)}
                className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
              >
                <Database size={14} />
                From Database
              </button>
              {(query || prediction) && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-red-400 px-3 py-1.5 rounded-xl border border-white/10 hover:border-red-500/30 hover:bg-red-500/5 transition-all"
                >
                  <RotateCcw size={14} />
                  Clear
                </button>
              )}
            </div>

            {/* Right: primary CTA */}
            <Button
              onClick={() => handleAnalyze()}
              disabled={analyzing || !query.trim()}
              className="font-bold px-6 py-2"
              style={{ background: 'var(--accent)', color: '#022c1e' }}
            >
              {analyzing
                ? <><RefreshCw size={15} className="animate-spin" /> Analyzing…</>
                : <><Zap size={15} /> Analyze Severity</>
              }
            </Button>
          </div>
        </BentoCard>

      </section>

      {/* ── Sample bugs (empty state) ── */}
      {!prediction && !analyzing && (
        <div className="animate-in fade-in duration-500 mb-10 text-center">
          <p className="text-xs font-bold text-white/50 mb-5 flex items-center justify-center gap-2 tracking-widest uppercase">
            <Sparkles size={12} style={{ color: 'var(--accent)' }} /> Try an example
          </p>
          <motion.div
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            animate="show"
            className="flex flex-wrap gap-2.5 justify-center max-w-3xl mx-auto"
          >
            {SAMPLE_BUGS.map((sample, i) => {
              const dots = ['#f87171', '#fbbf24', '#60a5fa', '#34d399', '#a855f7', '#e879f9'];
              const dotColor = dots[i % dots.length];
              return (
              <motion.button
                key={i}
                variants={{ hidden: { opacity: 0, scale: 0.9, y: 10 }, show: { opacity: 1, scale: 1, y: 0 } }}
                whileHover={{ scale: 1.03, backgroundColor: 'rgba(255,255,255,0.06)' }}
                whileTap={{ scale: 0.97 }}
                layout
                onClick={() => handleAnalyze(sample)}
                className="flex items-center gap-2.5 cursor-pointer rounded-xl px-4 py-2.5 text-[13px] font-semibold border transition-colors text-left max-w-full group"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-sec)' }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}80` }} />
                <span className="truncate group-hover:text-white transition-colors">{sample}</span>
              </motion.button>
              );
            })}
          </motion.div>
        </div>
      )}

      {/* ── Error state ── */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-semibold flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Results: two-column bento ── */}
      {prediction && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* ── Left: Prediction card ── */}
          <BentoCard
            className="lg:col-span-5 p-6 lg:p-8 flex flex-col shadow-2xl !overflow-visible relative z-10"
            style={{ background: 'var(--card-bg)' }}
          >
            {/* Card heading */}
            <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-6 flex items-center gap-2">
              <AlertTriangle size={13} className="text-white/30" /> Severity Prediction
            </div>

            {/* Large severity badge — centered */}
            <div className="flex flex-col items-center mb-8">
              <span
                className={`px-8 py-4 rounded-2xl text-5xl font-bold font-mono border-2 shadow-xl mb-5 ${
                  SEV_BADGE_COLORS[prediction.prediction] || SEV_BADGE_COLORS.S4
                }`}
              >
                {prediction.prediction}
              </span>
              {sevDef && (
                <div className="text-center">
                  <div className="text-base font-bold text-white mb-1">{sevDef.label}</div>
                  <p className="text-xs text-white/50 leading-relaxed max-w-xs">{sevDef.desc}</p>
                </div>
              )}
            </div>

            {/* Confidence bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Confidence</span>
                <span className="text-sm font-bold text-white">{Math.round((prediction.confidence || 0) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${SEV_BAR_COLORS[prediction.prediction] || 'bg-white/40'}`}
                  style={{ width: `${Math.round((prediction.confidence || 0) * 100)}%` }}
                />
              </div>
            </div>

            {/* Meta row */}
            <div
              className="rounded-xl px-4 py-3 mb-6 border border-white/10 space-y-2.5"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Model</span>
                <span className="text-xs font-semibold text-white">
                  {prediction.model_source === 'company' ? '🏢 Company' : '🌐 Universal'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Timestamp</span>
                <span className="text-xs font-mono text-white/70">
                  {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC
                </span>
              </div>
              {sevDef?.action && (
                <div className="pt-1.5 border-t border-white/10">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-widest block mb-1">Recommended action</span>
                  <span className="text-xs font-semibold text-white">{sevDef.action}</span>
                </div>
              )}
            </div>

            {/* Keywords */}
            {prediction.keywords?.length > 0 && (
              <div className="mb-6">
                <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Key Features</div>
                <div className="flex flex-wrap gap-1.5">
                  {prediction.keywords.map(k => (
                    <span key={k} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase tracking-widest">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback row */}
            <div className="pt-5 border-t border-white/10 mt-auto">
              {!feedbackSent && !showCorrection && (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-white/70 font-semibold">Is this accurate?</div>
                    <div className="text-xs text-white/50 mt-0.5">Your response trains the model</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={submitPositiveFeedback}
                      className="px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-white/10 hover:border-white/20 hover:bg-white/5"
                      style={{ color: 'var(--accent)' }}
                    >
                      <ThumbsUp size={13} /> Yes
                    </button>
                    <button
                      onClick={() => setShowCorrection(true)}
                      className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <ThumbsDown size={13} /> Fix it
                    </button>
                  </div>
                </div>
              )}

              {showCorrection && !feedbackSent && (
                <div className="animate-in fade-in space-y-3">
                  <div>
                    <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-0.5">What should it be?</p>
                    <p className="text-xs text-white/50">This correction retrains the model for future predictions.</p>
                  </div>
                  <CustomSelect
                    value={correctedSev}
                    onChange={v => setCorrectedSev(v)}
                    options={[
                      { value: 'S1', label: 'S1 — Critical' },
                      { value: 'S2', label: 'S2 — High' },
                      { value: 'S3', label: 'S3 — Medium' },
                      { value: 'S4', label: 'S4 — Low' },
                    ]}
                    placeholder="Select severity"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCorrection(false)}
                      className="flex-1 px-4 py-2.5 bg-transparent border border-white/20 text-white/60 hover:text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitCorrection}
                      disabled={submittingFeedback}
                      className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: '#022c1e' }}
                    >
                      {submittingFeedback
                        ? <RefreshCw size={12} className="animate-spin" />
                        : <><CheckCircle size={12} /> Submit</>
                      }
                    </button>
                  </div>
                </div>
              )}

              {feedbackSent && (
                <div className="flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                  <CheckCircle size={14} />
                  <div>
                    <div className="text-xs font-bold">Feedback received</div>
                    <div className="text-[11px] opacity-60">Model will improve with your input</div>
                  </div>
                </div>
              )}
            </div>
          </BentoCard>

          {/* ── Right: Duplicate Detection card ── */}
          <BentoCard
            className="lg:col-span-7 p-6 lg:p-8 flex flex-col shadow-2xl"
            style={{ background: 'var(--card-bg)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-white/30" />
                <h3 className="text-sm font-bold text-white">Similar Bugs</h3>
              </div>
              {duplicates.length > 0 && (
                <span
                  className="text-[11px] font-bold px-2 py-1 rounded-lg border border-white/10 text-white/40 font-mono"
                  style={{ background: 'var(--bg-elevated)' }}
                >
                  Top {Math.min(duplicates.length, 6)} matches
                </span>
              )}
            </div>

            {duplicates.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <Database size={32} className="text-white/15 mb-4" />
                <p className="text-sm text-white/30">No semantic duplicates found in historical database.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {duplicates.slice(0, 6).map((dup, i) => (
                  <div
                    key={i}
                    className="p-4 border border-white/5 hover:border-white/15 rounded-2xl flex items-start gap-3 transition-all duration-200 group cursor-default"
                    style={{ background: 'var(--bg-elevated)' }}
                  >
                    {dup.severity && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border font-mono flex-shrink-0 mt-0.5 ${DUP_SEV_COLORS[dup.severity] || DUP_SEV_COLORS.S4}`}>
                        {dup.severity}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <p className="text-sm text-white/80 group-hover:text-white transition-colors leading-snug line-clamp-2 flex-1">
                          {dup.summary || dup.text || '—'}
                        </p>
                        {dup.score !== undefined && (
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-lg border flex-shrink-0"
                            style={{
                              background: 'rgba(62,207,142,0.08)',
                              borderColor: 'rgba(62,207,142,0.2)',
                              color: 'var(--accent)',
                            }}
                          >
                            {Math.round(dup.score * 100)}%
                          </span>
                        )}
                      </div>
                      {dup.id && (
                        <span className="text-[11px] font-mono text-white/30">#{dup.id}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </BentoCard>
        </motion.section>
      )}
    </div>
  );
}
