import React, { useState } from 'react';
import { AlertTriangle, Search, History, Bug } from 'lucide-react';
import './BugAnalysis.css';

const BugAnalysis = () => {
  const [query, setQuery] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!query) return;
    setAnalyzing(true);
    setError(null);

    try {
      // Connect to your Python Backend
      const response = await fetch(`http://127.0.0.1:8000/analyze_bug?bug_text=${encodeURIComponent(query)}`, {
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

  return (
    <div className="ba-container">
      <div className="ba-header">
        <h1 className="ba-title"><Bug size={24} /> Bug Analysis</h1>
        <p className="ba-subtitle">Paste a bug report to analyze its severity and find similar past issues</p>
      </div>

      <div className="ba-input-wrapper">
        <Search className="ba-search-icon" size={18} />
        <input 
          type="text" 
          placeholder="Paste bug report..." 
          className="ba-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={handleAnalyze} className="ba-analyze-btn" disabled={analyzing}>
          {analyzing ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: '20px', textAlign: 'center' }}>{error}</div>}

      {prediction && (
        <div className="ba-grid">
          <div className="ba-card">
            <div className="ba-card-header"><AlertTriangle size={16} /> Predicted Severity</div>
            <div className="ba-severity-content">
              {/* Dynamic Badge Color */}
              <span className={`
                  ${prediction.label === 'CRITICAL' || prediction.label === 'S1' ? 'ba-badge-critical' : ''}
                  ${prediction.label === 'LOW' || prediction.label === 'S3' || prediction.label === 'S4' ? 'ba-badge-low' : ''}
                  ${prediction.label === 'MEDIUM' || prediction.label === 'S2' ? 'ba-badge-medium' : ''}
              `}>
    {prediction.label}
</span>
              <p className="ba-confidence">Confidence Score <strong>{prediction.confidence}%</strong></p>
            </div>
            <div className="ba-action-box">
              <p className="ba-action-label">Recommended Action</p>
              <p className="ba-action-text">{prediction.action}</p>
            </div>
          </div>

          <div className="ba-card">
            <div className="ba-card-header"><History size={16} /> Similar Past Bugs</div>
            <div>
              {duplicates.map((bug, index) => (
                <div key={index} className="ba-bug-item">
                  <p className="ba-bug-summary">{bug.summary}</p>
                  <div className="ba-tags">
                    <span className="ba-tag tag-match">{bug.match}% Match</span>
                    <span className={`ba-tag ${bug.status === 'Fixed' ? 'tag-fixed' : 'tag-open'}`}>{bug.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BugAnalysis;