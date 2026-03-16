import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Search, Download, ArrowUpDown, ChevronLeft, ChevronRight, Loader,
    X, Target, Clock, ShieldAlert, CheckCircle, Zap
} from 'lucide-react';

export default function Explorer({ user, initialQuery = "", onNavigate }) {
  const [bugs, setBugs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Search & Filter State
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [sevFilter, setSevFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [compFilter, setCompFilter] = useState("");

  // Table State
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedBug, setSelectedBug] = useState(null);

  // Synchronize initial search query from external navigation (e.g., clicking Overview cards)
  useEffect(() => {
    setSearch(initialQuery);
    setPage(1);
  }, [initialQuery]);

  // Debounce search input to prevent excessive API calls and reset to page 1 to find new results
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Main data fetching function
  const fetchBugs = useCallback(async () => {
    setLoading(true);
    try {
        const token = localStorage.getItem("token");
        const response = await axios.get("/api/hub/explorer", {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                page,
                limit: itemsPerPage,
                search: debouncedSearch,
                sort_key: sortConfig.key,
                sort_dir: sortConfig.direction,
                sev: sevFilter,
                status: statusFilter,
                comp: compFilter
            }
        });
        setBugs(response.data.bugs || []);
        setTotal(response.data.total || 0);
    } catch (err) {
        if (err.response?.status === 401 && onNavigate) onNavigate('login');
    } finally { setLoading(false); }
  }, [page, itemsPerPage, debouncedSearch, sortConfig, sevFilter, statusFilter, compFilter, onNavigate]);

  useEffect(() => { fetchBugs(); }, [fetchBugs]);

  const totalPages = Math.ceil(total / itemsPerPage);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
        const token = localStorage.getItem("token");
        const response = await axios.get("/api/hub/export", {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              search: debouncedSearch,
              sort_key: sortConfig.key,
              sort_dir: sortConfig.direction,
              sev: sevFilter,
              status: statusFilter,
              comp: compFilter
            },
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `bug_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (err) {
        alert("Export failed.");
    } finally {
        setExporting(false);
    }
  };

  const applyQuickFilter = (type) => {
      setSearch(""); setSevFilter(""); setStatusFilter(""); setCompFilter("");
      if (type === 'critical') { setSevFilter("S1"); setStatusFilter("NEW"); }
      if (type === 'triage') setStatusFilter("UNCONFIRMED");
      if (type === 'resolved') setStatusFilter("RESOLVED");
      if (type === 'security') setCompFilter("Security");
      setPage(1);
  };

  return (
    <div className="page-content fade-in" style={{ position: 'relative' }}>

      <div className="explorer-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
               <h1 style={{fontSize:24, fontWeight:800, margin:0, color:'var(--text-main)'}}>EXPLORER</h1>
               <span style={{fontSize:13, color:'var(--text-sec)'}}>Viewing {total.toLocaleString()} Records</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
                <button className="quick-chip" onClick={() => applyQuickFilter('critical')}><Zap size={12}/> Critical</button>
                <button className="quick-chip" onClick={() => applyQuickFilter('triage')}><Clock size={12}/> Triage Queue</button>
                <button className="quick-chip" onClick={() => applyQuickFilter('resolved')}><CheckCircle size={12}/> Resolved</button>
                <button className="quick-chip" onClick={() => applyQuickFilter('security')}><ShieldAlert size={12}/> Security</button>
                {(sevFilter || statusFilter || compFilter || search) && (
                    <button className="quick-chip clear" onClick={() => applyQuickFilter('clear')}><X size={12}/> Clear All</button>
                )}
            </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
           <div style={{position: 'relative', flex: 1 }}>
               <Search size={16} color="var(--text-sec)" style={{position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)'}}/>
               <input className="sys-input" placeholder="Search summaries or IDs..." value={search} onChange={e => {setSearch(e.target.value); setPage(1);}} style={{marginBottom: 0, paddingLeft: 36, height: 42, border: 'none', background: 'var(--input-bg)'}}/>
           </div>

           <div style={{ width: 1, height: 30, background: 'var(--border)' }}></div>

           <select className="sys-input" value={sevFilter} onChange={e => {setSevFilter(e.target.value); setPage(1);}} style={{ width: 140, marginBottom: 0, height: 42, border: 'none', background: 'var(--input-bg)' }}>
               <option value="">Any Severity</option><option value="S1">S1 (Critical)</option><option value="S2">S2 (High)</option><option value="S3">S3 (Normal)</option><option value="S4">S4 (Low)</option>
           </select>

           <select className="sys-input" value={statusFilter} onChange={e => {setStatusFilter(e.target.value); setPage(1);}} style={{ width: 150, marginBottom: 0, height: 42, border: 'none', background: 'var(--input-bg)' }}>
               <option value="">Any Status</option><option value="NEW">New</option><option value="UNCONFIRMED">Unconfirmed</option><option value="RESOLVED">Resolved</option><option value="VERIFIED">Verified</option>
           </select>

           <select className="sys-input" value={compFilter} onChange={e => {setCompFilter(e.target.value); setPage(1);}} style={{ width: 160, marginBottom: 0, height: 42, border: 'none', background: 'var(--input-bg)' }}>
               <option value="">Any Component</option><option value="Core">Core</option><option value="DevTools">DevTools</option><option value="Frontend">Frontend</option><option value="Security">Security</option><option value="Layout">Layout</option>
           </select>

           <button className="sys-btn outline" onClick={handleExport} disabled={exporting} style={{padding:'0 16px', height: 42, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--card-bg)'}}>
               {exporting ? <Loader size={14} className="spin"/> : <Download size={14}/>} CSV
           </button>
        </div>
      </div>

      <div className="sys-card table-card">
        <div className="table-scroll-wrapper">
          <table className="sleek-table">
            <thead>
              <tr>
                <th onClick={() => requestSort('id')} style={{width: 90, cursor:'pointer'}}>ID <ArrowUpDown size={12} style={{opacity:0.5}}/></th>
                <th onClick={() => requestSort('severity')} style={{width: 90, cursor:'pointer'}}>SEV <ArrowUpDown size={12} style={{opacity:0.5}}/></th>
                <th onClick={() => requestSort('component')} style={{width: 160, cursor:'pointer'}}>COMPONENT <ArrowUpDown size={12} style={{opacity:0.5}}/></th>
                <th onClick={() => requestSort('summary')} style={{cursor:'pointer'}}>SUMMARY <ArrowUpDown size={12} style={{opacity:0.5}}/></th>
                <th onClick={() => requestSort('status')} style={{width: 120, textAlign:'right', cursor:'pointer'}}>STATUS <ArrowUpDown size={12} style={{opacity:0.5}}/></th>
              </tr>
            </thead>
            <tbody>
              {bugs.map(b => {
                const status = b.status || "Active";
                return (
                    <tr key={b.id} onClick={() => setSelectedBug(b)} style={{ cursor: 'pointer' }}>
                        <td style={{fontFamily:'var(--font-mono)', color:'var(--accent)', fontWeight:600}}>#{b.id}</td>
                        <td><span className={`pill ${b.severity}`}>{b.severity || "S3"}</span></td>
                        <td><span style={{background:'var(--hover-bg)', padding:'4px 8px', borderRadius:6, fontSize:12, fontWeight:600, color:'var(--text-main)'}}>{b.component || "General"}</span></td>
                        <td className="summary-cell"><div style={{maxWidth:400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={b.summary}>{b.summary}</div></td>
                        <td style={{textAlign:'right'}}>
                            <span style={{color: status.toLowerCase().includes('fix') || status.toLowerCase().includes('resol') ? 'var(--success)' : 'var(--danger)', fontWeight:700, fontSize:12, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6}}>
                                <div style={{width:6, height:6, borderRadius:'50%', background: status.toLowerCase().includes('fix') || status.toLowerCase().includes('resol') ? 'var(--success)' : 'var(--danger)'}}></div>
                                {status}
                            </span>
                        </td>
                    </tr>
                );
              })}
              {bugs.length === 0 && !loading && (<tr><td colSpan="5" style={{textAlign:'center', padding:40, color:'var(--text-sec)'}}>No records found matching filters.</td></tr>)}
              {loading && (<tr><td colSpan="5" style={{textAlign:'center', padding:40, color:'var(--text-sec)'}}><Loader className="spin" size={24} style={{margin: '0 auto', display: 'block', marginBottom: 10}}/> Querying Archive...</td></tr>)}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
           <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
               <span style={{fontSize:13, color:'var(--text-sec)'}}>Rows per page:</span>
               <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setPage(1); }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none' }}>
                   <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
               </select>
           </div>

           <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
               <div style={{fontSize:13, color:'var(--text-sec)'}}>Page {page} of {totalPages || 1}</div>
               <div style={{display:'flex', gap:8}}>
                 <button className="sys-btn outline" disabled={page===1} onClick={()=>setPage(p=>p-1)} style={{padding:8}}><ChevronLeft size={16}/></button>
                 <button className="sys-btn outline" disabled={page===totalPages || totalPages===0} onClick={()=>setPage(p=>p+1)} style={{padding:8}}><ChevronRight size={16}/></button>
               </div>
           </div>
        </div>
      </div>

      {selectedBug && (
          <>
            <div className="inspector-overlay" onClick={() => setSelectedBug(null)}></div>
            <div className="bug-inspector-pane fade-in-right">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Target size={20} color="var(--accent)"/>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>RECORD INSPECTION</span>
                    </div>
                    <button className="inspector-close" onClick={() => setSelectedBug(null)}><X size={20}/></button>
                </div>

                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--accent)', fontWeight: 700, marginBottom: 8 }}>#{selectedBug.id}</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.4, margin: '0 0 24px 0' }}>{selectedBug.summary}</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 30 }}>
                    <div className="inspector-detail-box">
                        <span className="detail-label">SEVERITY LEVEL</span>
                        <span className={`pill ${selectedBug.severity} detail-value`}>{selectedBug.severity || 'S3'}</span>
                    </div>
                    <div className="inspector-detail-box">
                        <span className="detail-label">CURRENT STATUS</span>
                        <span className="detail-value" style={{ color: selectedBug.status.toLowerCase().includes('resol') ? 'var(--success)' : 'var(--danger)' }}>{selectedBug.status}</span>
                    </div>
                    <div className="inspector-detail-box" style={{ gridColumn: 'span 2' }}>
                        <span className="detail-label">ASSIGNED COMPONENT</span>
                        <span className="detail-value" style={{ background: 'var(--hover-bg)', padding: '6px 12px', borderRadius: 8, display: 'inline-block' }}>{selectedBug.component}</span>
                    </div>
                </div>

                <div style={{ padding: 20, background: 'var(--bg)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={14}/> SYSTEM TIMELINE
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-sec)', paddingLeft: 10, borderLeft: '2px solid var(--border)', marginLeft: 6 }}>
                        <div style={{ marginBottom: 12 }}>
                            <strong style={{ color: 'var(--text-main)' }}>Report Logged</strong><br/>System ingestion via API.
                        </div>
                        <div>
                            <strong style={{ color: 'var(--text-main)' }}>AI Triage Applied</strong><br/>Vector matched and categorized into {selectedBug.component}.
                        </div>
                    </div>
                </div>
            </div>
          </>
      )}
    </div>
  );
}