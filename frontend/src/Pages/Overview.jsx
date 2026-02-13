import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Database, Activity, Server, AlertTriangle, ExternalLink, Zap 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';
import { ScrollSection, SkeletonLoader } from '../Components/LayoutUtils';


// --- LIVE FEED COMPONENT ---
function LiveFeedRow({ bug }) {
    return (
        <div className="live-feed-item">
            <div style={{display:'flex', alignItems:'center', gap:10}}>
                <Zap size={14} className={bug.severity === 'S1' ? 'icon-pulse-red' : 'icon-dim'} color={bug.severity==='S1'?'#ef4444':'#94a3b8'}/>
                <span className="feed-id">#{bug.id}</span>
            </div>
            <span className="feed-summary" title={bug.summary}>{bug.summary}</span>
            <span className={`pill ${bug.severity} tiny`}>{bug.severity || 'S3'}</span>
        </div>
    )
}

export default function Overview({ user, onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = () => {
        // 1. Get the token from storage
        const token = localStorage.getItem("token");

        // 2. Remove the query param and add the Header
        axios.get(`http://127.0.0.1:8000/api/hub/overview`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
             .then(res => {
                setData(res.data);
                setError(false); // Reset error if request succeeds
             })
             .catch(err => {
                console.error("Overview Error:", err);
                // If we get a 401, it means the token expired or is missing
                if (err.response?.status === 401) {
                    console.warn("Unauthorized! Please log in again.");
                }
                setError(true);
             });
    };

    fetchData(); 
    const interval = setInterval(fetchData, 5000); // Changed to 5s to be kinder to the server

    return () => clearInterval(interval);
  }, []); // Removed user.company_id dependency since we use the token now

  if (error) return <div className="page-content" style={{textAlign:'center', marginTop:50}}> Error loading stats. Is backend running?</div>;
  if (!data) return <div className="page-content"><SkeletonLoader /></div>;

  const cardStyle = { cursor: 'pointer', transition: 'all 0.2s ease' };

  return (
    <div className="scroll-container">
      <section className="hero-section">
        <div className="hero-content">
          <div className="live-pill"><span className="pulse-dot"></span> SYSTEM ACTIVE</div>
          <h1>BUG PRIORITY <span style={{color:'var(--accent)'}}>OS</span></h1>
          <p className="subtitle">Real-time Intelligence & Defect Classification</p>
        </div>
      </section>

      <ScrollSection className="stats-row">
         {/* 1. DATABASE CARD */}
         <div className="sys-card big-stat" style={cardStyle} onClick={() => onNavigate('database', '')}>
            <div className="stat-top-row">
                <span className="stat-label" style={{color:'#64748b'}}>DATABASE</span>
                <ExternalLink size={14} color="#94a3b8"/>
            </div>
            <div className="stat-main-content">
               <Database size={40} strokeWidth={1} color="#64748b" />
               <div>
                   <div className="stat-value">{data.stats.total_db.toLocaleString()}</div>
                   <div className="stat-sub">TOTAL RECORDS</div>
               </div>
            </div>
         </div>

         {/* 2. PROCESSED CARD */}
         <div className="sys-card big-stat" style={cardStyle} onClick={() => onNavigate('database', 'Fixed')}>
            <div className="stat-top-row">
                <span className="stat-label" style={{color:'#64748b'}}>PROCESSED</span>
                <ExternalLink size={14} color="#94a3b8"/>
            </div>
            <div className="stat-main-content">
               <Server size={40} strokeWidth={1} color="#3b82f6" />
               <div>
                   <div className="stat-value">{data.stats.analyzed.toLocaleString()}</div>
                   <div className="stat-sub">ACTION TAKEN</div>
               </div>
            </div>
         </div>

         {/* 3. CRITICAL CARD - Click filters for 'S1' */}
         <div className="sys-card big-stat highlight-blue" style={cardStyle} onClick={() => onNavigate('database', 'S1')}>
            <div className="stat-top-row"><span className="stat-label" style={{color:'#94a3b8'}}>CRITICAL</span><AlertTriangle size={18} color="#fff"/></div>
            <div className="stat-main-content">
               <Activity size={40} strokeWidth={1} color="#fff" />
               <div>
                   <div className="stat-value">{data.stats.critical}</div>
                   <div className="stat-sub" style={{color:'#cbd5e1'}}>ACTION REQUIRED</div>
               </div>
            </div>
         </div>
      </ScrollSection>

      <ScrollSection className="feature-section right-align" style={{alignItems:'flex-start'}}>
        <div className="feature-text">
          <h2>BUG STREAM</h2>
          <div className="divider-line"></div>
          <p>Live stream of the most recent bug submissions from your repository.</p>
          <button className="sys-btn outline" onClick={() => onNavigate('database', '')}>VIEW FULL LOGS</button>
        </div>
        <div className="feature-visual">
           <div className="sys-card feed-card">
             <div className="feed-header">
                <span style={{fontSize:11, fontWeight:800, color:'#64748b', textTransform:'uppercase'}}>Recent Analysis</span>
                <div className="pulse-dot"></div>
             </div>
             {/* [FIX] Added custom-scrollbar class here */}
             <div className="feed-list custom-scrollbar">
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
            <p>Real-time analysis of failing components. Currently, <strong>{data.charts.components[0]?.name || 'a component'}</strong> is reporting the highest volume of defects.</p>
         </div>
      </ScrollSection>
    </div>
  );
}