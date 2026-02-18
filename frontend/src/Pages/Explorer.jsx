import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Search, Download, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Explorer({ user, initialQuery = "", onNavigate }) {
  const [bugs, setBugs] = useState([]);
  const [search, setSearch] = useState(initialQuery);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;
  useEffect(() => { setSearch(initialQuery); }, [initialQuery]);

  const fetchBugs = useCallback(async () => {
    setLoading(true);
    try {
        const token = localStorage.getItem("token");
        const response = await axios.get("/api/hub/explorer", {
            headers: { Authorization: `Bearer ${token}` }
        });
        setBugs(response.data);
    } catch (err) {
        if (err.response?.status === 401 && onNavigate) onNavigate('login');
    } finally { setLoading(false); }
  }, [onNavigate]);

  useEffect(() => { fetchBugs(); }, [fetchBugs]);

  const getField = (bug, field) => {
    if (field === 'id') return bug.bug_id || bug.id || 0;
    let val = bug[field];
    if ((val === undefined || val === null) && bug.data) val = bug.data[field];
    return val || "";
  };

  const filtered = bugs.filter(b => {
      const term = search.toLowerCase();
      const idStr = String(b.bug_id || b.id || "");
      const line = ((b.summary||"") + (b.component||"") + idStr + (b.severity||"") + (b.status||"")).toLowerCase();
      return line.includes(term);
  });

  const sortedBugs = [...filtered].sort((a, b) => {
    let valA, valB;
    if (sortConfig.key === 'id') { valA = a.bug_id || a.id || 0; valB = b.bug_id || b.id || 0; }
    else { valA = getField(a, sortConfig.key).toString().toLowerCase(); valB = getField(b, sortConfig.key).toString().toLowerCase(); }
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
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
    const headers = ["ID", "Severity", "Component", "Summary", "Status"];
    const csvContent = [headers.join(","), ...sortedBugs.map(b => {
        const sum = (getField(b, 'summary')||"").replace(/"/g, '""');
        const id = b.bug_id || b.id;
        return [id, getField(b, 'severity'), getField(b, 'component'), `"${sum}"`, getField(b, 'status')||'Active'].join(",");
    })].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `bug_report.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="page-content fade-in">
      <div className="explorer-header">
        <div><h1 style={{fontSize:24, fontWeight:800, margin:0, color:'var(--text-main)'}}>EXPLORER</h1><span style={{fontSize:13, color:'#64748b'}}>Viewing {sortedBugs.length.toLocaleString()} Firefox Records</span></div>
        <div style={{display:'flex', gap:10, alignItems: 'center'}}>
           <div style={{position: 'relative', width: 300}}>
               <Search size={16} color="#94a3b8" style={{position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)'}}/>
               <input className="sys-input" placeholder="Filter ID, Sev, Component..." value={search} onChange={e=>{setSearch(e.target.value); setPage(1);}} style={{marginBottom: 0, paddingLeft: 36, height: 42}}/>
           </div>
           <button className="sys-btn outline" onClick={handleExport} style={{padding:'0 16px', height: 42}}><Download size={14}/> CSV</button>
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
                <th style={{width: 120, textAlign:'right'}}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {displayedBugs.map(b => {
                const bugId = b.bug_id || b.id;
                const status = b.status || "Active";
                return (
                    <tr key={bugId}>
                        <td style={{fontFamily:'var(--font-mono)', color:'var(--accent)', fontWeight:600}}>#{bugId}</td>
                        <td><span className={`pill ${b.severity}`}>{b.severity || "S3"}</span></td>
                        <td><span style={{background:'#f1f5f9', padding:'4px 8px', borderRadius:6, fontSize:12, fontWeight:600, color:'#475569'}}>{b.component || "General"}</span></td>
                        <td className="summary-cell"><div style={{maxWidth:400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={b.summary}>{b.summary}</div></td>
                        <td style={{textAlign:'right'}}>
                            <span style={{color: status.toLowerCase().includes('fix')?'#16a34a':'#e11d48', fontWeight:700, fontSize:12, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6}}>
                                <div style={{width:6, height:6, borderRadius:'50%', background: status.toLowerCase().includes('fix')?'#16a34a':'#e11d48'}}></div>
                                {status}
                            </span>
                        </td>
                    </tr>
                );
              })}
              {displayedBugs.length === 0 && !loading && (<tr><td colSpan="5" style={{textAlign:'center', padding:40, color:'#94a3b8'}}>No records found matching "{search}".</td></tr>)}
              {loading && (<tr><td colSpan="5" style={{textAlign:'center', padding:40, color:'#94a3b8'}}>Loading Data...</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
           <div style={{fontSize:13, color:'#64748b'}}>Page {page} of {totalPages || 1}</div>
           <div style={{display:'flex', gap:8}}>
             <button className="sys-btn outline" disabled={page===1} onClick={()=>setPage(p=>p-1)} style={{padding:8}}><ChevronLeft size={16}/></button>
             <button className="sys-btn outline" disabled={page===totalPages || totalPages===0} onClick={()=>setPage(p=>p+1)} style={{padding:8}}><ChevronRight size={16}/></button>
           </div>
        </div>
      </div>
    </div>
  );
}