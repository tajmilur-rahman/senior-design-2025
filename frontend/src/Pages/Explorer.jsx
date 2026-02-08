import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Download, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Explorer({ user, initialQuery = "" }) {
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