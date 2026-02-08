import React, { useState } from 'react';
import { AlertTriangle, Search, History, Bug, ThumbsUp, ThumbsDown, Sparkles, ArrowRight } from 'lucide-react';
import './BugAnalysis.css';

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
    const textToAnalyze = overrideQuery || query; // Use the argument if provided, otherwise state
    if (!textToAnalyze) return;

    setAnalyzing(true);
    setError(null);
    setPrediction(null);
    setFeedbackSent(false);

    // If using a sample, update the UI input box too
    if (overrideQuery) setQuery(overrideQuery);

    try {
      const response = await fetch(`http://127.0.0.1:8000/analyze_bug?bug_text=${encodeURIComponent(textToAnalyze)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to connect to backend");

      const data = await response.json();
      setPrediction(data.severity);
      setDuplicates(data.similar_bugs);

    } catch (err) {
      console.error(err);
      setError("Could not connect to the server. Is the backend running?");
    } finally {
      setAnalyzing(false);
    }
  };

  const sendFeedback = (isCorrect, actualSeverity) => {
    if (isCorrect) {
        alert("✅ Feedback sent: Prediction was correct!");
    } else {
        alert(`⚠️ Feedback sent: You flagged this as ${actualSeverity}`);
    }
    setFeedbackSent(true); 
  };

  return (
    <div className="ba-container">
      <div className="ba-header">
        <h1 className="ba-title"><Bug size={24} /> Bug Analysis</h1>
        <p className="ba-subtitle">AI-powered severity prediction and duplicate detection</p>
      </div>

      <div className="ba-input-wrapper">
        <Search className="ba-search-icon" size={18} />
        <input 
          type="text" 
          placeholder="Describe the bug (e.g., 'Application crashes on login')..." 
          className="ba-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
        />
        <button onClick={() => handleAnalyze()} className="ba-analyze-btn" disabled={analyzing}>
          {analyzing ? "Scanning..." : "Analyze"}
        </button>
      </div>

      {/* 👇 NEW: SAMPLE CHIPS (Only show when there are no results yet) */}
      {!prediction && !analyzing && (
        <div className="fade-in" style={{marginTop: 30, textAlign: 'center'}}>
            <p style={{fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 15, display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                <Sparkles size={14} color="var(--accent)"/> TRY A SAMPLE REPORT
            </p>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 600, margin: '0 auto'}}>
                {SAMPLE_BUGS.map((sample, i) => (
                    <button 
                        key={i}
                        onClick={() => handleAnalyze(sample)} // Runs instantly!
                        className="sys-btn outline"
                        style={{
                            fontSize: 13, 
                            padding: '8px 16px', 
                            borderRadius: '20px', 
                            border: '1px solid #e2e8f0',
                            background: 'white',
                            color: '#475569',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)'; }}
                        onMouseLeave={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.color = '#475569'; }}
                    >
                        {sample} <ArrowRight size={12} style={{marginLeft: 4, opacity: 0.5}}/>
                    </button>
                ))}
            </div>
        </div>
      )}

      {error && <div style={{ color: '#ef4444', marginTop: 20, textAlign: 'center', fontWeight: 'bold' }}>{error}</div>}

      {prediction && (
        <div className="ba-grid fade-in">
          {/* ... (Keep your prediction results exactly the same as before) ... */}
           {/* LEFT CARD: PREDICTION */}
           <div className="ba-card">
            <div className="ba-card-header"><AlertTriangle size={16} /> Predicted Severity</div>
            
            <div className="ba-severity-content">
              <span className={`ba-badge 
                  ${['CRITICAL', 'S1'].includes(prediction.label) ? 'ba-badge-critical' : ''}
                  ${['LOW', 'S3', 'S4'].includes(prediction.label) ? 'ba-badge-low' : ''}
                  ${['MEDIUM', 'S2'].includes(prediction.label) ? 'ba-badge-medium' : ''}
              `}>
                {prediction.label}
              </span>
              <p className="ba-confidence">Confidence Score <strong>{prediction.confidence}%</strong></p>
            </div>
            
            <div className="ba-action-box">
              <p className="ba-action-label">Recommended Action</p>
              <p className="ba-action-text">{prediction.action}</p>
            </div>

            {!feedbackSent && (
                <div style={{marginTop: 20, paddingTop: 15, borderTop: '1px dashed #e2e8f0'}}>
                    <p style={{fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase'}}>
                        Is this accurate?
                    </p>
                    <div style={{display: 'flex', gap: 10}}>
                        <button 
                            onClick={() => sendFeedback(true, prediction.label)}
                            style={{
                                flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #bbf7d0', 
                                background: '#f0fdf4', color: '#16a34a', fontSize: '12px', fontWeight: '600',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                        >
                            <ThumbsUp size={14}/> Yes
                        </button>
                        <button 
                            onClick={() => {
                                const correct = prompt("What should the severity be? (S1, S2, S3)");
                                if(correct) sendFeedback(false, correct.toUpperCase());
                            }}
                            style={{
                                flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', 
                                background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: '600',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                        >
                            <ThumbsDown size={14}/> No
                        </button>
                    </div>
                </div>
            )}
            {feedbackSent && (
                <div style={{marginTop: 15, textAlign: 'center', fontSize: '12px', color: '#16a34a', fontWeight: 'bold'}}>
                    ✓ Feedback Received
                </div>
            )}
          </div>

          {/* RIGHT CARD: SIMILAR BUGS */}
          <div className="ba-card">
            <div className="ba-card-header"><History size={16} /> Similar Past Bugs</div>
            <div>
              {duplicates.length === 0 ? (
                  <div style={{padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px'}}>No similar bugs found.</div>
              ) : (
                  duplicates.map((bug, index) => (
                    <div key={index} className="ba-bug-item">
                      <p className="ba-bug-summary" title={bug.summary}>{bug.summary}</p>
                      <div className="ba-tags">
                        <span className="ba-tag tag-match">{bug.match}% Match</span>
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
};

export default BugAnalysis;