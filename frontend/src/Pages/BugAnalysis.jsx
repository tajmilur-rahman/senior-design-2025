import React, { useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Search, History, Bug, ThumbsUp, ThumbsDown, Sparkles, ArrowRight, RefreshCw, CheckCircle } from 'lucide-react';

const BugAnalysis = () => {
  const [query, setQuery] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [error, setError] = useState(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctedSev, setCorrectedSev] = useState("S2");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const SAMPLE_BUGS = [
    "Firefox crashes when opening 50+ tabs on macOS",
    "Dark mode colors are inconsistent in Settings menu",
    "Video playback stutters on 4K YouTube videos",
    "Login button unresponsive on secure sites"
  ];

  const handleAnalyze = async (overrideQuery = null) => {
    const textToAnalyze = overrideQuery || query;
    if (!textToAnalyze) return;

    setAnalyzing(true);
    setError(null);
    setPrediction(null);
    setFeedbackSent(false);
    setShowCorrection(false);

    if (overrideQuery) setQuery(overrideQuery);

    try {
      // Changed to axios to automatically use the Supabase auth interceptor defined in App.jsx
      const response = await axios.post(`/api/analyze_bug?bug_text=${encodeURIComponent(textToAnalyze)}`);

      const data = response.data;
      setPrediction(data.severity);
      setDuplicates(data.similar_bugs);

    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        setError("Session expired or unauthorized. Please log in again.");
      } else {
        setError("Could not connect to the server. Is the backend running?");
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const sendPositiveFeedback = () => {
    setFeedbackSent(true);
    setShowCorrection(false);
  };

  const handleNegativeFeedback = () => {
    setShowCorrection(true);
  };

  const submitCorrection = async () => {
    if (!prediction) return;
    setSubmittingFeedback(true);
    try {
      await axios.post('/api/feedback', {
        summary:            query,
        predicted_severity: prediction.label,
        actual_severity:    correctedSev,
        confidence:         prediction.confidence || 0.85,
        component:          "General"
      });
      setFeedbackSent(true);
      setShowCorrection(false);
    } catch (err) {
      console.error("Feedback submission failed:", err);
      setFeedbackSent(true);
      setShowCorrection(false);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="ba-container fade-in">
      <div className="ba-header">
        <h1 className="ba-title"><Bug size={32} strokeWidth={1.5} /> Bug Analysis</h1>
        <p className="ba-subtitle">AI-powered severity prediction and duplicate detection</p>
      </div>

      <div className="ba-input-wrapper">
        <Search className="ba-search-icon" size={20} />
        <input
          type="text"
          placeholder="Describe the bug (e.g., 'Application crashes on login')..."
          className="ba-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
        />
        <button onClick={() => handleAnalyze()} className="ba-analyze-btn" disabled={analyzing}>
          {analyzing ? <><RefreshCw size={16} className="spin"/> Scanning...</> : "Analyze"}
        </button>
      </div>

      {!prediction && !analyzing && (
        <div className="fade-in" style={{marginTop: 40, textAlign: 'center'}}>
          <p style={{fontSize: 11, fontWeight: 800, color: '#94a3b8', marginBottom: 16, display:'flex', alignItems:'center', justifyContent:'center', gap:6, letterSpacing: 0.5}}>
            <Sparkles size={14} color="var(--accent)"/> TRY A SAMPLE REPORT
          </p>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 650, margin: '0 auto'}}>
            {SAMPLE_BUGS.map((sample, i) => (
              <button key={i} onClick={() => handleAnalyze(sample)} className="sys-btn outline"
                style={{ borderRadius: '20px', fontSize: 13, padding: '8px 18px' }}>
                {sample} <ArrowRight size={14} style={{marginLeft: 6, opacity: 0.6}}/>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div style={{ color: '#ef4444', marginTop: 20, textAlign: 'center', fontWeight: 'bold' }}>{error}</div>}

      {prediction && (
        <div className="ba-grid fade-in">
          <div className="ba-card">
            <div className="ba-card-header"><AlertTriangle size={16} /> Predicted Severity</div>

            <div className="ba-severity-content">
              <span className={`pill 
                ${['CRITICAL', 'S1'].includes(prediction.label) ? 'S1' : ''}
                ${['MEDIUM', 'S2'].includes(prediction.label) ? 'S2' : ''}
                ${['LOW', 'S3', 'S4'].includes(prediction.label) ? 'S3' : ''}
              `}>
                {prediction.label}
              </span>
              <p className="ba-confidence">Confidence Score <strong>{prediction.confidence}%</strong></p>
            </div>

            <div className="ba-action-box">
              <p className="ba-action-label">Recommended Action</p>
              <p className="ba-action-text">{prediction.action}</p>
            </div>

            {!feedbackSent && !showCorrection && (
              <div style={{marginTop: 24, paddingTop: 20, borderTop: '1px dashed var(--border)'}}>
                <p style={{fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5}}>
                  Is this accurate?
                </p>
                <div style={{display: 'flex', gap: 12}}>
                  <button onClick={sendPositiveFeedback} className="sys-btn"
                    style={{ flex: 1, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '10px' }}>
                    <ThumbsUp size={16}/> Yes
                  </button>
                  <button onClick={handleNegativeFeedback} className="sys-btn"
                    style={{ flex: 1, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '10px' }}>
                    <ThumbsDown size={16}/> No
                  </button>
                </div>
              </div>
            )}

            {showCorrection && !feedbackSent && (
              <div className="fade-in" style={{marginTop: 24, paddingTop: 20, borderTop: '1px dashed var(--border)'}}>
                <p style={{fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5}}>
                  What is the correct severity?
                </p>
                <select
                  value={correctedSev}
                  onChange={e => setCorrectedSev(e.target.value)}
                  className="sys-input"
                  style={{marginBottom: 10}}
                >
                  <option value="S1">S1 — Critical</option>
                  <option value="S2">S2 — Major</option>
                  <option value="S3">S3 — Normal</option>
                  <option value="S4">S4 — Trivial</option>
                </select>
                <div style={{display: 'flex', gap: 10}}>
                  <button onClick={() => setShowCorrection(false)} className="sys-btn outline" style={{flex: 1, padding: 10}}>
                    Cancel
                  </button>
                  <button onClick={submitCorrection} className="sys-btn" disabled={submittingFeedback}
                    style={{flex: 1, padding: 10, background: 'var(--accent)'}}>
                    {submittingFeedback ? "Saving..." : "Submit Correction"}
                  </button>
                </div>
                <p style={{fontSize: 11, color: 'var(--text-sec)', marginTop: 8}}>
                  Your correction helps retrain the model for your team.
                </p>
              </div>
            )}

            {feedbackSent && (
              <div className="fade-in" style={{marginTop: 20, padding: 12, background: '#f0fdf4', borderRadius: 8, textAlign: 'center', fontSize: '13px', color: '#16a34a', fontWeight: '700', display: 'flex', alignItems:'center', justifyContent:'center', gap: 8}}>
                <CheckCircle size={16}/> Feedback Received
              </div>
            )}
          </div>

          <div className="ba-card">
            <div className="ba-card-header"><History size={16} /> Similar Past Bugs</div>
            <div className="custom-scrollbar" style={{maxHeight: 400, overflowY: 'auto'}}>
              {duplicates.length === 0 ? (
                <div style={{padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', display:'flex', flexDirection:'column', alignItems:'center', gap:10}}>
                  <Search size={32} style={{opacity:0.2}}/>
                  No similar bugs found.
                </div>
              ) : (
                duplicates.map((bug, index) => (
                  <div key={index} className="ba-bug-item">
                    <p className="ba-bug-summary">{bug.summary}</p>
                    <div className="ba-tags">
                      <span className="ba-tag tag-match">{bug.match}% Match</span>
                      <span className={`ba-tag ${bug.status === 'Fixed' ? 'tag-fixed' : 'tag-open'}`}>
                        {bug.status}
                      </span>
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
};

export default BugAnalysis;