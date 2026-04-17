import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  AlertTriangle, Search, Bug,
  ThumbsUp, ThumbsDown, Sparkles, ArrowRight,
  RefreshCw, CheckCircle, RotateCcw, Database, Zap, Globe, Building2, X, ChevronRight, ChevronDown
} from 'lucide-react';
import { GlossaryDrawer, GlossaryTrigger, SEVERITY_DEFS } from '../Components/Glossary';
import { motion } from 'framer-motion';

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
        className={triggerClassName || `h-12 flex items-center justify-between px-4 border rounded-xl cursor-pointer text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-blue-500/40 ${open ? 'border-blue-500/50 bg-white/10 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20'}`}>
        <span className={`truncate pr-2 ${selected ? 'text-white' : ''}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div id={listId} role="listbox" ref={listRef} aria-label={ariaLabel || placeholder} className={`absolute z-[9999] w-full bg-[#1a1d27] border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] overflow-hidden py-1.5 ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
          <div className="max-h-52 overflow-y-auto custom-scrollbar">
            {options.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              return (<div key={opt.value} role="option" aria-selected={isSelected} onClick={() => commit(i)} onMouseEnter={() => setActiveIdx(i)} className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors mx-1.5 rounded-xl ${isSelected ? 'bg-blue-500/20 text-blue-400' : i === activeIdx ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>{opt.label}</div>);
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
    S3: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    S4: 'bg-white/5 text-white/50 border-white/10',
  };

  return (
    <div className="absolute top-full left-0 right-0 mt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="bg-black/90 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Database size={14} className="text-blue-400 flex-shrink-0" />
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
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono flex-shrink-0 ${SEV_COLORS[bug.severity] || SEV_COLORS.S4}`}>
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
          <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
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

  return (
    <div className="w-full max-w-5xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      {showGlossary && <GlossaryDrawer onClose={() => setShowGlossary(false)} />}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-400">
              <Sparkles size={12} className="text-blue-500" />
              <span className="text-[10px] font-bold tracking-widest uppercase">Semantic Analysis</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">analytics</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            Describe an anomaly in natural language. Our ML engine predicts severity and leverages Vector RAG to instantly surface historical duplicates.
          </p>
        </div>
        <div className="relative z-10">
          <GlossaryTrigger onClick={() => setShowGlossary(true)} label="Severity guide" />
        </div>
        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-blue-500/20 via-white/5 to-transparent" />
      </div>

      <div className="mb-8">
        {/* Model source toggle — hidden for super_admin (system always uses universal) */}
        {!isSuperAdmin && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Model:</span>
            <div className="flex gap-1 bg-white/5 border border-white/10 p-0.5 rounded-xl">
              <button onClick={() => setModelSource('universal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${modelSource === 'universal' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}>
                <Globe size={11} /> Universal
              </button>
              <button onClick={() => setModelSource('company')} disabled={!hasOwnModel}
                title={!hasOwnModel ? 'Train a company model first on the Performance tab' : ''}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed ${modelSource === 'company' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/40 hover:text-white/70'}`}>
                <Building2 size={11} /> Company
              </button>
            </div>
            {modelSource === 'company' && (
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /> Using your trained model
              </span>
            )}
          </div>
        )}

        {/* Search bar — click opens DB overlay */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div ref={searchWrapRef} className="flex-1 relative">
            <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-colors focus-within:border-blue-500/50 focus-within:bg-white/10">
              <button onClick={() => handleAnalyze()} disabled={analyzing || !query.trim()} className="absolute left-4 p-1 text-white/40 hover:text-white/70 transition-colors disabled:pointer-events-none">
                <Search size={18} />
              </button>
              <input
                type="text"
                placeholder="Describe the bug — or click to browse your database…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                onFocus={() => setShowDbOverlay(true)}
                className="w-full bg-transparent h-14 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none text-base"
              />
            </div>
            {showDbOverlay && (
              <DbSearchOverlay
                onSelect={(text) => { setQuery(text); setShowDbOverlay(false); }}
                onClose={() => setShowDbOverlay(false)}
              />
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleAnalyze()} disabled={analyzing || !query.trim()}
              className="h-14 px-8 bg-white text-black hover:bg-zinc-200 font-bold rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_8px_30px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 whitespace-nowrap">
              {analyzing ? <><RefreshCw size={16} className="animate-spin" /> Analyzing</> : <><Zap size={16} /> Analyze</>}
            </button>
          {(prediction || query) && (
            <button onClick={handleReset} title="Reset"
              className="h-14 w-14 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-white/50 hover:text-red-400 rounded-2xl flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg flex-shrink-0">
              <RotateCcw size={18} />
            </button>
          )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 px-2 opacity-60">
          <Database size={12} className="text-white/60" />
          <span className="text-xs text-white/60">Semantic search (RAG) retrieves similar historical bugs · Click search bar to browse your live database</span>
        </div>
      </div>

      {!prediction && !analyzing && (
        <div className="animate-in fade-in duration-500 mt-12 text-center">
          <p className="text-[10px] font-bold text-white/40 mb-6 flex items-center justify-center gap-2 tracking-widest uppercase">
            <Sparkles size={12} className="text-blue-400" /> Try an example
          </p>
          <div className="flex flex-wrap gap-3 justify-center max-w-3xl mx-auto">
            {SAMPLE_BUGS.map((sample, i) => (
              <button key={i} onClick={() => handleAnalyze(sample)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-full text-xs px-5 py-2.5 font-medium transition-all duration-300 flex items-center gap-2 group hover:-translate-y-0.5 hover:shadow-md">
                {sample} <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-semibold flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-500" />
          {error}
        </div>
      )}

      {prediction && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Left Column: Prediction */}
          <div className="lg:col-span-5 bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-6 flex items-center gap-2">
              <AlertTriangle size={14} className="text-white/30" /> Severity prediction
            </div>
            <div className="flex items-center gap-5 mb-8">
              <span className={`px-6 py-3 rounded-2xl text-4xl font-bold font-mono border-2 shadow-xl ${
                 prediction.prediction === 'S1' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                 prediction.prediction === 'S2' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' :
                 prediction.prediction === 'S3' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                 'bg-white/5 text-white/60 border-white/20'}`}>
                {prediction.prediction}
              </span>
              <div>
                <div className="text-lg font-bold text-white mb-1">{sevDef?.label}</div>
                <div className="text-xs text-white/50 font-medium">
                  Confidence: <strong className="text-white">{Math.round((prediction.confidence || 0) * 100)}%</strong>
                  {prediction.model_source && <span className="ml-2 opacity-60">via {prediction.model_source === 'company' ? '🏢 Company' : '🌐 Universal'}</span>}
                </div>
              </div>
            </div>
            <p className="text-sm text-white/50 leading-relaxed mb-6">{sevDef?.desc}</p>
            <div className="p-5 bg-gradient-to-br from-white/5 to-transparent rounded-2xl border border-white/10 mb-6 shadow-inner">
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Recommended action</div>
              <div className="text-sm font-semibold text-white">{sevDef?.action || 'Assign to triage queue for engineering review.'}</div>

              {prediction.keywords?.length > 0 && (
                <div className="mt-5 pt-4 border-t border-white/10">
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Key Predictive Features</div>
                  <div className="flex flex-wrap gap-2">
                    {prediction.keywords.map(k => (
                      <span key={k} className="text-[10px] font-bold px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 uppercase tracking-widest">{k}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Feedback */}
            {!feedbackSent && !showCorrection && (
              <div className="pt-6 border-t border-white/10 flex flex-col gap-3 mt-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/70 font-semibold">Is this accurate?</div>
                    <div className="text-[10px] text-white/30 mt-0.5">Your response trains the model</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={submitPositiveFeedback}
                      className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-1.5 hover:-translate-y-0.5 hover:shadow-md">
                      <ThumbsUp size={13} /> Yes — correct
                    </button>
                    <button onClick={() => setShowCorrection(true)}
                      className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-1.5 hover:-translate-y-0.5 hover:shadow-md">
                      <ThumbsDown size={13} /> Fix it
                    </button>
                  </div>
                </div>
              </div>
            )}
            {showCorrection && !feedbackSent && (
              <div className="animate-in fade-in pt-6 border-t border-white/10 mt-auto">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">What should it be?</p>
                <p className="text-[10px] text-white/30 mb-3">This correction will retrain the model to improve future predictions.</p>
                <div className="mb-4">
                  <CustomSelect
                    value={correctedSev}
                    onChange={v => setCorrectedSev(v)}
                    options={[{ value: 'S1', label: 'S1 — Critical' }, { value: 'S2', label: 'S2 — High' }, { value: 'S3', label: 'S3 — Medium' }, { value: 'S4', label: 'S4 — Low' }]}
                    placeholder="Select severity"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowCorrection(false)} className="flex-1 px-4 py-2.5 bg-transparent border border-white/20 text-white/60 hover:text-white rounded-xl text-xs font-bold transition-all">Cancel</button>
                  <button onClick={submitCorrection} disabled={submittingFeedback} className="flex-1 px-4 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                    {submittingFeedback ? <RefreshCw size={12} className="animate-spin" /> : <><CheckCircle size={12} /> Submit correction</>}
                  </button>
                </div>
              </div>
            )}
            {feedbackSent && (
              <div className="pt-6 border-t border-white/10 flex items-center gap-2 mt-auto text-emerald-400">
                <CheckCircle size={14} />
                <div>
                  <div className="text-xs font-bold">Feedback received</div>
                  <div className="text-[10px] text-emerald-400/60">Model will improve with your input</div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: RAG Results */}
          <div className="lg:col-span-7 bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Database size={14} className="text-white/30" /> Similar bugs found via Vector RAG
            </div>
            {duplicates.length === 0 ? (
              <div className="text-center text-white/30 text-sm py-12 flex flex-col items-center justify-center">
                 <Database size={32} className="opacity-20 mb-4" />
                 No semantic duplicates found in historical database.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {duplicates.slice(0, 6).map((dup, i) => (
                  <div key={i} className="p-5 bg-white/[0.03] border border-white/5 hover:border-white/15 rounded-2xl flex items-start gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group cursor-default">
                    <div className="flex-shrink-0 mt-0.5">
                      {dup.severity && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono ${
                          dup.severity === 'S1' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          dup.severity === 'S2' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          dup.severity === 'S3' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-white/5 text-white/50 border-white/10'
                        }`}>{dup.severity}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90 group-hover:text-white transition-colors m-0 mb-1.5 leading-snug line-clamp-2">{dup.summary || dup.text || '—'}</p>
                      <div className="flex gap-4 items-center">
                        {dup.id && <span className="text-[10px] font-mono text-white/40">#{dup.id}</span>}
                        {dup.score !== undefined && <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{Math.round(dup.score * 100)}% match</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
