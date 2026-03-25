import React, { useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle, Search, Bug,
  ThumbsUp, ThumbsDown, Sparkles, ArrowRight,
  RefreshCw, CheckCircle, RotateCcw, Database, Zap
} from 'lucide-react';
import { GlossaryDrawer, GlossaryTrigger, SEVERITY_DEFS } from '../Components/Glossary';

const SAMPLE_BUGS = [
  'Firefox crashes when opening more than 50 tabs on macOS',
  'Dark mode colours inconsistent across the Settings panel',
  '4K video playback stutters on YouTube',
  'Login button unresponsive on password-protected sites',
];

export default function BugAnalysis({ selectedModel = 'rf' }) {
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

  const handleAnalyze = async (overrideQuery = null) => {
    const text = overrideQuery || query;
    if (!text.trim()) return;
    setAnalyzing(true); setError(null); setPrediction(null); setFeedbackSent(false); setShowCorrection(false);
    if (overrideQuery) setQuery(overrideQuery);
    try {
      const res = await axios.get('/api/analyze_bug', { params: { bug_text: text, model_source: 'universal' } });
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
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '36px 24px', minHeight: 'calc(100vh - 100px)' }} className="fade-in">
      {showGlossary && <GlossaryDrawer onClose={() => setShowGlossary(false)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Bug size={22} strokeWidth={1.5} color="var(--accent)" />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: -0.5 }}>Analytics</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: 0, lineHeight: 1.6 }}>
            Describe a bug to predict its severity and surface similar issues using semantic search.
          </p>
        </div>
        <GlossaryTrigger onClick={() => setShowGlossary(true)} label="Severity guide" />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} color="var(--text-sec)" style={{ position: 'absolute', left: 14, pointerEvents: 'none' }} />
            <input type="text" placeholder="Describe the bug in plain language…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              style={{ width: '100%', height: 52, paddingLeft: 44, paddingRight: 16, background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, color: 'var(--text-main)', outline: 'none', fontFamily: 'var(--font-head)', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }} />
          </div>
          <button onClick={() => handleAnalyze()} disabled={analyzing || !query.trim()}
            style={{ height: 52, padding: '0 24px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', opacity: !query.trim() ? 0.5 : 1, transition: 'opacity 0.2s, transform 0.1s', fontFamily: 'var(--font-head)' }}
            onMouseEnter={e => { if (query.trim()) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
            {analyzing ? <><RefreshCw size={14} className="spin" /> Analysing…</> : <><Zap size={14} /> Analyse</>}
          </button>
          {(prediction || query) && (
            <button onClick={handleReset} title="Reset"
              style={{ height: 52, width: 52, background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-sec)'; }}>
              <RotateCcw size={15} color="currentColor" />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, justifyContent: 'flex-end' }}>
          <Database size={11} color="var(--text-sec)" />
          <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>Similar issues retrieved via <strong style={{ color: 'var(--text-main)' }}>semantic search (RAG)</strong></span>
        </div>
      </div>

      {!prediction && !analyzing && (
        <div className="fade-in" style={{ marginTop: 36, textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            <Sparkles size={12} color="var(--accent)" /> Try an example
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {SAMPLE_BUGS.map((sample, i) => (
              <button key={i} onClick={() => handleAnalyze(sample)} className="sys-btn outline" style={{ borderRadius: 20, fontSize: 12, padding: '6px 14px', fontWeight: 500 }}>
                {sample} <ArrowRight size={11} style={{ marginLeft: 4, opacity: 0.5 }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 20, padding: '14px 18px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {prediction && (
        <div className="fade-in" style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="sys-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={12} /> Severity prediction
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <span style={{ padding: '6px 20px', borderRadius: 9, fontSize: 22, fontWeight: 800, background: sevDef?.bg || 'var(--hover-bg)', color: sevDef?.color || 'var(--text-main)', border: `2px solid ${sevDef?.border || 'var(--border)'}`, fontFamily: 'var(--font-mono)' }}>
                {prediction.prediction}
              </span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: sevDef?.color || 'var(--text-main)', marginBottom: 3 }}>{sevDef?.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-sec)' }}>
                  Confidence: <strong style={{ color: 'var(--text-main)' }}>{Math.round((prediction.confidence || 0) * 100)}%</strong>
                  {prediction.model_source && <span style={{ marginLeft: 8, opacity: 0.7 }}>via {prediction.model_source === 'company' ? '🏢 Company' : '🌐 Universal'}</span>}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: '0 0 16px', lineHeight: 1.7 }}>{sevDef?.desc}</p>
            <div style={{ padding: '12px 16px', background: sevDef?.bg || 'var(--hover-bg)', borderRadius: 8, borderLeft: `3px solid ${sevDef?.color || 'var(--border)'}`, marginBottom: prediction && !feedbackSent ? 16 : 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Recommended action</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{sevDef?.action || prediction.diagnosis}</div>
            </div>
            {!feedbackSent && !showCorrection && (
              <div style={{ paddingTop: 16, borderTop: '1px dashed var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-sec)', fontWeight: 600 }}>Is this accurate?</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setFeedbackSent(true)} className="sys-btn" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '7px 14px', fontSize: 12 }}>
                    <ThumbsUp size={13} /> Yes
                  </button>
                  <button onClick={() => setShowCorrection(true)} className="sys-btn" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '7px 14px', fontSize: 12 }}>
                    <ThumbsDown size={13} /> Correct it
                  </button>
                </div>
              </div>
            )}
            {showCorrection && !feedbackSent && (
              <div className="fade-in" style={{ paddingTop: 16, borderTop: '1px dashed var(--border)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>What should it be?</p>
                <select value={correctedSev} onChange={e => setCorrectedSev(e.target.value)} className="sys-input" style={{ marginBottom: 9, fontSize: 13, width: '100%' }}>
                  <option value="S1">S1 — Critical</option>
                  <option value="S2">S2 — High</option>
                  <option value="S3">S3 — Medium</option>
                  <option value="S4">S4 — Low</option>
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowCorrection(false)} className="sys-btn outline" style={{ flex: 1, padding: '8px 0', fontSize: 12 }}>Cancel</button>
                  <button onClick={submitCorrection} className="sys-btn" disabled={submittingFeedback} style={{ flex: 1, padding: '8px 0', background: 'var(--accent)', fontSize: 12 }}>
                    {submittingFeedback ? <RefreshCw size={12} className="spin" /> : <><CheckCircle size={12} /> Submit</>}
                  </button>
                </div>
              </div>
            )}
            {feedbackSent && (
              <div style={{ paddingTop: 16, borderTop: '1px dashed var(--border)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <CheckCircle size={14} color="var(--success)" />
                <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>Feedback received — model will improve.</span>
              </div>
            )}
          </div>

          <div className="sys-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Database size={12} /> Similar bugs found via RAG
            </div>
            {duplicates.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-sec)', fontSize: 13, padding: '20px 0' }}>No similar bugs found in the database.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {duplicates.slice(0, 6).map((dup, i) => (
                  <div key={i} style={{ padding: '12px 16px', background: 'var(--hover-bg)', borderRadius: 9, border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flexShrink: 0 }}>
                      {dup.severity && (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, fontFamily: 'var(--font-mono)', background: dup.severity === 'S1' ? 'rgba(239,68,68,0.1)' : dup.severity === 'S2' ? 'rgba(245,158,11,0.1)' : dup.severity === 'S3' ? 'rgba(59,130,246,0.1)' : 'var(--hover-bg)', color: dup.severity === 'S1' ? '#ef4444' : dup.severity === 'S2' ? '#f59e0b' : dup.severity === 'S3' ? '#3b82f6' : 'var(--text-sec)' }}>{dup.severity}</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: 'var(--text-main)', margin: '0 0 4px', lineHeight: 1.5 }}>{dup.summary || dup.text || '—'}</p>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        {dup.id && <span style={{ fontSize: 11, color: 'var(--text-sec)', fontFamily: 'var(--font-mono)' }}>#{dup.id}</span>}
                        {dup.score !== undefined && <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>{Math.round(dup.score * 100)}% match</span>}
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
