import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Search, Download, ArrowUpDown, ChevronLeft, ChevronRight, Loader } from 'lucide-react';

export default function Explorer({ user, initialQuery = "", onNavigate }) {
  const [bugs, setBugs] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false); // Tracks CSV download status
  const itemsPerPage = 10;

  useEffect(() => { setSearch(initialQuery); }, [initialQuery]);

  // Debounce typing so we don't spam the database
  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedSearch(search);
        setPage(1); // Reset to page 1 on new search
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Server-side fetch automatically passes states as URL parameters
  const fetchBugs = useCallback(async () => {
    setLoading(true);
    try {
        const token = localStorage.getItem("token");
        const response = await axios.get("/api/hub/explorer", {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                page: page,
                limit: itemsPerPage,
                search: debouncedSearch,
                sort_key: sortConfig.key,
                sort_dir: sortConfig.direction
            }
        });

        setBugs(response.data.bugs || []);
        setTotal(response.data.total || 0);
    } catch (err) {
        if (err.response?.status === 401 && onNavigate) onNavigate('login');
    } finally { setLoading(false); }
  }, [page, debouncedSearch, sortConfig, onNavigate]);

  useEffect(() => { fetchBugs(); }, [fetchBugs]);

  const totalPages = Math.ceil(total / itemsPerPage);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
    setPage(1); // Reset to page 1 when sort changes
  };

  // ⚡ UPDATED EXPORT FUNCTION: Securely streams the CSV from the backend
  const handleExport = async () => {
    setExporting(true);
    try {
        const token = localStorage.getItem("token");

        const response = await axios.get("/api/hub/export", {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                search: debouncedSearch,
                sort_key: sortConfig.key,
                sort_dir: sortConfig.direction
            },
            responseType: 'blob' // Crucial for telling Axios this is a file stream
        });

        // Trigger browser download mechanism
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'bug_report_export.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();

    } catch (err) {
        alert("Export failed. Ensure backend is running.");
        console.error(err);
    } finally {
        setExporting(false);
    }
  };

  return (
    <div className="page-content fade-in">
      <div className="explorer-header">
        <div>
           <h1 style={{fontSize:24, fontWeight:800, margin:0, color:'var(--text-main)'}}>EXPLORER</h1>
           <span style={{fontSize:13, color:'#64748b'}}>Viewing {total.toLocaleString()} Firefox Records</span>
        </div>
        <div style={{display:'flex', gap:10, alignItems: 'center'}}>
           <div style={{position: 'relative', width: 300}}>
               <Search size={16} color="#94a3b8" style={{position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)'}}/>
               <input
                  className="sys-input"
                  placeholder="Filter ID, Sev, Component..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{marginBottom: 0, paddingLeft: 36, height: 42}}
               />
           </div>
           <button className="sys-btn outline" onClick={handleExport} disabled={exporting} style={{padding:'0 16px', height: 42, display: 'flex', alignItems: 'center', gap: 6}}>
               {exporting ? <Loader size={14} className="spin"/> : <Download size={14}/>}
               {exporting ? 'EXPORTING...' : 'CSV'}
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
                const bugId = b.id;
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
              {bugs.length === 0 && !loading && (<tr><td colSpan="5" style={{textAlign:'center', padding:40, color:'#94a3b8'}}>No records found matching "{search}".</td></tr>)}
              {loading && (<tr><td colSpan="5" style={{textAlign:'center', padding:40, color:'#94a3b8'}}>Querying Archive...</td></tr>)}
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