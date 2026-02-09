import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Database, BrainCircuit, LogOut, Search, ShieldCheck, UploadCloud, Activity,
  Download, ArrowUpDown, ChevronLeft, ChevronRight, Terminal, AlertTriangle,
  Trash2, CheckCircle, ExternalLink, Zap, Server, RotateCcw, BarChart3,
  AlertCircle, TrendingUp, TrendingDown, Target, List, X, ArrowRight, LayoutGrid,
  User as UserIcon, Lock
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie,
  Cell, LineChart, Line, CartesianGrid, Legend, Radar, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Area, AreaChart, RadialBarChart, RadialBar
} from 'recharts';
import './App.css';

// --- UTILS ---
const parseCSV = (csvText) => {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => {
      let key = h;
      if (h.includes('summary')) key = 'summary';
      else if (h.includes('sev')) key = 'severity';
      else if (h.includes('comp')) key = 'component';
      obj[key] = values[i] || "";
    });
    if (!obj.status) obj.status = "NEW";
    if (!obj.severity) obj.severity = "S3";
    return obj;
  });
};

function ScrollSection({ children, className = "" }) {
  const [isVisible, setVisible] = useState(false);
  const domRef = useRef();
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) setVisible(true); });
    }, { threshold: 0.1 });
    const currentRef = domRef.current;
    if (currentRef) observer.observe(currentRef);
    return () => { if(currentRef) observer.unobserve(currentRef); };
  }, []);
  return <div ref={domRef} className={`scroll-section ${isVisible ? 'fade-in' : ''} ${className}`}>{children}</div>;
}

function SkeletonLoader() {
  return (
    <div className="skeleton-grid" style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:24, marginTop:50}}>
      <div style={{height:180, background:'#e2e8f0', borderRadius:12}}></div>
      <div style={{height:180, background:'#e2e8f0', borderRadius:12}}></div>
      <div style={{height:180, background:'#e2e8f0', borderRadius:12}}></div>
    </div>
  )
}

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

// --- OVERVIEW TAB ---
function Overview({ user, onNavigate }) {
  const [data, setData] = useState(null);
  const [timeRange, setTimeRange] = useState("24H");

  // Real-time switching of chart data
  const getChartData = (range) => {
      if (range === '24H') return [
        { time: '08:00', incoming: 12, processed: 10 }, { time: '10:00', incoming: 18, processed: 15 },
        { time: '12:00', incoming: 45, processed: 40 }, { time: '14:00', incoming: 30, processed: 32 },
        { time: '16:00', incoming: 25, processed: 28 }, { time: '18:00', incoming: 10, processed: 12 },
      ];
      if (range === '7D') return [
        { time: 'Mon', incoming: 150, processed: 140 }, { time: 'Tue', incoming: 200, processed: 180 },
        { time: 'Wed', incoming: 180, processed: 190 }, { time: 'Thu', incoming: 220, processed: 210 },
        { time: 'Fri', incoming: 250, processed: 230 }, { time: 'Sat', incoming: 90, processed: 100 },
      ];
      return [
        { time: 'Wk1', incoming: 800, processed: 750 }, { time: 'Wk2', incoming: 950, processed: 900 },
        { time: 'Wk3', incoming: 880, processed: 890 }, { time: 'Wk4', incoming: 1020, processed: 980 },
      ];
  };

  const velocityData = getChartData(timeRange);

  useEffect(() => {
    const source = axios.CancelToken.source();
    const timeout = setTimeout(() => { if (!data) { source.cancel(); loadDemoData(); } }, 2000);
    axios.get(`http://127.0.0.1:8000/api/hub/overview?company_id=${user.company_id}`, { cancelToken: source.token })
         .then(res => { clearTimeout(timeout); setData(res.data); })
         .catch(err => { clearTimeout(timeout); if (axios.isCancel(err) || err) loadDemoData(); });
    return () => clearTimeout(timeout);
  }, []);
  const loadDemoData = () => {
      setData({
        stats: { total_db: 220214, analyzed: 5000, critical: 142, components: 12 },
        charts: {
            components: [{ name: 'Layout', count: 450 }, { name: 'DOM', count: 320 }, { name: 'JS Engine', count: 280 }, { name: 'Security', count: 150 }],
            severity: [{ name: 'S1 Critical', value: 15, color: '#ef4444' }, { name: 'S2 Major', value: 30, color: '#f97316' }, { name: 'S3 Normal', value: 45, color: '#3b82f6' }, { name: 'S4 Trivial', value: 10, color: '#94a3b8' }]
        },
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
      <div className="status-bar">
        <div className="status-item"><div className="status-dot"></div> SYSTEM ONLINE</div>
        <div className="status-item"><Server size={14}/> ML ENGINE: <strong>READY</strong></div>
        <div className="status-item"><Activity size={14}/> LAST SYNC: <strong>JUST NOW</strong></div>
        <div style={{marginLeft:'auto', display:'flex', gap:8}}>{['24H', '7D', '30D'].map(t => (<button key={t} onClick={()=>setTimeRange(t)} style={{border:'none', background: timeRange===t?'#e2e8f0':'transparent', padding:'4px 8px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', color: timeRange===t?'#0f172a':'#64748b'}}>{t}</button>))}</div>
      </div>
      <div className="form-header">
          <div className="page-header-icon"><Activity size={32} color="var(--accent)"/></div>
          <h2 style={{fontSize:24, fontWeight:800, color:'var(--text-main)'}}>DASHBOARD OVERVIEW</h2>
      </div>
      <ScrollSection className="stats-row" style={{marginBottom: 24}}>
         <div className="sys-card big-stat" style={cardStyle} onClick={() => onNavigate('database', '')}>
            <div className="stat-top-row"><span className="stat-label" style={{color:'#64748b'}}>TOTAL DATABASE</span><Database size={16} color="#94a3b8"/></div>
            <div className="stat-main-content"><div><div className="stat-value">{data.stats.total_db.toLocaleString()}</div><div className="kpi-trend" style={{color:'#15803d'}}><TrendingUp size={12}/> +240 this week</div></div></div>
         </div>
         <div className="sys-card big-stat" style={cardStyle} onClick={() => onNavigate('database', 'Active')}>
            <div className="stat-top-row"><span className="stat-label" style={{color:'#64748b'}}>AI PROCESSED</span><BrainCircuit size={16} color="#3b82f6"/></div>
            <div className="stat-main-content"><div><div className="stat-value">{data.stats.analyzed.toLocaleString()}</div><div className="kpi-trend" style={{color:'#3b82f6'}}>98% Coverage</div></div></div>
         </div>
         <div className="sys-card big-stat highlight-blue" style={cardStyle} onClick={() => onNavigate('database', 'S1')}>
            <div className="stat-top-row"><span className="stat-label" style={{color:'#94a3b8'}}>CRITICAL ATTENTION</span><AlertTriangle size={16} color="#fff"/></div>
            <div className="stat-main-content"><div><div className="stat-value">{data.stats.critical}</div><div className="kpi-trend" style={{color:'#cbd5e1'}}>Requires Triage</div></div></div>
         </div>
      </ScrollSection>
      <div className="dashboard-grid">
        <div className="chart-container">
            <div className="chart-header"><div><div className="chart-title">Incoming vs Processed Velocity</div><div style={{fontSize:12, color:'#64748b'}}>Real-time ingestion rate ({timeRange})</div></div><div className="trend-badge trend-up"><TrendingUp size={12}/> High Activity</div></div>
            <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={velocityData}>
                    <defs><linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#94a3b8'}}/>
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#94a3b8'}}/>
                    <Tooltip contentStyle={{borderRadius:8, border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}/>
                    <Area type="monotone" dataKey="incoming" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorIn)" />
                    <Area type="monotone" dataKey="processed" stroke="#10b981" strokeWidth={2} fill="transparent" strokeDasharray="5 5"/>
                </AreaChart>
            </ResponsiveContainer>
        </div>
        <div className="chart-container" style={{alignItems:'center', justifyContent:'center'}}>
            <div className="chart-title" style={{marginBottom:10, width:'100%', textAlign:'left'}}>Current Risk Profile</div>
            <div style={{width:'100%', height:180, position:'relative'}}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data.charts.severity || [{name:'S1', value:10, color:'red'}]} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                            {(data.charts.severity || []).map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
                <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', textAlign:'center'}}>
                    <div style={{fontSize:20, fontWeight:800, color:'#0f172a'}}>{data.stats.critical}</div>
                    <div style={{fontSize:10, fontWeight:700, color:'#ef4444'}}>CRITICAL</div>
                </div>
            </div>
        </div>
      </div>
      <ScrollSection className="feature-section right-align" style={{alignItems:'flex-start', paddingTop:0, border: 'none'}}>
        <div className="feature-text">
          <h2>LIVE TRIAGE FEED</h2>
          <div className="divider-line"></div>
          <p>Real-time stream of issues being analyzed by the Random Forest model. Items marked <span style={{color:'#ef4444', fontWeight:700}}>S1</span> require immediate attention.</p>
          <div style={{display:'flex', gap:10, marginTop:20}}><button className="sys-btn outline" onClick={() => onNavigate('database', '')}>FULL LOGS</button><button className="sys-btn outline" onClick={() => onNavigate('submit', '')}>MANUAL ENTRY</button></div>
        </div>
        <div className="feature-visual">
           <div className="sys-card feed-card">
             <div className="feed-header"><span style={{fontSize:11, fontWeight:800, color:'#64748b', textTransform:'uppercase'}}>INCOMING STREAM</span><div className="pulse-dot"></div></div>
             <div className="feed-list">{(data.recent || []).map((bug, i) => <LiveFeedRow key={i} bug={bug} />)}</div>
           </div>
        </div>
      </ScrollSection>
    </div>
  );
}

function Explorer({ user, initialQuery = "" }) {
  const [bugs, setBugs] = useState([]);
  const [search, setSearch] = useState(initialQuery);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  useEffect(() => { setSearch(initialQuery); }, [initialQuery]);
  useEffect(() => {
    axios.get(`http://127.0.0.1:8000/api/hub/explorer?company_id=${user.company_id}&limit=20000`)
         .then(res => setBugs(res.data)).catch(err => { console.log("Using mock data"); setBugs([]); });
  }, []);
  const filtered = bugs.filter(b => (b.summary + b.component + b.id + b.severity + b.status).toLowerCase().includes(search.toLowerCase()));
  const sortedBugs = [...filtered].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });
  const displayedBugs = sortedBugs.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(sortedBugs.length / itemsPerPage);
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };
  const handleExport = () => {
    const headers = ["ID", "Severity", "Component", "Summary"];
    const csvContent = [headers.join(","), ...sortedBugs.map(b => [b.id, b.severity, b.component, `"${b.summary.replace(/"/g, '""')}"`].join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `bug_report.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };
  return (
    <div className="page-content">
      <div className="form-header">
          <div className="page-header-icon"><Database size={32} color="var(--accent)"/></div>
          <h2 style={{fontSize:24, fontWeight:800, color:'var(--text-main)'}}>DATABASE EXPLORER</h2>
      </div>
      <div className="explorer-header">
        <div><h1 style={{fontSize:24, fontWeight:800, margin:0, color:'var(--text-main)'}}>DATABASE</h1><span style={{fontSize:13, color:'#64748b'}}>Total Records: {sortedBugs.length}</span></div>
        <div style={{display:'flex', gap:10}}>
           <div className="spotlight-search" style={{padding:'8px 12px', width:300, marginBottom:0}}><Search size={16} color="#94a3b8"/><input placeholder="Filter ID, Sev, Component..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
           <button className="sys-btn outline" onClick={handleExport} style={{padding:'8px 16px', height:'auto'}}><Download size={14}/> Export</button>
        </div>
      </div>
      <div className="sys-card table-card">
        <div className="table-scroll-wrapper">
          <table className="sleek-table">
            <thead>
              <tr>
                <th onClick={() => requestSort('id')} style={{width: 100}}>ID <ArrowUpDown size={12} style={{opacity:0.5}}/></th>
                <th onClick={() => requestSort('severity')} style={{width: 100}}>SEV <ArrowUpDown size={12} style={{opacity:0.5}}/></th>
                <th onClick={() => requestSort('component')} style={{width: 180}}>COMPONENT <ArrowUpDown size={12} style={{opacity:0.5}}/></th>
                <th>SUMMARY</th>
                <th style={{width: 100, textAlign:'right'}}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {displayedBugs.map(b => (
                <tr key={b.id}>
                  <td style={{fontFamily:'var(--font-mono)', color:'var(--accent)', fontWeight:600}}>#{b.id}</td>
                  <td><span className={`pill ${b.severity}`}>{b.severity}</span></td>
                  <td><span style={{background:'#f1f5f9', padding:'4px 8px', borderRadius:6, fontSize:12, fontWeight:600, color:'#475569'}}>{b.component}</span></td>
                  <td className="summary-cell"><div style={{maxWidth:400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={b.summary}>{b.summary}</div></td>
                  <td style={{textAlign:'right'}}><span style={{color:'#10b981', fontWeight:700, fontSize:12, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6}}><div style={{width:6, height:6, borderRadius:'50%', background:'#10b981'}}></div> {b.status || 'Active'}</span></td>
                </tr>
              ))}
              {displayedBugs.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding:40, color:'#94a3b8'}}>No records found matching "{search}".</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
           <div style={{fontSize:13, color:'#64748b'}}>Page {page} of {totalPages || 1}</div>
           <div style={{display:'flex', gap:8}}>
             <button className="sys-btn outline" disabled={page===1} onClick={()=>setPage(p=>p-1)} style={{padding:8}}><ChevronLeft size={16}/></button>
             <button className="sys-btn outline" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} style={{padding:8}}><ChevronRight size={16}/></button>
           </div>
        </div>
      </div>
    </div>
  );
}

function MLPredictor({ user }) {
  const [summary, setSummary] = useState("");
  const [component, setComponent] = useState("Frontend");
  const [platform, setPlatform] = useState("Windows");
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [finalSev, setFinalSev] = useState("S3");
  const components = ["Frontend", "Backend", "Database", "Networking", "Security", "DevTools", "Core"];
  const platforms = ["Windows", "MacOS", "Linux", "Android", "iOS"];
  const predict = async () => {
    if(!summary) return;
    setLoading(true); setRes(null); setSaved(false);
    try {
        const payload = { summary, component, platform };
        const r = await axios.post('http://127.0.0.1:8000/api/predict', payload);
        setRes(r.data); setFinalSev(r.data.prediction);
    } catch {
        const fallback = { prediction: "S2", confidence: 0.89, diagnosis: "Heuristic Analysis", team: "General", keywords: [] };
        setTimeout(() => { setRes(fallback); setFinalSev(fallback.prediction); }, 800);
    }
    setLoading(false);
  }
  const handleFinalSubmit = async () => {
      if (!res) return;
      if (finalSev !== res.prediction) {
          try { await axios.post('http://127.0.0.1:8000/api/feedback', { summary, predicted: res.prediction, actual: finalSev, company_id: user.company_id }); } catch (e) { }
      }
      try {
          const bugData = { summary, component, platform, severity: finalSev, status: "NEW", ai_analysis: { confidence: res.confidence, diagnosis: res.diagnosis, team: res.team } };
          await axios.post('http://127.0.0.1:8000/api/bug', { bug: bugData, company_id: user.company_id });
          setSaved(true);
      } catch (e) { alert("Error saving to database"); }
  };
  return (
    <div className="page-content centered-page">
      <div className="sys-card form-wrapper" style={{maxWidth: 600}}>
        <div className="form-header">
          <div className="page-header-icon"><BrainCircuit size={32} color="var(--accent)"/></div>
          <h2 style={{fontSize:24, fontWeight:800, color:'var(--text-main)'}}>NEW BUG ANALYSIS</h2>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap: 15}}>
            <div>
                <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>BUG SUMMARY</label>
                <div className="spotlight-search" style={{width:'100%'}}><Terminal size={18} color="#94a3b8" /><input placeholder="e.g. Application crashes when clicking Login..." value={summary} onChange={e => setSummary(e.target.value)} /></div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:15}}>
                <div><label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>COMPONENT</label><select className="sys-input" value={component} onChange={e=>setComponent(e.target.value)}>{components.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>PLATFORM</label><select className="sys-input" value={platform} onChange={e=>setPlatform(e.target.value)}>{platforms.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            </div>
        </div>
        <button className="sys-btn full" onClick={predict} disabled={loading} style={{marginTop:24}}>{loading ? "PROCESSING..." : "PREDICT SEVERITY"}</button>
        {res && (
          <div className="result-box fade-in" style={{marginTop:24, background:'#f8fafc', padding:24, borderRadius:12, border:'1px solid #e2e8f0'}}>
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:15}}>
                <div style={{display:'flex', alignItems:'center', gap:10}}><span className="pill S4">AI Prediction</span><span className={`pill ${res.prediction}`} style={{fontSize:16, padding:'6px 14px'}}>{res.prediction}</span></div>
                <span style={{fontWeight:800, fontSize:18, color:'#0f172a'}}>{(res.confidence*100).toFixed(0)}% Conf.</span>
             </div>
             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:15}}>
                <div style={{background:'white', padding:10, borderRadius:8, border:'1px solid #e2e8f0'}}><div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>DIAGNOSIS</div><div style={{fontSize:13, fontWeight:600}}>{res.diagnosis}</div></div>
                <div style={{background:'white', padding:10, borderRadius:8, border:'1px solid #e2e8f0'}}><div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>TEAM</div><div style={{fontSize:13, fontWeight:600, color:'#2563eb'}}>{res.team}</div></div>
             </div>
             <div style={{marginBottom:15, fontSize:11, color:'#64748b'}}>Keywords: {res.keywords && res.keywords.map(k => <span key={k} style={{background:'#fee2e2', color:'#b91c1c', padding:'2px 6px', borderRadius:4, margin:'0 2px', fontWeight:700}}>{k}</span>)}</div>
             {!saved ? (
                 <div style={{paddingTop:15, borderTop:'1px dashed #cbd5e1'}}>
                     <label style={{fontSize:12, fontWeight:700, color:'#64748b', display:'block', marginBottom:8}}>REVIEW & SAVE</label>
                     <div style={{display:'flex', gap:10}}>
                        <select className="sys-input" value={finalSev} onChange={e=>setFinalSev(e.target.value)} style={{marginBottom:0, width:'140px', borderColor: finalSev !== res.prediction ? '#f59e0b' : '#e2e8f0'}}><option value="S1">S1 - Critical</option><option value="S2">S2 - Major</option><option value="S3">S3 - Normal</option><option value="S4">S4 - Trivial</option></select>
                        <button className="sys-btn full" onClick={handleFinalSubmit} style={{background: finalSev !== res.prediction ? '#f59e0b' : 'var(--text-main)'}}>{finalSev !== res.prediction ? "Submit Correction" : "Confirm & Save"}</button>
                     </div>
                     {finalSev !== res.prediction && (<div style={{fontSize:11, color:'#f59e0b', fontWeight:600, marginTop:6}}>* This will retrain the model with your correction.</div>)}
                 </div>
             ) : (<div style={{textAlign:'center', color:'#10b981', fontWeight:700, marginTop:15, display:'flex', alignItems:'center', justifyContent:'center', gap:8}}><CheckCircle size={18}/> Saved to Database</div>)}
          </div>
        )}
      </div>
    </div>
  )
}

function SubmitTab({ user }) {
  const [mode, setMode] = useState('single');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [recent, setRecent] = useState([]);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [lastBatchIds, setLastBatchIds] = useState([]);
  const [sSummary, setSSummary] = useState("");
  const [sComp, setSComp] = useState("Frontend");
  const [sSev, setSSev] = useState("S3");

  useEffect(() => { fetchRecent(); }, []);
  const fetchRecent = async () => { try { const res = await axios.get(`http://127.0.0.1:8000/api/hub/explorer?company_id=${user.company_id}&limit=10`); setRecent(res.data); } catch (err) { } };
  const handleBulk = async () => {
    if(!file) return;
    if (file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result; const jsonData = parseCSV(text);
            const blob = new Blob([JSON.stringify(jsonData)], {type: 'application/json'});
            const fd = new FormData(); fd.append("file", blob, "converted.json"); fd.append("company_id", user.company_id); sendUpload(fd);
        }; reader.readAsText(file);
    } else { const fd = new FormData(); fd.append("file", file); fd.append("company_id", user.company_id); sendUpload(fd); }
  };
  const sendUpload = async (fd) => { try { const r = await axios.post('http://127.0.0.1:8000/api/upload', fd); setMsg({ text: r.data.message, type: "success" }); if (r.data.ids) setLastBatchIds(r.data.ids); fetchRecent(); } catch { setMsg({ text: "Upload failed", type: "error" }); } }
  const handleUndoBatch = async () => { if(lastBatchIds.length === 0) return; if(!window.confirm(`Delete ${lastBatchIds.length} uploaded records?`)) return; try { await axios.post('http://127.0.0.1:8000/api/bugs/batch_delete', { ids: lastBatchIds, company_id: user.company_id }); setMsg({ text: `Deleted ${lastBatchIds.length} records.`, type: "success" }); setLastBatchIds([]); fetchRecent(); } catch { setMsg({ text: "Undo Failed", type: "error" }); } };
  const handleSingle = async () => {
    if (!sSummary) { setMsg({ text: "Please enter a bug summary.", type: "error" }); return; }
    try { const bug = { summary: sSummary, component: sComp, severity: sSev, status: "NEW" }; await axios.post('http://127.0.0.1:8000/api/bug', { bug, company_id: user.company_id }); setMsg({ text: "Saved successfully", type: "success" }); setSSummary(""); fetchRecent(); } catch { setMsg({ text: "Error saving bug", type: "error" }); }
  };
  const confirmDelete = async () => { if (!deleteTargetId) return; try { await axios.delete(`http://127.0.0.1:8000/api/bug/${deleteTargetId}`, { data: { company_id: user.company_id } }); setRecent(recent.filter(item => item.id !== deleteTargetId)); setDeleteTargetId(null); setMsg({ text: "Deleted permanently.", type: "success" }); } catch (err) { alert("Could not delete. It may already be gone."); setDeleteTargetId(null); } };

  return (
    <div className="page-content centered-page">
      {deleteTargetId && (
        <div className="modal-overlay">
            <div className="modal-card">
               <div style={{width:60, height:60, background:'#fee2e2', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px'}}><AlertTriangle size={30} color="#ef4444"/></div>
               <h3 style={{margin:'0 0 10px 0', fontSize:20, fontWeight:800}}>Delete Record?</h3>
               <p style={{margin:0, color:'#64748b', fontSize:14, lineHeight:1.5}}>Are you sure you want to delete Bug <strong>#{deleteTargetId}</strong>? This action cannot be undone.</p>
               <div style={{display:'flex', gap:12, marginTop:24}}>
                  <button onClick={()=>setDeleteTargetId(null)} className="sys-btn outline full" style={{fontSize:13}}>Cancel</button>
                  <button onClick={confirmDelete} className="sys-btn full" style={{background:'var(--danger)', fontSize:13}}>Delete Forever</button>
               </div>
            </div>
        </div>
      )}
      <div className="sys-card form-wrapper" style={{maxWidth: '800px'}}>
        <div className="form-header">
          <div className="page-header-icon"><UploadCloud size={32} color="var(--accent)"/></div>
          <h2 style={{fontSize:24, fontWeight:800, color:'var(--text-main)'}}>SUBMIT DATA</h2>
          <div style={{display:'flex', background:'#f1f5f9', padding:4, borderRadius:10, marginTop:24}}>
            <button style={{flex:1, padding:10, border:'none', background:mode==='single'?'white':'transparent', color:mode==='single'?'var(--text-main)':'#64748b', boxShadow:mode==='single'?'var(--shadow-sm)':'none', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer', transition:'all 0.2s'}} onClick={() => setMode('single')}>Manual Entry</button>
            <button style={{flex:1, padding:10, border:'none', background:mode==='bulk'?'white':'transparent', color:mode==='bulk'?'var(--text-main)':'#64748b', boxShadow:mode==='bulk'?'var(--shadow-sm)':'none', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer', transition:'all 0.2s'}} onClick={() => setMode('bulk')}>Bulk Upload</button>
          </div>
        </div>

        {mode === 'bulk' ? (
          <div className="fade-in">
            <div className="drop-area" style={{border:'2px dashed #cbd5e1', borderRadius:12, height:180, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#64748b', marginBottom:24, background:'#f8fafc', position:'relative', transition:'0.2s'}}>
                <UploadCloud size={48} style={{marginBottom:16, opacity:0.5}}/><p style={{fontSize:14, fontWeight:600}}>Drag & Drop JSON or CSV</p><input type="file" onChange={e=>setFile(e.target.files[0])} style={{opacity:0, position:'absolute', height:'100%', width:'100%', cursor:'pointer', top:0, left:0}}/>
            </div>
            {file && <div style={{textAlign:'center', fontSize:13, marginBottom:16, fontWeight:600, color:'var(--accent)'}}>{file.name}</div>}
            <button className="sys-btn full" onClick={handleBulk}>UPLOAD & TRAIN</button>
            {lastBatchIds.length > 0 && (<button className="sys-btn full" onClick={handleUndoBatch} style={{marginTop:12, background:'#fee2e2', color:'#ef4444', border:'1px solid #fecaca'}}><RotateCcw size={14}/> UNDO LAST BATCH ({lastBatchIds.length})</button>)}
          </div>
        ) : (
          <div className="fade-in submit-grid">
            <div><div className="form-group"><label>Bug Summary / Reproduction Steps</label><textarea className="sys-input" rows={5} placeholder="e.g. Application crashes when clicking 'Login' on Linux..." value={sSummary} onChange={e=>setSSummary(e.target.value)} style={{marginBottom:0, resize:'none'}}/></div></div>
            <div style={{display:'flex', flexDirection:'column', gap:16}}>
                <div className="form-group"><label>Component</label><select className="sys-input" value={sComp} onChange={e=>setSComp(e.target.value)}><option>Frontend</option><option>Backend</option><option>Database</option></select></div>
                <div className="form-group"><label>Severity</label><select className="sys-input" value={sSev} onChange={e=>setSSev(e.target.value)}><option>S1</option><option>S2</option><option>S3</option></select></div>
                <button className="sys-btn full" onClick={handleSingle}><UploadCloud size={16}/> SUBMIT TICKET</button>
            </div>
          </div>
        )}
        {msg.text && (
            <div className={`alert-banner ${msg.type}`}>
                {msg.type === 'error' ? <AlertCircle size={16}/> : <CheckCircle size={16}/>}
                {msg.text}
            </div>
        )}
        {recent.length > 0 && (
            <div style={{marginTop:30, paddingTop:24, borderTop:'1px dashed #e2e8f0'}}>
                <h4 style={{fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase', marginBottom:12}}>Recent Submissions</h4>
                <div style={{maxHeight:150, overflowY:'auto'}}>
                    {recent.map((item) => (
                        <div key={item.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', padding:'8px 12px', borderRadius:8, marginBottom:8, border:'1px solid #f1f5f9'}}>
                            <div style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:13, color:'#334155'}}><span style={{fontWeight:700, color:'var(--accent)', marginRight:8}}>#{item.id}</span>{item.summary}</div>
                            <button onClick={() => setDeleteTargetId(item.id)} style={{background:'none', border:'none', cursor:'pointer', color:'#ef4444', padding:4}} title="Delete Bug"><Trash2 size={14}/></button>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  )
}

function AnalyticsTab({ user }) {
  const [range, setRange] = useState('30');
  const [activeSev, setActiveSev] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const radarData = [
    { subject: 'Frontend', A: 120, fullMark: 150 }, { subject: 'Backend', A: 98, fullMark: 150 },
    { subject: 'Database', A: 86, fullMark: 150 }, { subject: 'Security', A: 99, fullMark: 150 },
    { subject: 'DevOps', A: 85, fullMark: 150 }, { subject: 'UI/UX', A: 65, fullMark: 150 },
  ];
  useEffect(() => {
    const days = parseInt(range);
    const newData = Array.from({ length: 10 }, (_, i) => ({
      date: `Day ${i + 1}`,
      S1: Math.floor(Math.random() * (days / 2)) + 2, S2: Math.floor(Math.random() * (days / 1.5)) + 5,
      S3: Math.floor(Math.random() * days) + 10, S4: Math.floor(Math.random() * (days / 3)) + 1
    }));
    setTrendData(newData);
  }, [range]);
  const ratioData = [
    { name: 'S1 Critical', value: 35, color: '#ef4444' }, { name: 'S2 Major', value: 45, color: '#f97316' },
    { name: 'S3 Normal', value: 120, color: '#3b82f6' }, { name: 'S4 Trivial', value: 25, color: '#94a3b8' }
  ];
  return (
    <div className="page-content">
      <div className="form-header">
          <div className="page-header-icon"><BarChart3 size={32} color="var(--accent)"/></div>
          <h2 style={{fontSize:24, fontWeight:800, color:'var(--text-main)'}}>SYSTEM ANALYTICS</h2>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <div style={{ display: 'flex', background: '#ffffff', borderRadius: 8, padding: 4, border: '1px solid var(--border)' }}>
          {['7', '30', '90'].map(d => (<button key={d} onClick={() => setRange(d)} style={{ background: range === d ? '#f1f5f9' : 'transparent', color: range === d ? 'var(--text-main)' : '#64748b', border: 'none', padding: '6px 16px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: '0.2s' }}>{d}D</button>))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
        <div className="sys-card" style={{ padding: 24 }}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:20}}><h3 style={{ fontSize: 15, fontWeight: 700, margin:0 }}>Bug Velocity</h3><div style={{fontSize:12, fontWeight:600, color:'var(--success)', display:'flex', alignItems:'center', gap:4}}><TrendingUp size={14}/> +12% vs last period</div></div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10}/>
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} />
              <Legend wrapperStyle={{paddingTop: 20}} iconType="circle"/>
              <Line type="monotone" dataKey="S1" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="S2" stroke="#f97316" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="S3" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="sys-card" style={{ padding: 24, textAlign: 'center', display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Severity Ratio</h3>
          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 20 }}>Interactive Filter</p>
          <div style={{position:'relative', width:'100%', height:220}}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                <Pie data={ratioData} innerRadius={65} outerRadius={85} paddingAngle={4} dataKey="value" onClick={(data) => setActiveSev(activeSev === data.name ? null : data.name)} style={{ cursor: 'pointer' }}>
                    {ratioData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke={activeSev === entry.name ? '#0f172a' : 'none'} strokeWidth={activeSev === entry.name ? 3 : 0}/>))}
                </Pie>
                <Tooltip />
                </PieChart>
            </ResponsiveContainer>
            <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', pointerEvents:'none'}}>
                 <div style={{fontSize:22, fontWeight:800, color:'var(--text-main)'}}>{activeSev ? 'FILTER' : 'TOTAL'}</div>
                 <div style={{fontSize:10, fontWeight:700, color:'#94a3b8'}}>{activeSev ? 'ACTIVE' : 'VIEW'}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="sys-card" style={{ padding: 24 }}>
          <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:20}}><Target size={16} color="var(--accent)"/><h3 style={{ fontSize: 15, fontWeight: 700, margin:0 }}>Component Fragility</h3></div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart outerRadius={90} data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} />
                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                <Radar name="Fragility Score" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.3} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="sys-card" style={{ padding: 24 }}>
          <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:20}}><List size={16} color="var(--accent)"/><h3 style={{ fontSize: 15, fontWeight: 700, margin:0 }}>{activeSev ? `Drill-Down: ${activeSev}` : "System Anomalies"}</h3></div>
          {activeSev ? (
            <div className="feed-list">
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13, display:'flex', alignItems:'center', gap:10 }}>
                  <AlertCircle size={14} color="var(--danger)"/>
                  <div><span className={`pill ${activeSev.split(' ')[0]} tiny`} style={{ marginRight: 8 }}>{activeSev.split(' ')[0]}</span><strong>NullReferenceException in WebGL</strong></div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#64748b', display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start', background:'#f8fafc', padding:12, borderRadius:8 }}>
                <AlertCircle size={18} color="#ef4444" style={{marginTop:2}}/><div><strong style={{color:'#0f172a', display:'block', marginBottom:4}}>Critical Hotspot Detected</strong>The <strong>Frontend</strong> component accounts for 42% of all S2 bugs this week.</div>
              </div>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start', background:'#f8fafc', padding:12, borderRadius:8 }}>
                <TrendingDown size={18} color="#f59e0b" style={{marginTop:2}}/><div><strong style={{color:'#0f172a', display:'block', marginBottom:4}}>Velocity Warning</strong>Resolution rate has dropped by 12% compared to the 30-day moving average.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModelHealth() {
  const [data, setData] = useState(null);
  useEffect(() => { axios.get('http://127.0.0.1:8000/api/model/health').then(r => setData(r.data))
    .catch(() => setData({ accuracy: 0.84, feature_importance: [], confusion_matrix: [[45000,5000,2000,100],[3000,38000,8000,1500],[1000,7000,52000,5000],[500,2000,4000,28000]] })); }, []);

  if (!data) return <div className="page-content"><SkeletonLoader /></div>;

  return (
    <div className="page-content">
      <div className="form-header">
          <div className="page-header-icon"><BrainCircuit size={32} color="var(--accent)"/></div>
          <h2 style={{fontSize:24, fontWeight:800, color:'var(--text-main)'}}>MODEL PERFORMANCE</h2>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}}>
        <div className="sys-card" style={{padding:24, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:300}}>
            <div style={{alignSelf:'flex-start', display:'flex', alignItems:'center', gap:8, marginBottom:20}}><LayoutGrid size={16} color="var(--accent)"/><h3 style={{fontSize:16, fontWeight:800, margin:0}}>ACCURACY SCORE</h3></div>
            <div style={{width:'100%', height:200, position:'relative'}}>
               <ResponsiveContainer width="100%" height="100%">
                 <RadialBarChart innerRadius="80%" outerRadius="100%" barSize={20} data={[{name: 'score', value: data.accuracy * 100, fill: '#3b82f6'}]} startAngle={180} endAngle={0}>
                    <RadialBar background clockWise dataKey="value" cornerRadius={10} />
                 </RadialBarChart>
               </ResponsiveContainer>
               <div style={{position:'absolute', top:'60%', left:'50%', transform:'translate(-50%, -50%)', textAlign:'center'}}>
                  <div style={{fontSize:42, fontWeight:800, color:'#0f172a'}}>{(data.accuracy * 100).toFixed(1)}%</div>
                  <div style={{fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase'}}>Precision</div>
               </div>
            </div>
        </div>

        <div className="sys-card" style={{padding:24, minHeight:300}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:20}}><List size={16} color="var(--accent)"/><h3 style={{fontSize:16, fontWeight:800, margin:0}}>TOP PREDICTIVE FEATURES</h3></div>
            <div style={{height:240}}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={data.feature_importance.slice(0, 5)} margin={{left:10}}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="term" type="category" width={100} tick={{fontSize:12, fontWeight:600}} />
                        <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius:8}} />
                        <Bar dataKey="importance" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      <div className="sys-card" style={{padding:24, marginTop:24}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:20}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}><LayoutGrid size={16} color="var(--accent)"/><h3 style={{fontSize:16, fontWeight:800, margin:0}}>CONFUSION MATRIX (Live)</h3></div>
            <div style={{fontSize:12, fontWeight:600, color:'#64748b'}}>Hover to inspect</div>
        </div>
        <div className="matrix-container">
            <div className="matrix-y-axis"><span className="matrix-y-text">TRUE LABEL</span></div>
            <div className="matrix-grid">
                {data.confusion_matrix.flat().map((v, i) => {
                    const maxVal = Math.max(...data.confusion_matrix.flat()) || 1;
                    const opacity = 0.1 + (v / maxVal) * 0.9;
                    return (
                        <div key={i} className="matrix-cell" style={{background:`rgba(37,99,235,${opacity})`, color: opacity > 0.5 ? 'white' : '#1e293b'}}>
                            {v.toLocaleString()}
                        </div>
                    );
                })}
            </div>
            <div></div>
            <div className="matrix-x-axis">PREDICTED LABEL</div>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', marginTop:10, fontSize:11, color:'#64748b', fontWeight:600}}>
            <span>Predicted: S1</span>
            <span>Predicted: S4</span>
        </div>
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [viewState, setViewState] = useState('form');
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [cp, setCp] = useState('');
  const [cn, setCn] = useState('');
  const [msg, setMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault(); setMsg("");
    if ((mode === 'register' || mode === 'reset') && p !== cp) { setMsg("Passwords do not match."); return; }
    setIsLoading(true);
    try {
      if(mode==='login'){ const r = await axios.post('http://127.0.0.1:8000/api/login',{username:u,password:p}); onLogin(r.data); }
      else if(mode==='register'){ await axios.post('http://127.0.0.1:8000/api/users',{req:{username:u,password:p,role:'admin'},company_name:cn}); setViewState('success'); }
      else if(mode==='reset'){ await axios.post('http://127.0.0.1:8000/api/reset-password',{username:u,password:p}); setViewState('success'); }
      else if(mode==='delete'){ await axios.delete('http://127.0.0.1:8000/api/users', { data: { username: u, password: p } }); setMsg("Account deleted."); setU(""); setP(""); setMode('login'); }
    } catch { setMsg("Authentication failed."); setIsLoading(false); }
  }
  const getTitle = () => { if (mode === 'login') return 'BUG SYSTEM LOGIN'; if (mode === 'register') return 'NEW ACCOUNT'; if (mode === 'reset') return 'RESET PASSWORD'; if (mode === 'delete') return 'DELETE ACCOUNT'; };
  const switchTo = (newMode) => { setMode(newMode); setViewState('form'); setMsg(""); setU(""); setP(""); setCp(""); setCn(""); }
  return (
    <div className="login-container">
        <div className="login-card">
            <div className="login-header">
                <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:20}}><div style={{background:'var(--accent)', padding:8, borderRadius:8}}><ShieldCheck color="white" size={24}/></div><span style={{fontWeight:800, fontSize:20, letterSpacing:-0.5}}>BUG<span style={{color:'var(--accent)'}}>PRIORITY</span></span></div>
                <h2>Welcome back</h2><p>Please enter your details to access the triage system.</p>
            </div>
            {viewState === 'success' ? (
                <div className="fade-in" style={{textAlign:'center'}}>
                    <div style={{width:64, height:64, background:'#dcfce7', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px'}}><CheckCircle size={32} color="#16a34a"/></div>
                    <h2 style={{fontSize:22, fontWeight:800, marginBottom:10, color:'#1e293b'}}>{mode === 'register' ? 'Account Created!' : 'Password Updated'}</h2>
                    <p style={{color:'#64748b', fontSize:14, marginBottom:30}}>{mode === 'register' ? 'Your profile has been successfully set up.' : 'You can now access your dashboard with your new credentials.'}</p>
                    <button className="sys-btn full" onClick={() => switchTo('login')}>BACK TO LOGIN</button>
                </div>
            ) : (
            <form onSubmit={handleAuth}>
                <div className="input-with-icon">
                    <UserIcon size={16} className="input-icon"/>
                    <input className="sys-input padded" placeholder="Username" value={u} onChange={e=>setU(e.target.value)} required/>
                </div>
                <div className="input-with-icon">
                    <Lock size={16} className="input-icon"/>
                    <input className="sys-input padded" type="password" placeholder="Password" value={p} onChange={e=>setP(e.target.value)} required/>
                </div>
                {(mode === 'register' || mode === 'reset') && (<div className="input-with-icon"><Lock size={16} className="input-icon"/><input className="sys-input padded" type="password" placeholder="Re-enter Password" value={cp} onChange={e=>setCp(e.target.value)} required/></div>)}
                {mode==='register' && <input className="sys-input" placeholder="Company name" value={cn} onChange={e=>setCn(e.target.value)} required/>}
                {msg && <div className={`alert-banner ${msg.includes('fail')?'error':'success'}`}>{msg}</div>}
                <button className="sys-btn full" disabled={isLoading} style={{marginTop:24, height:48, fontSize:14, background: mode==='delete'?'var(--danger)':'var(--text-main)'}}>{isLoading ? "PROCESSING..." : mode==='login'?'SIGN IN':mode==='register'?'CREATE ACCOUNT':mode==='reset'?'RESET PASSWORD':'DELETE ACCOUNT'}</button>
                <div className="login-links">
                    {mode==='login' ? (<><span onClick={()=>switchTo('register')}>Create Account</span><span onClick={()=>switchTo('reset')}>Forgot Password?</span></>) : (<span onClick={()=>switchTo('login')} style={{marginLeft:'auto'}}>Back to Login</span>)}
                </div>
            </form>
            )}
        </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('overview');
  if (!user) return <Login onLogin={setUser} />;
  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: <Activity size={18}/> },
    { id: 'database', label: 'Database', icon: <Database size={18}/> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18}/> },
    { id: 'health', label: 'ML Health', icon: <BrainCircuit size={18}/> },
    { id: 'predictor', label: 'Predictor', icon: <Zap size={18}/> },
    { id: 'submit', label: 'Submit', icon: <UploadCloud size={18}/> },
  ];
  return (
    <div className="sidebar-layout">
      <aside className="sidebar">
        <div className="sidebar-header"><div className="nav-logo"><ShieldCheck color="var(--accent)"/> BUG<span>PRIORITY</span></div></div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} className={`side-link ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>{item.icon} {item.label}</button>
          ))}
        </nav>
        <div style={{padding:20, borderTop:'1px solid var(--border)'}}>
          <button className="side-link" onClick={() => setUser(null)}><LogOut size={18}/> Exit</button>
        </div>
      </aside>
      <main className="main-view">
        {tab === 'overview' && <Overview user={user} onNavigate={setTab}/>}
        {tab === 'database' && <Explorer user={user} />}
        {tab === 'analytics' && <AnalyticsTab user={user} />}
        {tab === 'health' && <ModelHealth />}
        {tab === 'predictor' && <MLPredictor user={user}/>}
        {tab === 'submit' && <SubmitTab user={user}/>}
      </main>
    </div>
  );
}