import React, { useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle, Search, History, Bug, ThumbsUp,
  ThumbsDown, Sparkles, ArrowRight, RefreshCw,
  CheckCircle, XCircle
} from 'lucide-react';

const BugAnalysis = () => {
  const [query, setQuery] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [error, setError] = useState(null);
  const [feedbackSent, setFeedbackSent] = useState(false);

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
    setDuplicates([]);
    setFeedbackSent(false);

    if (overrideQuery) setQuery(overrideQuery);

    try {
      // FIX: Use relative endpoint and authentication header
      const token = localStorage.getItem("token");
      const response = await axios.post(`/api/analyze_bug`,
        { bug_text: textToAnalyze },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = response.data;

      if (data.severity) {
          setPrediction(data.severity);
          setDuplicates(data.similar_bugs || []);
      } else {
          setPrediction(data.prediction || { label: "Unknown", confidence: 0, action: "Check Manually" });
          setDuplicates(data.duplicates || []);
      }

    } catch (err) {
      console.error(err);
      setError("Could not connect to the server. Is the backend running?");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setPrediction(null);
    setDuplicates([]);
    setError(null);
    setFeedbackSent(false);
  };

  const sendFeedback = (isCorrect, actualSeverity) => {
    setFeedbackSent(true);
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
          placeholder="Describe the bug..."
          className="ba-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
        />
        {query && !analyzing && (
            <button onClick={handleClear} className="icon-btn" style={{marginRight: 8, color: '#94a3b8'}}>
                <XCircle size={18} />
            </button>
        )}
        <button onClick={() => handleAnalyze()} className="ba-analyze-btn" disabled={analyzing} style={{display:'flex', alignItems:'center', gap:8}}>
          {analyzing ? <><RefreshCw size={16} className="spin"/> Scanning...</> : "Analyze"}
        </button>
      </div>

      <div className="fade-in" style={{marginTop: 30, textAlign: 'center', marginBottom: prediction ? 20 : 0}}>
          <p style={{fontSize: 11, fontWeight: 800, color: '#94a3b8', marginBottom: 16, display:'flex', alignItems:'center', justifyContent:'center', gap:6, letterSpacing: 0.5}}>
              <Sparkles size={14} color="var(--accent)"/> TRY A DIFFERENT REPORT
          </p>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 650, margin: '0 auto'}}>
              {SAMPLE_BUGS.map((sample, i) => (
                  <button
                      key={i}
                      onClick={() => handleAnalyze(sample)}
                      className="sys-btn outline"
                      style={{ borderRadius: '20px', fontSize: 13, padding: '8px 18px', display:'flex', alignItems:'center' }}
                  >
                      {sample} <ArrowRight size={14} style={{marginLeft: 6, opacity: 0.4}}/>
                  </button>
              ))}
          </div>
      </div>

      {error && <div style={{ color: '#ef4444', marginTop: 20, textAlign: 'center', fontWeight: 'bold' }}>{error}</div>}

      {prediction && (
        <div className="ba-grid fade-in">
           <div className="ba-card">
            <div className="ba-card-header"><AlertTriangle size={16} /> Predicted Severity</div>

            <div className="ba-severity-content">
              <span className={`ba-badge-critical 
                  ${['CRITICAL', 'S1'].includes(prediction.label) ? 'ba-badge-critical' : ''}
                  ${['LOW', 'S3', 'S4'].includes(prediction.label) ? 'ba-badge-low' : ''}
                  ${['MEDIUM', 'S2'].includes(prediction.label) ? 'ba-badge-medium' : ''}
                  ${!['S1','S2','S3','S4','CRITICAL','LOW','MEDIUM'].includes(prediction.label) ? 'ba-badge-medium' : ''}
              `}>
                {prediction.label || "UNKNOWN"}
              </span>
              <p className="ba-confidence">Confidence Score <strong>{prediction.confidence || 0}%</strong></p>
            </div>

            <div className="ba-action-box">
              <p className="ba-action-label">Recommended Action</p>
              <p className="ba-action-text">{prediction.action || "No recommendation available."}</p>
            </div>

            {!feedbackSent && (
                <div style={{marginTop: 24, paddingTop: 20, borderTop: '1px dashed #e2e8f0'}}>
                    <p style={{fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5}}>
                        Is this accurate?
                    </p>
                    <div style={{display: 'flex', gap: 12}}>
                        <button
                            onClick={() => sendFeedback(true, prediction.label)}
                            className="sys-btn"
                            style={{ flex: 1, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '10px' }}
                        >
                            <ThumbsUp size={16}/> Yes
                        </button>
                        <button
                            onClick={() => {
                                const correct = prompt("What should the severity be? (S1, S2, S3)");
                                if(correct) sendFeedback(false, correct.toUpperCase());
                            }}
                            className="sys-btn"
                            style={{ flex: 1, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '10px' }}
                        >
                            <ThumbsDown size={16}/> No
                        </button>
                    </div>
                </div>
            )}
            {feedbackSent && (
                <div style={{marginTop: 20, padding: 12, background: '#f0fdf4', borderRadius: 8, textAlign: 'center', fontSize: '13px', color: '#16a34a', fontWeight: '700', display: 'flex', alignItems:'center', justifyContent:'center', gap: 8}}>
                    <CheckCircle size={16}/> Feedback Received
                </div>
            )}
          </div>

          <div className="ba-card">
            <div className="ba-card-header"><History size={16} /> Similar Past Bugs</div>
            <div className="custom-scrollbar" style={{maxHeight: 400, overflowY: 'auto', paddingRight: 4}}>
              {!duplicates || duplicates.length === 0 ? (
                  <div style={{padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', display:'flex', flexDirection:'column', alignItems:'center', gap:10}}>
                      <Search size={32} style={{opacity:0.2}}/>
                      No similar bugs found.
                  </div>
              ) : (
                  duplicates.map((bug, index) => (
                    <div key={index} className="ba-bug-item">
                      <p className="ba-bug-summary" title={bug.summary}>{bug.summary}</p>
                      <div className="ba-tags">
                        <span className="ba-tag tag-match">{bug.match}% Match</span>
                        <span className={`ba-tag ${bug.status === 'Fixed' || bug.status === 'RESOLVED' ? 'tag-fixed' : 'tag-open'}`}>
                            {bug.status || 'Unknown'}
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