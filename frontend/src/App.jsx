import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Database, BrainCircuit, LogOut, Search,
  ShieldCheck, UploadCloud, Activity,
  Download, ArrowUpDown, ChevronLeft, ChevronRight,
  Terminal, AlertTriangle, Trash2, CheckCircle, ExternalLink,
  Cpu, Zap, Server, RotateCcw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import './App.css';

// --- UTILS ---
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
  return (
    <div ref={domRef} className={`scroll-section ${isVisible ? 'fade-in' : ''} ${className}`}>
      {children}
    </div>
  );
}

function Background() {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current) {
        videoRef.current.play().catch(error => { console.log("Autoplay prevented:", error); });
    }
  }, []);
  return (
    <div className="bg-video-container">
      <video ref={videoRef} className="bg-video" autoPlay loop muted playsInline>
        <source src="/video.mp4" type="video/mp4" />
      </video>
      <div className="bg-overlay"></div>
    </div>
  )
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

// --- LIVE FEED COMPONENT ---
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

  useEffect(() => {
    const source = axios.CancelToken.source();
    const timeout = setTimeout(() => {
        if (!data) {
             source.cancel();
             loadDemoData();
        }
    }, 2000);

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

// --- EXPLORER TAB ---
function Explorer({ user, initialQuery = "" }) {
  const [bugs, setBugs] = useState([]);
  const [search, setSearch] = useState(initialQuery);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => { setSearch(initialQuery); }, [initialQuery]);

  useEffect(() => {
    axios.get(`http://127.0.0.1:8000/api/hub/explorer?company_id=${user.company_id}&limit=5000`)
         .then(res => setBugs(res.data))
         .catch(err => {
             console.log("Using mock data");
             setBugs([]);
         });
  }, []);

  const filtered = bugs.filter(b =>
    (b.summary + b.component + b.id + b.severity + b.status).toLowerCase().includes(search.toLowerCase())
  );

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
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-content">
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
                  <td style={{textAlign:'right'}}><span style={{color:'#10b981', fontWeight:700, fontSize:12, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6}}><div style={{width:6, height:6, borderRadius:'50%', background:'#10b981'}}></div> Active</span></td>
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

// --- ML PREDICTOR (UPDATED) ---
function MLPredictor({ user }) {
  const [summary, setSummary] = useState("");
  const [component, setComponent] = useState("Frontend");
  const [platform, setPlatform] = useState("Windows");
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  // Common Firefox components
  const components = ["Frontend", "Backend", "Database", "Networking", "Security", "DevTools", "Core"];
  const platforms = ["Windows", "MacOS", "Linux", "Android", "iOS"];

  const predict = async () => {
    if(!summary) return;
    setLoading(true); setRes(null); setSaved(false); setFeedbackSent(false);

    try {
        const payload = { summary, component, platform };
        const r = await axios.post('http://127.0.0.1:8000/api/predict', payload);
        setRes(r.data);
    } catch {
        // Fallback for demo
        setTimeout(() => setRes({ prediction: "S2", confidence: 0.89, diagnosis: "Heuristic Analysis", team: "General", keywords: [] }), 800);
    }
    setLoading(false);
  }

  const saveToDb = async () => {
      if (!res) return;
      try {
          const bugData = {
              summary, component, platform,
              severity: res.prediction, status: "NEW",
              ai_analysis: { confidence: res.confidence, diagnosis: res.diagnosis, team: res.team }
          };
          await axios.post('http://127.0.0.1:8000/api/bug', { bug: bugData, company_id: user.company_id });
          setSaved(true);
      } catch (e) { alert("Error saving"); }
  };

  const sendFeedback = async (actual) => {
      try {
          await axios.post('http://127.0.0.1:8000/api/feedback', {
              summary, predicted: res.prediction, actual, company_id: user.company_id
          });
          setFeedbackSent(true);
      } catch (e) { }
  };

  return (
    <div className="page-content centered-page">
      <div className="sys-card form-wrapper" style={{maxWidth: 600}}>
        <div className="form-header">
          <div style={{background:'#eff6ff', width:64, height:64, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', boxShadow:'0 10px 15px -3px rgba(37, 99, 235, 0.2)'}}>
             <BrainCircuit size={32} color="var(--accent)"/>
          </div>
          <h2 style={{fontSize:24, fontWeight:800, color:'var(--text-main)'}}>NEW BUG ANALYSIS</h2>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap: 15}}>
            <div>
                <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>BUG SUMMARY</label>
                <div className="spotlight-search" style={{width:'100%'}}>
                   <Terminal size={18} color="#94a3b8" />
                   <input placeholder="e.g. Application crashes when clicking Login..." value={summary} onChange={e => setSummary(e.target.value)} />
                </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:15}}>
                <div>
                    <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>COMPONENT</label>
                    <select className="sys-input" value={component} onChange={e=>setComponent(e.target.value)}>
                        {components.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>PLATFORM</label>
                    <select className="sys-input" value={platform} onChange={e=>setPlatform(e.target.value)}>
                        {platforms.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>
        </div>

        <button className="sys-btn full" onClick={predict} disabled={loading} style={{marginTop:24}}>
            {loading ? "PROCESSING..." : "PREDICT SEVERITY"}
        </button>

        {res && (
          <div className="result-box fade-in" style={{marginTop:24, background:'#f8fafc', padding:24, borderRadius:12, border:'1px solid #e2e8f0'}}>
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:15}}>
                <span className={`pill ${res.prediction}`} style={{fontSize:16, padding:'6px 14px'}}>{res.prediction}</span>
                <span style={{fontWeight:800, fontSize:18, color:'#0f172a'}}>{(res.confidence*100).toFixed(0)}% Conf.</span>
             </div>

             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:15}}>
                <div style={{background:'white', padding:10, borderRadius:8, border:'1px solid #e2e8f0'}}>
                    <div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>DIAGNOSIS</div>
                    <div style={{fontSize:13, fontWeight:600}}>{res.diagnosis}</div>
                </div>
                <div style={{background:'white', padding:10, borderRadius:8, border:'1px solid #e2e8f0'}}>
                    <div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>TEAM</div>
                    <div style={{fontSize:13, fontWeight:600, color:'#2563eb'}}>{res.team}</div>
                </div>
             </div>

             <div style={{marginBottom:15, fontSize:11, color:'#64748b'}}>
                Keywords: {res.keywords && res.keywords.map(k => <span key={k} style={{background:'#fee2e2', color:'#b91c1c', padding:'2px 6px', borderRadius:4, margin:'0 2px', fontWeight:700}}>{k}</span>)}
             </div>

             {!feedbackSent && !saved && (
                 <div style={{display:'flex', gap:10, paddingTop:10, borderTop:'1px dashed #cbd5e1'}}>
                     <button className="sys-btn outline" onClick={() => sendFeedback(res.prediction)} style={{flex:1, color:'#16a34a', borderColor:'#22c55e'}}>✓ Correct</button>
                     <button className="sys-btn outline" onClick={() => {const c=prompt("Correct Severity?"); if(c) sendFeedback(c.toUpperCase())}} style={{flex:1, color:'#ef4444', borderColor:'#ef4444'}}>✕ Wrong</button>
                 </div>
             )}

             {!saved && (
                 <button className="sys-btn full" onClick={saveToDb} style={{background:'#10b981', marginTop:15}}>
                    <CheckCircle size={16}/> SUBMIT BUG
                 </button>
             )}
             {saved && <div style={{textAlign:'center', color:'#10b981', fontWeight:700, marginTop:15}}>✓ Saved to Database</div>}
          </div>
        )}
      </div>
    </div>
  )
}

// --- SUBMIT TAB ---
function SubmitTab({ user }) {
  const [mode, setMode] = useState('single');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");
  const [recent, setRecent] = useState([]);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // NEW: Track IDs of last uploaded batch
  const [lastBatchIds, setLastBatchIds] = useState([]);

  const [sSummary, setSSummary] = useState("");
  const [sComp, setSComp] = useState("Frontend");
  const [sSev, setSSev] = useState("S3");

  useEffect(() => { fetchRecent(); }, []);

  const fetchRecent = async () => {
      try {
          const res = await axios.get(`http://127.0.0.1:8000/api/hub/explorer?company_id=${user.company_id}&limit=10`);
          setRecent(res.data);
      } catch (err) { }
  };

  const handleBulk = async () => {
    if(!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("company_id", user.company_id);
    try {
      const r = await axios.post('http://127.0.0.1:8000/api/upload', fd);
      setMsg("✅ "+r.data.message);

      // Store IDs for Undo function
      if (r.data.ids) setLastBatchIds(r.data.ids);

      fetchRecent();
    } catch { setMsg("❌ Upload failed"); }
  };

  // NEW: UNDO FUNCTION
  const handleUndoBatch = async () => {
      if(lastBatchIds.length === 0) return;
      if(!window.confirm(`Delete ${lastBatchIds.length} uploaded records?`)) return;

      try {
          const r = await axios.post('http://127.0.0.1:8000/api/bugs/batch_delete', { ids: lastBatchIds, company_id: user.company_id });
          setMsg(`✅ Deleted ${lastBatchIds.length} records.`);
          setLastBatchIds([]); // Reset
          fetchRecent();
      } catch {
          setMsg("❌ Batch delete failed");
      }
  };

  const handleSingle = async () => {
    try {
      const bug = { summary: sSummary, component: sComp, severity: sSev, status: "NEW" };
      await axios.post('http://127.0.0.1:8000/api/bug', { bug, company_id: user.company_id });
      setMsg("✅ Saved");
      setSSummary("");
      fetchRecent();
    } catch { setMsg("❌ Error saving bug"); }
  };

  const confirmDelete = async () => {
      if (!deleteTargetId) return;
      try {
          await axios.delete(`http://127.0.0.1:8000/api/bug/${deleteTargetId}`, { data: { company_id: user.company_id } });
          setRecent(recent.filter(item => item.id !== deleteTargetId));
          setDeleteTargetId(null);
      } catch (err) {
          alert("Could not delete. It may already be gone.");
          setDeleteTargetId(null);
      }
  };

  return (
    <div className="page-content centered-page">
      {deleteTargetId && (
        <div className="modal-overlay">
            <div className="modal-card">
               <div style={{width:60, height:60, background:'#fee2e2', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px'}}>
                  <AlertTriangle size={30} color="#ef4444"/>
               </div>
               <h3 style={{margin:'0 0 10px 0', fontSize:20, fontWeight:800}}>Delete Record?</h3>
               <p style={{margin:0, color:'#64748b', fontSize:14, lineHeight:1.5}}>Are you sure you want to delete Bug <strong>#{deleteTargetId}</strong>? This action cannot be undone.</p>
               <div style={{display:'flex', gap:12, marginTop:24}}>
                  <button onClick={()=>setDeleteTargetId(null)} className="sys-btn outline full" style={{fontSize:13}}>Cancel</button>
                  <button onClick={confirmDelete} className="sys-btn full" style={{background:'var(--danger)', fontSize:13}}>Delete Forever</button>
               </div>
            </div>
        </div>
      )}

      <div className="sys-card form-wrapper">
        <div className="form-header">
          <h2 style={{fontSize:24, fontWeight:800}}>SUBMIT DATA</h2>
          <div style={{display:'flex', background:'#f1f5f9', padding:4, borderRadius:10, marginTop:24}}>
            <button style={{flex:1, padding:10, border:'none', background:mode==='single'?'white':'transparent', boxShadow:mode==='single'?'var(--shadow-sm)':'none', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer', color:mode==='single'?'var(--accent)':'#64748b', transition:'0.2s'}} onClick={() => setMode('single')}>Manual Entry</button>
            <button style={{flex:1, padding:10, border:'none', background:mode==='bulk'?'white':'transparent', boxShadow:mode==='bulk'?'var(--shadow-sm)':'none', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer', color:mode==='bulk'?'var(--accent)':'#64748b', transition:'0.2s'}} onClick={() => setMode('bulk')}>Bulk Upload</button>
          </div>
        </div>

        {mode === 'bulk' ? (
          <div className="fade-in">
            <div className="drop-area" style={{border:'2px dashed #cbd5e1', borderRadius:12, height:180, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#64748b', marginBottom:24, background:'#f8fafc', position:'relative', transition:'0.2s'}}>
                <UploadCloud size={48} style={{marginBottom:16, opacity:0.5}}/>
                <p style={{fontSize:14, fontWeight:600}}>Click to Upload JSON</p>
                <input type="file" onChange={e=>setFile(e.target.files[0])} style={{opacity:0, position:'absolute', height:'100%', width:'100%', cursor:'pointer', top:0, left:0}}/>
            </div>
            {file && <div style={{textAlign:'center', fontSize:13, marginBottom:16, fontWeight:600, color:'var(--accent)'}}>{file.name}</div>}

            <button className="sys-btn full" onClick={handleBulk}>UPLOAD & TRAIN</button>

            {/* NEW BATCH DELETE BUTTON */}
            {lastBatchIds.length > 0 && (
                <button
                    className="sys-btn full"
                    onClick={handleUndoBatch}
                    style={{marginTop:12, background:'#fee2e2', color:'#ef4444', border:'1px solid #fecaca'}}
                >
                    <RotateCcw size={14}/> UNDO LAST BATCH ({lastBatchIds.length})
                </button>
            )}
          </div>
        ) : (
          <div className="fade-in" style={{display:'flex', flexDirection:'column', gap:15}}>
            <div>
                <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>SUMMARY</label>
                <input className="sys-input" placeholder="Bug description..." value={sSummary} onChange={e=>setSSummary(e.target.value)} style={{marginBottom:0}}/>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:15}}>
              <div>
                <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>COMPONENT</label>
                <select className="sys-input" value={sComp} onChange={e=>setSComp(e.target.value)} style={{marginBottom:0}}><option>Frontend</option><option>Backend</option><option>Database</option></select>
              </div>
              <div>
                <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>SEVERITY</label>
                <select className="sys-input" value={sSev} onChange={e=>setSSev(e.target.value)} style={{marginBottom:0}}><option>S1</option><option>S2</option><option>S3</option></select>
              </div>
            </div>
            <button className="sys-btn full" onClick={handleSingle} style={{marginTop:10}}>SUBMIT RECORD</button>
          </div>
        )}

        {msg && <div style={{marginTop:24, textAlign:'center', fontSize:14, fontWeight:600, color:msg.includes('Error')||msg.includes('fail')?'var(--danger)':'var(--success)'}}>{msg}</div>}

        {recent.length > 0 && (
            <div style={{marginTop:30, paddingTop:24, borderTop:'1px dashed #e2e8f0'}}>
                <h4 style={{fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase', marginBottom:12}}>Recent Submissions</h4>
                <div style={{maxHeight:150, overflowY:'auto'}}>
                    {recent.map((item) => (
                        <div key={item.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', padding:'8px 12px', borderRadius:8, marginBottom:8, border:'1px solid #f1f5f9'}}>
                            <div style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:13, color:'#334155'}}>
                                <span style={{fontWeight:700, color:'var(--accent)', marginRight:8}}>#{item.id}</span>
                                {item.summary}
                            </div>
                            <button onClick={() => setDeleteTargetId(item.id)} style={{background:'none', border:'none', cursor:'pointer', color:'#ef4444', padding:4}} title="Delete Bug">
                                <Trash2 size={14}/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

      </div>
    </div>
  )
}

// --- DASHBOARD CONTAINER ---
function Dashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview');
  const [externalQuery, setExternalQuery] = useState("");

  const handleNavigation = (targetTab, query = "") => {
      setTab(targetTab);
      setExternalQuery(query);
  };

  return (
    <div className="app-container">
      <nav className="sys-nav">
        <div className="nav-content">
          <div className="nav-logo">
             <div style={{width:32, height:32, background:'var(--accent)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center'}}>
                <ShieldCheck size={20} color="white"/>
             </div>
             BUG<span style={{color:'var(--accent)'}}>PRIORITY</span>
          </div>
          <div className="nav-center">
             {['Overview', 'Database', 'Predictor', 'Submit'].map(t => (
                 <button
                    key={t}
                    className={`nav-link ${tab===t.toLowerCase()?'active':''}`}
                    onClick={()=>{
                        setTab(t.toLowerCase());
                        setExternalQuery("");
                    }}
                 >
                    {t}
                 </button>
             ))}
          </div>
          <div className="nav-right">
             <div className="user-pill">
                <div className="user-avatar-sm">{user.username[0].toUpperCase()}</div>
                <span className="user-name">{user.username}</span>
             </div>
             <button className="sys-btn outline" onClick={onLogout} style={{padding:'6px 12px', fontSize:12, fontWeight:700, gap:6, borderRadius:99}}>
                 <LogOut size={14} color="var(--text-sec)"/> EXIT
             </button>
          </div>
        </div>
      </nav>
      <main className="main-scroll">
         {tab === 'overview' && <Overview user={user} onNavigate={handleNavigation}/>}
         {tab === 'database' && <Explorer user={user} initialQuery={externalQuery}/>}
         {tab === 'predictor' && <MLPredictor user={user}/>}
         {tab === 'submit' && <SubmitTab user={user}/>}
      </main>
    </div>
  );
}

// --- LOGIN ---
function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [viewState, setViewState] = useState('form');

  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [cp, setCp] = useState('');
  const [cn, setCn] = useState('');
  const [msg, setMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setMsg("");
    if ((mode === 'register' || mode === 'reset') && p !== cp) {
        setMsg("Passwords do not match.");
        return;
    }
    try {
      if(mode==='login'){
        const r = await axios.post('http://127.0.0.1:8000/api/login',{username:u,password:p});
        onLogin(r.data);
      } else if(mode==='register'){
        await axios.post('http://127.0.0.1:8000/api/users',{req:{username:u,password:p,role:'admin'},company_name:cn});
        setViewState('success');
      } else if(mode==='reset'){
        await axios.post('http://127.0.0.1:8000/api/reset-password',{username:u,password:p});
        setViewState('success');
      } else if(mode==='delete'){
        await axios.delete('http://127.0.0.1:8000/api/users', { data: { username: u, password: p } });
        setMsg("Account deleted.");
        setU(""); setP(""); setMode('login');
      }
    } catch { setMsg("Authentication failed."); }
  }

  const getTitle = () => {
    if (mode === 'login') return 'BUG SYSTEM LOGIN';
    if (mode === 'register') return 'NEW ACCOUNT';
    if (mode === 'reset') return 'RESET PASSWORD';
    if (mode === 'delete') return 'DELETE ACCOUNT';
  };

  const switchTo = (newMode) => {
      setMode(newMode);
      setViewState('form');
      setMsg("");
      setU(""); setP(""); setCp(""); setCn("");
  }

  return (
    <div className="login-backdrop">
      <Background />
      <div className="login-window">
         {viewState === 'success' ? (
             <div className="fade-in">
                 <div style={{width:64, height:64, background:'#dcfce7', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px'}}>
                     <CheckCircle size={32} color="#16a34a"/>
                 </div>
                 <h2 style={{fontSize:22, fontWeight:800, marginBottom:10, color:'#1e293b'}}>
                     {mode === 'register' ? 'Account Created!' : 'Password Updated'}
                 </h2>
                 <p style={{color:'#64748b', fontSize:14, marginBottom:30}}>
                     {mode === 'register' ? 'Your profile has been successfully set up.' : 'You can now access your dashboard with your new credentials.'}
                 </p>
                 <button className="sys-btn full" onClick={() => switchTo('login')}>
                     BACK TO LOGIN
                 </button>
             </div>
         ) : (
             <div className="fade-in">
                 <div className="login-brand-icon">
                    <ShieldCheck size={32} color="white"/>
                 </div>
                 <h1 style={{fontSize:22, fontWeight:800, marginBottom:32, letterSpacing:-0.5, color:'#1e293b'}}>{getTitle()}</h1>
                 <form onSubmit={handleAuth}>
                    <input className="sys-input" placeholder="Username" value={u} onChange={e=>setU(e.target.value)} required/>
                    <input className="sys-input" type="password" placeholder="Password" value={p} onChange={e=>setP(e.target.value)} required/>
                    {(mode === 'register' || mode === 'reset') && (
                        <input className="sys-input" type="password" placeholder="Re-enter Password" value={cp} onChange={e=>setCp(e.target.value)} required/>
                    )}
                    {mode==='register' && <input className="sys-input" placeholder="Company name" value={cn} onChange={e=>setCn(e.target.value)} required/>}
                    <button className="sys-btn full" style={{marginTop:16, background: mode==='delete'?'var(--danger)':'var(--text-main)'}}>
                        {mode==='login'?'ACCESS DASHBOARD':mode==='register'?'CREATE PROFILE':mode==='reset'?'RESET PASSWORD':'CONFIRM DELETE'}
                    </button>
                 </form>
                 {msg && <div style={{marginTop:20, fontSize:13, fontWeight:600, color:msg.includes('fail')||msg.includes('match')?'var(--danger)':'var(--success)'}}>{msg}</div>}
                 <div className="login-footer">
                    {mode==='login' ? (
                        <>
                            <span onClick={()=>switchTo('register')} style={{color:'var(--accent)'}}>Create Account</span>
                            <span onClick={()=>switchTo('reset')}>Forgot Password?</span>
                            <span onClick={()=>switchTo('delete')} style={{color:'var(--danger)'}}>Delete</span>
                        </>
                    ) : (
                        <span onClick={()=>switchTo('login')} style={{color:'var(--text-main)'}}>Back to Login</span>
                    )}
                 </div>
             </div>
         )}
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null);
  return user ? <Dashboard user={user} onLogout={()=>setUser(null)} /> : <Login onLogin={setUser}/>;
}