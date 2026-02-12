import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Download, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Explorer({ user, initialQuery = "" }) {
  const [bugs, setBugs] = useState([]);
  const [search, setSearch] = useState(initialQuery);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;

  useEffect(() => { setSearch(initialQuery); }, [initialQuery]);

  const fetchBugs = () => {
    setLoading(true);

    // Safety Timeout: Force stop loading after 5s if backend is stuck
    const safetyTimer = setTimeout(() => setLoading(false), 5000);

    // 1. Instant Load (50 items)
    axios.get(`http://127.0.0.1:8000/api/hub/explorer?company_id=${user.company_id}&limit=50`)
         .then(res => {
             clearTimeout(safetyTimer); // Clear safety timer
             setBugs(res.data);
             setLoading(false); // Show table immediately

             // 2. Background Load (20k items - Now fast due to backend fix)
             return axios.get(`http://127.0.0.1:8000/api/hub/explorer?company_id=${user.company_id}&limit=20000`);
         })
         .then(res => {
             if(res.data.length > 0) setBugs(res.data);
         })
         .catch(err => {
             console.error("Fetch Error:", err);
             setLoading(false);
         });
  };

  useEffect(() => { fetchBugs(); }, [user.company_id]);

  // Helper to get fields safely
  const getField = (bug, field) => {
    if (bug[field]) return bug[field];
    if (bug.data && bug.data[field]) return bug.data[field];
    if (field === 'severity' && bug.data?.priority) return bug.data.priority;
    if (field === 'component' && bug.data?.product) return bug.data.product;
    return "";
  };

  const filtered = bugs.filter(b => {
      const term = search.toLowerCase();
      const line = (getField(b, 'summary') + getField(b, 'component') + String(b.id) + getField(b, 'severity') + getField(b, 'status')).toLowerCase();
      return line.includes(term);
  });

  const sortedBugs = [...filtered].sort((a, b) => {
    let valA, valB;
    if (sortConfig.key === 'id') { valA = a.id; valB = b.id; }
    else { valA = getField(a, sortConfig.key) || ""; valB = getField(b, sortConfig.key) || ""; }
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
        return [b.id, getField(b, 'severity'), getField(b, 'component'), `"${sum}"`, getField(b, 'status')||'Active'].join(",");
    })].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `bug_report.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="page-content">
      <div className="explorer-header">
        <div style={{display:'flex', alignItems:'center', gap:12}}>
            <div>
                <h1 style={{fontSize:24, fontWeight:800, margin:0, color:'var(--text-main)'}}>DATABASE</h1>
                <span style={{fontSize:13, color:'#64748b'}}>Total Records: {sortedBugs.length.toLocaleString()}</span>
            </div>
        </div>

        <div style={{display:'flex', gap:10, alignItems: 'center'}}>
           <div style={{position: 'relative', width: 300}}>
               <Search size={16} color="#94a3b8" style={{position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)'}}/>
               <input
                  className="sys-input"
                  placeholder="Filter ID, Sev, Component..."
                  value={search}
                  onChange={e=>setSearch(e.target.value)}
                  style={{marginBottom: 0, paddingLeft: 36, height: 42}}
               />
           </div>
           <button className="sys-btn outline" onClick={handleExport} style={{padding:'0 16px', height: 42}}>
               <Download size={14}/> Export
           </button>
        </div>
      </div>

      <div className="sys-card table-card">
        <div className="table-scroll-wrapper">
          <table className="sleek-table">
            <thead>
              <tr>
                <th onClick={() => requestSort('id')} style={{width: 90}}>ID <ArrowUpDown size={12} style={{opacity:0.5}}/></th>
                <th onClick={() => requestSort('severity')} style={{width: 90}}>SEV <ArrowUpDown size={12} style={{opacity:0.5}}/></th>
                <th onClick={() => requestSort('component')} style={{width: 160}}>COMPONENT <ArrowUpDown size={12} style={{opacity:0.5}}/></th>
                <th>SUMMARY</th>
                <th style={{width: 120, textAlign:'right'}}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {displayedBugs.map(b => {
                const summary = getField(b, 'summary') || "No Summary";
                const component = getField(b, 'component') || "General";
                const severity = getField(b, 'severity') || "S3";
                const status = getField(b, 'status') || "Active";

                return (
                    <tr key={b.id}>
                    <td style={{fontFamily:'var(--font-mono)', color:'var(--accent)', fontWeight:600}}>#{b.id}</td>
                    <td><span className={`pill ${severity}`}>{severity}</span></td>
                    <td><span style={{background:'#f1f5f9', padding:'4px 8px', borderRadius:6, fontSize:12, fontWeight:600, color:'#475569'}}>{component}</span></td>
                    <td className="summary-cell">
                        <div style={{maxWidth:400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={summary}>
                            {summary}
                        </div>
                    </td>
                    <td style={{textAlign:'right'}}>
                        <span style={{color: status==='Fixed'?'#16a34a':'#e11d48', fontWeight:700, fontSize:12, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6}}>
                            <div style={{width:6, height:6, borderRadius:'50%', background: status==='Fixed'?'#16a34a':'#e11d48'}}></div>
                            {status}
                        </span>
                    </td>
                    </tr>
                );
              })}
              {displayedBugs.length === 0 && (
                  <tr><td colSpan="5" style={{textAlign:'center', padding:40, color:'#94a3b8'}}>
                      {loading ? "Loading..." : `No records found matching "${search}".`}
                  </td></tr>
              )}
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