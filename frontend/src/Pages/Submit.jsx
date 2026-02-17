import { useState } from 'react';
import axios from 'axios';
import { 
  Send, ShieldAlert, Sparkles, CheckCircle, 
  ChevronRight, List, Info, Database 
} from 'lucide-react';
import { ScrollSection } from '../Components/LayoutUtils';

export default function Submit({ user, onNavigate }) {
  const [summary, setSummary] = useState('');
  const [component, setComponent] = useState('Core');
  const [severity, setSeverity] = useState('S3');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // Helper for consistent headers
  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
  });

  // --- 1. AI ANALYSIS CALL ---
  const handleAnalyze = async () => {
    if (!summary) return;
    setLoading(true);
    try {
      // FIX 1: Use relative path for Proxy + Auth headers
      const res = await axios.post(
        `/analyze_bug?bug_text=${encodeURIComponent(summary)}`, 
        {}, 
        getHeaders()
      );
      setResult(res.data);
      if (res.data.severity) setSeverity(res.data.severity.label);
    } catch (err) {
      console.error("AI Error:", err);
      if (err.response?.status === 401) alert("Session expired. Please log in again.");
    } finally {
      setLoading(false);
    }
  };

  // --- 2. FINAL DATABASE SUBMISSION ---
  const handleFinalSubmit = async () => {
    try {
      const payload = {
        bug: {
          summary,
          component,
          severity,
          status: "NEW",
          platform: "Windows"
        },
        company_id: user.company_id
      };

      // FIX 2: Use relative path for Proxy + Auth headers
      await axios.post("/api/bug", payload, getHeaders());
      
      setSubmitted(true);
      setTimeout(() => onNavigate('database', ''), 2000);
    } catch (err) {
      console.error("Submit Error:", err);
      alert("Failed to save to database. Check if backend is running.");
    }
  };

  if (submitted) {
    return (
      <div className="page-content center-content" style={{height:'70vh'}}>
         <div className="success-anim fade-in">
            <CheckCircle size={80} color="#16a34a" />
            <h1 style={{marginTop:20}}>Report Filed Successfully</h1>
            <p style={{color:'#64748b'}}>Redirecting to Bug Explorer...</p>
         </div>
      </div>
    );
  }

  return (
    <div className="scroll-container">
      <section className="hero-section small">
        <div className="hero-content">
          <div className="live-pill"><Database size={12}/> REPOSITORY INGESTION</div>
          <h1>FILE NEW <span style={{color:'var(--accent)'}}>REPORT</span></h1>
        </div>
      </section>

      <ScrollSection className="submit-grid">
        {/* LEFT: INPUT FORM */}
        <div className="sys-card form-card">
           <h3 className="card-title"><Info size={16}/> Bug Details</h3>
           <div className="modern-form">
              <label>Brief Summary</label>
              <textarea 
                placeholder="Describe the defect (e.g., 'UI crash on login')..."
                value={summary}
                onChange={e => setSummary(e.target.value)}
              />

              <div className="form-row">
                 <div style={{flex:1}}>
                    <label>Component</label>
                    <select value={component} onChange={e=>setComponent(e.target.value)}>
                        <option>Core</option>
                        <option>Firefox</option>
                        <option>DevTools</option>
                        <option>Security</option>
                        <option>Networking</option>
                    </select>
                 </div>
                 <div style={{flex:1}}>
                    <label>Manual Priority</label>
                    <select value={severity} onChange={e=>setSeverity(e.target.value)}>
                        <option value="S1">S1 - Blocker</option>
                        <option value="S2">S2 - Critical</option>
                        <option value="S3">S3 - Normal</option>
                        <option value="S4">S4 - Low</option>
                    </select>
                 </div>
              </div>

              <button 
                className={`sys-btn full ${loading ? 'loading' : ''}`} 
                onClick={handleAnalyze}
                disabled={!summary || loading}
              >
                {loading ? 'ANALYZING...' : 'RUN AI CLASSIFICATION'}
                <Sparkles size={16}/>
              </button>
           </div>
        </div>

        {/* RIGHT: AI PREDICTION PREVIEW */}
        <div className="sys-card ai-preview-card">
            {!result ? (
                <div className="empty-preview">
                    <ShieldAlert size={48} color="#e2e8f0"/>
                    <p>Run AI classification to see predicted severity and similar historical bugs.</p>
                </div>
            ) : (
                <div className="fade-in">
                    <div className="prediction-header">
                        <div className="label-group">
                            <span className="tiny-label">AI PREDICTION</span>
                            <div className={`predicted-sev ${result.severity.label}`}>{result.severity.label}</div>
                        </div>
                        <div className="confidence-meter">
                            <div className="conf-value">{result.severity.confidence}% Confident</div>
                            <div className="conf-bar-bg">
                                <div className="conf-bar-fill" style={{width: `${result.severity.confidence}%`}}></div>
                            </div>
                        </div>
                    </div>

                    <div className="similar-bugs-list">
                        <span className="tiny-label">SIMILAR HISTORICAL BUGS (RAG)</span>
                        {result.similar_bugs && result.similar_bugs.length > 0 ? (
                           result.similar_bugs.map((b, i) => (
                              <div key={i} className="similar-item">
                                  <ChevronRight size={14} color="var(--accent)"/>
                                  <span className="sim-text" title={b.summary}>{b.summary}</span>
                                  <span className="sim-match">{b.match}% Match</span>
                              </div>
                           ))
                        ) : (
                          <div style={{padding: '10px 0', fontSize: 12, color: '#94a3b8'}}>No similar records found.</div>
                        )}
                    </div>

                    <button className="sys-btn full success" onClick={handleFinalSubmit} style={{marginTop:30, background: '#10b981'}}>
                        CONFIRM & SUBMIT TO DATABASE
                        <Send size={16}/>
                    </button>
                </div>
            )}
        </div>
      </ScrollSection>
    </div>
  );
}