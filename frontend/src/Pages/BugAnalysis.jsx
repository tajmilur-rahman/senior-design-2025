import React, { useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle, Search, History, Bug,
  ThumbsUp, ThumbsDown, Sparkles, ArrowRight,
  RefreshCw, CheckCircle, ChevronDown, RotateCcw, Database
} from 'lucide-react';
import { GlossaryDrawer, GlossaryTrigger, SEVERITY_DEFS } from '../Components/Glossary';

const SAMPLE_BUGS = [
  'Firefox crashes when opening more than 50 tabs on macOS',
  'Dark mode colours inconsistent across the Settings panel',
  '4K video playback stutters on YouTube',
  'Login button unresponsive on password-protected sites',
];

const MODEL_OPTIONS = [
  { id: 'rf',        label: 'Random Forest',      sub: 'Trained on 220k+ Mozilla bugs', badge: 'Default',      badgeColor: '#10b981' },
  { id: 'heuristic', label: 'Rule-based fallback', sub: 'Keyword matching — no training', badge: 'Lightweight', badgeColor: '#f59e0b' },
];

function ModelSelector({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const current = MODEL_OPTIONS.find(m => m.id === selected);
  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-head)', ...(open ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px rgba(37,99,235,0.1)' } : {}) }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Model:</span>
        {current?.label}
        <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 3, background: `${current?.badgeColor}18`, color: current?.badgeColor }}>{current?.badge}</span>
        <ChevronDown size={12} color="var(--text-sec)" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: '0.2s' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 5px)', right: 0, width: 270, zIndex: 100, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 16px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
          <div style={{ padding: '9px 13px 5px', fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid var(--border)' }}>Select model</div>
          {MODEL_OPTIONS.map(m => (
            <div key={m.id} onClick={() => { onChange(m.id); setOpen(false); }} style={{ padding: '11px 13px', cursor: 'pointer', background: selected === m.id ? 'var(--pill-bg)' : 'transparent', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => { if (selected !== m.id) e.currentTarget.style.background = 'var(--hover-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = selected === m.id ? 'var(--pill-bg)' : 'transparent'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: selected === m.id ? 'var(--accent)' : 'var(--text-main)' }}>{m.label}</span>
                <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 3, background: `${m.badgeColor}18`, color: m.badgeColor }}>{m.badge}</span>
                {selected === m.id && <CheckCircle size={11} color="var(--accent)" style={{ marginLeft: 'auto' }} />}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: 0 }}>{m.sub}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BugAnalysis() {
  const [query, setQuery] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [error, setError] = useState(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctedSev, setCorrectedSev] = useState('S2');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [selectedModel, setSelectedModel] = useState('rf');
  const [showGlossary, setShowGlossary] = useState(false);

  const handleAnalyze = async (overrideQuery = null) => {
    const text = overrideQuery || query;
    if (!text.trim()) return;
    setAnalyzing(true); setError(null); setPrediction(null); setFeedbackSent(false); setShowCorrection(false);
    if (overrideQuery) setQuery(overrideQuery);
    try {
      const res = await axios.post(`/api/analyze_bug?bug_text=${encodeURIComponent(text)}&model=${selectedModel}`);
      setPrediction(res.data.severity);
      setDuplicates(res.data.similar_bugs || []);
    } catch (err) {
      setError(err.response?.status === 401 ? 'Session expired — please sign in again.' : 'Unable to reach the server. Check that the backend is running.');
    } finally { setAnalyzing(false); }
  };

  // Reset to blank state
  const handleReset = () => {
    setQuery(''); setPrediction(null); setDuplicates([]);
    setError(null); setFeedbackSent(false); setShowCorrection(false);
  };

  const submitCorrection = async () => {
    if (!prediction) return;
    setSubmittingFeedback(true);
    try {
      await axios.post('/api/feedback', { summary: query, predicted_severity: prediction.label, actual_severity: correctedSev, confidence: prediction.confidence || 0.85, component: 'General' });
      setFeedbackSent(true); setShowCorrection(false);
    } catch { setFeedbackSent(true); setShowCorrection(false); }
    finally { setSubmittingFeedback(false); }
  };

  const sevDef = SEVERITY_DEFS.find(d => d.code === prediction?.label);

  return (
    <div className="ba-container fade-in">
      {showGlossary && <GlossaryDrawer onClose={() => setShowGlossary(false)} />}

      {/* Header */}
      <div className="ba-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', maxWidth: 820, margin: '0 auto' }}>
          <div>
            <h1 className="ba-title"><Bug size={26} strokeWidth={1.5} /> Analytics</h1>
            <p className="ba-subtitle">Predict severity using the ML model, then surface similar bugs from your database using semantic search.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginTop: 4 }}>
            <GlossaryTrigger onClick={() => setShowGlossary(true)} label="Severity guide" />
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ width: '100%', maxWidth: 820, margin: '0 auto' }}>
        {/* Controls row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <ModelSelector selected={selectedModel} onChange={setSelectedModel} />
          {/* Reset button — only visible when there's a result or text */}
          {(prediction || query) && (
            <button onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 11px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-sec)', fontFamily: 'var(--font-head)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-sec)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>

        <div className="ba-input-wrapper">
          <Search className="ba-search-icon" size={17} />
          <input type="text" placeholder="Describe the bug in plain language…" className="ba-input" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAnalyze()} />
          <button onClick={() => handleAnalyze()} className="ba-analyze-btn" disabled={analyzing || !query.trim()} style={{ opacity: !query.trim() ? 0.5 : 1 }}>
            {analyzing ? <><RefreshCw size={13} className="spin" style={{ marginRight: 5 }} />Analysing…</> : 'Analyse'}
          </button>
        </div>

        {/* RAG context note */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, justifyContent: 'flex-end' }}>
          <Database size={11} color="var(--text-sec)" />
          <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>
            Similar issues are retrieved from your database using <strong style={{ color: 'var(--text-main)' }}>semantic search (RAG)</strong>
          </span>
        </div>
      </div>

      {/* Sample bugs */}
      {!prediction && !analyzing && (
        <div className="fade-in" style={{ marginTop: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            <Sparkles size={12} color="var(--accent)" /> Try an example
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 700, margin: '0 auto' }}>
            {SAMPLE_BUGS.map((sample, i) => (
              <button key={i} onClick={() => handleAnalyze(sample)} className="sys-btn outline" style={{ borderRadius: 20, fontSize: 12, padding: '6px 14px', fontWeight: 500 }}>
                {sample} <ArrowRight size={11} style={{ marginLeft: 4, opacity: 0.5 }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div style={{ color: 'var(--danger)', marginTop: 16, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{error}</div>}

      {/* Results */}
      {prediction && (
        <div className="ba-grid fade-in">
          {/* Severity card */}
          <div className="ba-card">
            <div className="ba-card-header"><AlertTriangle size={13} /> Severity prediction</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ padding: '4px 13px', borderRadius: 7, fontSize: 16, fontWeight: 800, background: sevDef?.bg || 'var(--hover-bg)', color: sevDef?.color || 'var(--text-main)', border: `1.5px solid ${sevDef?.border || 'var(--border)'}` }}>
                  {prediction.label}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: sevDef?.color || 'var(--text-main)' }}>{sevDef?.label}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: '0 0 5px', lineHeight: 1.6 }}>{sevDef?.desc}</p>
              <p style={{ fontSize: 11.5, color: 'var(--text-sec)', margin: 0 }}>
                Confidence: <strong style={{ color: 'var(--text-main)' }}>{prediction.confidence}%</strong>
                <span style={{ margin: '0 5px', opacity: 0.4 }}>·</span>
                via {MODEL_OPTIONS.find(m => m.id === selectedModel)?.label}
              </p>
            </div>

            <div className="ba-action-box">
              <p className="ba-action-label">Recommended action</p>
              <p className="ba-action-text">{prediction.action}</p>
            </div>

            {/* Feedback */}
            {!feedbackSent && !showCorrection && (
              <div style={{ marginTop: 18, paddingTop: 15, borderTop: '1px dashed var(--border)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Is this accurate?</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setFeedbackSent(true)} className="sys-btn" style={{ flex: 1, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: 9, fontSize: 12 }}><ThumbsUp size={13} /> Yes</button>
                  <button onClick={() => setShowCorrection(true)} className="sys-btn" style={{ flex: 1, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: 9, fontSize: 12 }}><ThumbsDown size={13} /> No</button>
                </div>
              </div>
            )}
            {showCorrection && !feedbackSent && (
              <div className="fade-in" style={{ marginTop: 18, paddingTop: 15, borderTop: '1px dashed var(--border)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Correct severity</p>
                <select value={correctedSev} onChange={e => setCorrectedSev(e.target.value)} className="sys-input" style={{ marginBottom: 9, fontSize: 13 }}>
                  <option value="S1">S1 — Critical</option><option value="S2">S2 — High</option><option value="S3">S3 — Medium</option><option value="S4">S4 — Low</option>
                </select>
                <div style={{ display: 'flex', gap: 7 }}>
                  <button onClick={() => setShowCorrection(false)} className="sys-btn outline" style={{ flex: 1, padding: 9, fontSize: 12 }}>Cancel</button>
                  <button onClick={submitCorrection} className="sys-btn" disabled={submittingFeedback} style={{ flex: 1, padding: 9, background: 'var(--accent)', fontSize: 12 }}>{submittingFeedback ? 'Saving…' : 'Submit'}</button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 7 }}>Corrections help retrain the model.</p>
              </div>
            )}
            {feedbackSent && (
              <div className="fade-in" style={{ marginTop: 14, padding: '9px 12px', background: '#f0fdf4', borderRadius: 8, textAlign: 'center', fontSize: 12, color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <CheckCircle size={13} /> Feedback recorded — thank you
              </div>
            )}
          </div>

          {/* Similar bugs (RAG) */}
          <div className="ba-card">
            <div className="ba-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><History size={13} /> Similar issues</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', background: 'var(--pill-bg)', padding: '2px 7px', borderRadius: 4 }}>via RAG</span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-sec)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Semantically similar bugs retrieved from your database.
            </p>
            <div className="custom-scrollbar" style={{ maxHeight: 360, overflowY: 'auto' }}>
              {duplicates.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-sec)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Search size={24} style={{ opacity: 0.15 }} />No matching issues found in your database.
                </div>
              ) : (
                duplicates.map((bug, i) => (
                  <div key={i} className="ba-bug-item">
                    <p className="ba-bug-summary">{bug.summary}</p>
                    <div className="ba-tags">
                      {bug.match && <span className="ba-tag tag-match">{bug.match}% match</span>}
                      <span className={`ba-tag ${bug.status === 'Fixed' ? 'tag-fixed' : 'tag-open'}`}>{bug.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}