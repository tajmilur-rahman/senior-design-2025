import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  AlertTriangle, Search, Bug,
  ThumbsUp, ThumbsDown, Sparkles, ArrowRight,
  RefreshCw, CheckCircle, RotateCcw, Database, Zap, Globe, Building2
} from 'lucide-react';
import { GlossaryDrawer, GlossaryTrigger, SEVERITY_DEFS } from '../Components/Glossary';

const SAMPLE_BUGS = [
  'Firefox crashes when opening more than 50 tabs on macOS',
  'Dark mode colours inconsistent across the Settings panel',
  '4K video playback stutters on YouTube',
  'Login button unresponsive on password-protected sites',
];

export default function BugAnalysis() {
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
  const [modelSource,        setModelSource]        = useState('universal'); // 'universal' | 'company'
  const [hasOwnModel,        setHasOwnModel]        = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('/api/admin/company_profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (res.data?.has_own_model) { setHasOwnModel(true); setModelSource('company'); } })
      .catch(() => {});
  }, []);

  const handleAnalyze = async (overrideQuery = null) => {
    const text = overrideQuery || query;
    if (!text.trim()) return;
    setAnalyzing(true); setError(null); setPrediction(null); setFeedbackSent(false); setShowCorrection(false);
    if (overrideQuery) setQuery(overrideQuery);
    try {
      const res = await axios.get('/api/analyze_bug', { params: { bug_text: text, model_source: modelSource } });
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

  const submitCorrection = async () => {
    if (!prediction) return;
    setSubmittingFeedback(true);
    try {
      await axios.post('/api/feedback', { summary: query, predicted_severity: prediction.prediction, actual_severity: correctedSev, confidence: prediction.confidence || 0.6, component: 'General', consent_global_model: true });
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
            AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Analytics</span>
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
        {/* Model source toggle */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Model:</span>
          <div className="flex gap-1 bg-white/5 border border-white/10 p-0.5 rounded-xl">
            <button onClick={() => setModelSource('universal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${modelSource === 'universal' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}>
              <Globe size={11} /> Universal
            </button>
            <button onClick={() => setModelSource('company')} disabled={!hasOwnModel}
              title={!hasOwnModel ? 'Train a company model first on the Performance tab' : ''}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed ${modelSource === 'company' ? 'bg-blue-500/20 text-blue-400' : 'text-white/40 hover:text-white/70'}`}>
              <Building2 size={11} /> Company
            </button>
          </div>
          {modelSource === 'company' && (
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /> Using your trained model
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative flex items-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-colors focus-within:border-blue-500/50 focus-within:bg-white/10">
            <button onClick={() => handleAnalyze()} disabled={analyzing || !query.trim()} className="absolute left-4 p-1 text-white/40 hover:text-white/70 transition-colors disabled:pointer-events-none">
              <Search size={18} />
            </button>
            <input type="text" placeholder="Describe the bug in plain language…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              className="w-full bg-transparent h-14 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none text-base" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleAnalyze()} disabled={analyzing || !query.trim()}
              className="h-14 px-8 bg-white text-black hover:bg-zinc-200 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] whitespace-nowrap">
              {analyzing ? <><RefreshCw size={16} className="animate-spin" /> Analyzing</> : <><Zap size={16} /> Analyze</>}
            </button>
          {(prediction || query) && (
            <button onClick={handleReset} title="Reset"
              className="h-14 w-14 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-white/50 hover:text-red-400 rounded-2xl flex items-center justify-center transition-all flex-shrink-0">
              <RotateCcw size={18} />
            </button>
          )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 px-2 opacity-60">
          <Database size={12} className="text-white/60" />
          <span className="text-xs text-white/60">Similar issues retrieved via <strong className="text-white font-semibold">semantic search (RAG)</strong></span>
        </div>
      </div>

      {!prediction && !analyzing && (
        <div className="animate-in fade-in duration-500 mt-12 text-center">
          <p className="text-[10px] font-bold text-white/40 mb-6 flex items-center justify-center gap-2 tracking-widest uppercase">
            <Sparkles size={12} className="text-blue-400" /> Try an example
          </p>
          <div className="flex flex-wrap gap-3 justify-center max-w-3xl mx-auto">
            {SAMPLE_BUGS.map((sample, i) => (
              <button key={i} onClick={() => handleAnalyze(sample)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-full text-xs px-5 py-2.5 font-medium transition-all flex items-center gap-2 group">
                {sample} <ArrowRight size={12} className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl color-red-400 text-sm font-semibold flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-500" />
          {error}
        </div>
      )}

      {prediction && (
        <div className="animate-in fade-in duration-500 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Prediction */}
          <div className="lg:col-span-5 bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-6 flex items-center gap-2">
              <AlertTriangle size={14} className="text-white/30" /> Severity prediction
            </div>
            <div className="flex items-center gap-5 mb-8">
              <span className={`px-5 py-2.5 rounded-xl text-3xl font-bold font-mono border-2 ${
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
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mb-6">
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Recommended action</div>
              <div className="text-sm font-semibold text-white">{sevDef?.action || prediction.diagnosis}</div>
            </div>
            
            {!feedbackSent && !showCorrection && (
              <div className="pt-6 border-t border-white/10 flex items-center justify-between gap-4 mt-auto">
                <span className="text-xs text-white/50 font-medium">Is this accurate?</span>
                <div className="flex gap-2">
                  <button onClick={() => setFeedbackSent(true)} className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                    <ThumbsUp size={13} /> Yes
                  </button>
                  <button onClick={() => setShowCorrection(true)} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                    <ThumbsDown size={13} /> Correct it
                  </button>
                </div>
              </div>
            )}
            {showCorrection && !feedbackSent && (
              <div className="animate-in fade-in pt-6 border-t border-white/10 mt-auto">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">What should it be?</p>
                <select value={correctedSev} onChange={e => setCorrectedSev(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white mb-3 text-sm focus:outline-none focus:border-white/30 appearance-none">
                  <option value="S1">S1 — Critical</option>
                  <option value="S2">S2 — High</option>
                  <option value="S3">S3 — Medium</option>
                  <option value="S4">S4 — Low</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={() => setShowCorrection(false)} className="flex-1 px-4 py-2.5 bg-transparent border border-white/20 text-white/60 hover:text-white rounded-xl text-xs font-bold transition-all">Cancel</button>
                  <button onClick={submitCorrection} disabled={submittingFeedback} className="flex-1 px-4 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                    {submittingFeedback ? <RefreshCw size={12} className="animate-spin" /> : <><CheckCircle size={12} /> Submit</>}
                  </button>
                </div>
              </div>
            )}
            {feedbackSent && (
              <div className="pt-6 border-t border-white/10 flex items-center gap-2 mt-auto text-emerald-400">
                <CheckCircle size={14} />
                <span className="text-xs font-bold">Feedback received — model updating.</span>
              </div>
            )}
          </div>

          {/* Right Column: RAG Results */}
          <div className="lg:col-span-7 bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md flex flex-col relative overflow-hidden">
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
                  <div key={i} className="p-4 bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl flex items-start gap-4 transition-colors">
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
                      <p className="text-sm text-white/90 m-0 mb-1.5 leading-snug line-clamp-2">{dup.summary || dup.text || '—'}</p>
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
        </div>
      )}
    </div>
  );
}
