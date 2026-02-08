import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Database, Activity, Server, AlertTriangle, ExternalLink, Zap 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';
// Note: We go up one level (..) to find Components
import { ScrollSection, SkeletonLoader } from '../Components/LayoutUtils';

// --- LIVE FEED COMPONENT (Helper for Overview) ---
function LiveFeedRow({ bug }) {
    return (
        <div className="live-feed-item">
            <div style={{display:'flex', alignItems:'center', gap:10}}>
                <Zap size={14} className={bug.severity === 'S1' ? 'icon-pulse-red' : 'icon-dim'} color={bug.severity==='S1'?'#ef4444':'#94a3b8'}/>
                <span className="feed-id">#{bug.id}</span>
            </div>
            <span className="feed-summary" title={bug.summary}>{bug.summary}</span>
            <span className={`pill ${bug.severity} tiny`}>{bug.severity}</span>
        </div>
    )
}

export default function Overview({ user, onNavigate }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const source = axios.CancelToken.source();
    const timeout = setTimeout(() => {
        if (!data) {
             source.cancel();
             loadDemoData();
        }
    }, 2000);

    // Using localhost for now - we can update this URL globally later
    axios.get(`http://127.0.0.1:8000/api/hub/overview?company_id=${user.company_id}`, { cancelToken: source.token })
         .then(res => {
             clearTimeout(timeout);
             setData(res.data);
         })
         .catch(err => {
            clearTimeout(timeout);
            if (axios.isCancel(err) || err) loadDemoData();
         });

    return () => clearTimeout(timeout);
  }, []);

  const loadDemoData = () => {
      setData({
        stats: { total_db: 220214, analyzed: 5000, critical: 142, components: 12 },
        charts: { components: [
            { name: 'Layout: Flexbox', count: 450 },
            { name: 'DOM: Core', count: 320 },
            { name: 'JS Engine', count: 280 },
            { name: 'Security: SSL', count: 150 },
            { name: 'WebRTC', count: 90 }
        ]},
        recent: [
            { id: 9821, summary: 'Crash in WebGL rendering context on startup', severity: 'S1' },
            { id: 9820, summary: 'Flexbox alignment breaks on mobile view', severity: 'S3' },
            { id: 9819, summary: 'Slow query execution in History API', severity: 'S2' },
            { id: 9818, summary: 'Memory leak in video decoder thread', severity: 'S1' },
            { id: 9817, summary: 'Typos in preferences menu', severity: 'S4' }
        ]
      });
  };

  if (!data) return <div className="page-content"><SkeletonLoader /></div>;

  const cardStyle = { cursor: 'pointer', transition: 'all 0.2s ease' };

  return (
    <div className="scroll-container">
      <section className="hero-section">
        <div className="hero-content">
          <div className="live-pill"><span className="pulse-dot"></span> SYSTEM ACTIVE</div>
          <h1>BUG PRIORITY <span style={{color:'var(--accent)'}}>OS</span></h1>
          <p className="subtitle">Firefox Intelligence & Defect Classification System</p>
        </div>
      </section>

      <ScrollSection className="stats-row">
         <div className="sys-card big-stat" style={cardStyle} onClick={() => onNavigate('database', '')}>
            <div className="stat-top-row">
                <span className="stat-label" style={{color:'#64748b'}}>DATABASE</span>
                <ExternalLink size={14} color="#94a3b8"/>
            </div>
            <div className="stat-main-content">
               <Database size={40} strokeWidth={1} color="#64748b" />
               <div><div className="stat-value">{data.stats.total_db.toLocaleString()}</div><div className="stat-sub">TOTAL RECORDS</div></div>
            </div>
         </div>

         <div className="sys-card big-stat" style={cardStyle} onClick={() => onNavigate('database', 'Active')}>
            <div className="stat-top-row">
                <span className="stat-label" style={{color:'#64748b'}}>PROCESSED</span>
                <ExternalLink size={14} color="#94a3b8"/>
            </div>
            <div className="stat-main-content">
               <Server size={40} strokeWidth={1} color="#3b82f6" />
               <div><div className="stat-value">{data.stats.analyzed.toLocaleString()}</div><div className="stat-sub">AI ANALYZED</div></div>
            </div>
         </div>

         <div className="sys-card big-stat highlight-blue" style={cardStyle} onClick={() => onNavigate('database', 'S1')}>
            <div className="stat-top-row"><span className="stat-label" style={{color:'#94a3b8'}}>CRITICAL</span><AlertTriangle size={18} color="#fff"/></div>
            <div className="stat-main-content">
               <Activity size={40} strokeWidth={1} color="#fff" />
               <div><div className="stat-value">{data.stats.critical}</div><div className="stat-sub" style={{color:'#cbd5e1'}}>ACTION REQUIRED</div></div>
            </div>
         </div>
      </ScrollSection>

      <ScrollSection className="feature-section right-align" style={{alignItems:'flex-start'}}>
        <div className="feature-text">
          <h2>BUG STREAM</h2>
          <div className="divider-line"></div>
          <p>Recent stream of bug summaries from the <strong>Firefox Bugzilla</strong> repository.</p>
          <button className="sys-btn outline" onClick={() => onNavigate('database', '')}>VIEW FULL LOGS</button>
        </div>
        <div className="feature-visual">
           <div className="sys-card feed-card">
             <div className="feed-header">
                <span style={{fontSize:11, fontWeight:800, color:'#64748b', textTransform:'uppercase'}}>Recent Analysis</span>
                <div className="pulse-dot"></div>
             </div>
             <div className="feed-list">
                {(data.recent || []).map((bug, i) => <LiveFeedRow key={i} bug={bug} />)}
             </div>
           </div>
        </div>
      </ScrollSection>

      <ScrollSection className="feature-section left-align">
         <div className="feature-visual">
            <div className="sys-card" style={{width:'100%', padding:20, height:320}}>
              <h3 style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:20, textTransform:'uppercase', letterSpacing:1}}>Top Failing Components</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.charts.components} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: 8, border:'none', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}}/>
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>
         <div className="feature-text">
            <h2>COMPONENT CHART</h2>
            <div className="divider-line"></div>
            <p>The system identifies high-risk components in the database. Currently, <strong>{data.charts.components[0]?.name || 'Unknown'}</strong> is showing as the highest.</p>
         </div>
      </ScrollSection>
    </div>
  );
}