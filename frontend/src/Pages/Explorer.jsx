import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
    Search, Download, ArrowUpDown, ChevronLeft, ChevronRight, Loader,
    X, Target, Clock, ShieldAlert, CheckCircle, Zap, ChevronDown
} from 'lucide-react';

// ─── Sleek Custom Select ─────────────────────────────────────────────────────
function CustomSelect({ value, onChange, options, placeholder }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = options.find(o => o.value === value);

    return (
        <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
            <div
                onClick={() => setOpen(o => !o)}
                style={{
                    height: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 14px', background: 'var(--input-bg)', border: '1px solid var(--border)',
                    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    color: selected ? 'var(--text-main)' : 'var(--text-sec)',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    ...(open ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px rgba(37,99,235,0.1)' } : {})
                }}>
                <span>{selected ? selected.label : placeholder}</span>
                <ChevronDown size={14} color="var(--text-sec)" style={{ transition: '0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}/>
            </div>
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 1000,
                    background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)', overflow: 'hidden',
                    animation: 'fadeIn 0.12s ease-out'
                }}>
                    {options.map(opt => (
                        <div key={opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            style={{
                                padding: '10px 14px', fontSize: 13, fontWeight: 500,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                color: opt.value === value ? 'var(--accent)' : 'var(--text-main)',
                                background: opt.value === value ? 'var(--pill-bg)' : 'transparent',
                                transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'var(--hover-bg)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = opt.value === value ? 'var(--pill-bg)' : 'transparent'; }}>
                            <span>{opt.label}</span>
                            {opt.value === value && <CheckCircle size={13} color="var(--accent)"/>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Severity badge colors ─────────────────────────────────────────────────────
const SEV_STYLES = {
    S1: { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444', border: 'rgba(239,68,68,0.3)'  },
    S2: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
    S3: { bg: 'rgba(37,99,235,0.1)',  color: '#3b82f6', border: 'rgba(37,99,235,0.3)'  },
    S4: { bg: 'var(--hover-bg)',      color: 'var(--text-sec)', border: 'var(--border)' },
};

function SevBadge({ sev }) {
    const s = SEV_STYLES[sev] || SEV_STYLES.S3;
    return (
        <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800, background: s.bg, color: s.color, border: `1px solid ${s.border}`, letterSpacing: 0.3 }}>
            {sev || 'S3'}
        </span>
    );
}

// ─── Main Explorer ──────────────────────────────────────────────────────────
export default function Explorer({ user, initialQuery = "", onNavigate }) {
  const [bugs, setBugs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [exactMode, setExactMode] = useState(false);
  const [sevFilter, setSevFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [compFilter, setCompFilter] = useState("");

  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedBug, setSelectedBug] = useState(null);

  useEffect(() => { setSearch(initialQuery); setPage(1); }, [initialQuery]);

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchBugs = useCallback(async () => {
    setLoading(true);
    try {
        const response = await axios.get("/api/hub/explorer", {
            params: {
                page, limit: itemsPerPage,
                search: debouncedSearch,
                sort_key: sortConfig.key,
                sort_dir: sortConfig.direction,
                sev: sevFilter, status: statusFilter, comp: compFilter
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
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    setPage(1);
  };

  const clearFilters = () => { setSearch(""); setSevFilter(""); setStatusFilter(""); setCompFilter(""); setExactMode(false); setPage(1); };

  const applyQuickFilter = (type) => {
      clearFilters();
      if (type === 'critical') { setSevFilter("S1"); setStatusFilter("NEW"); }
      if (type === 'triage') setStatusFilter("UNCONFIRMED");
      if (type === 'resolved') setStatusFilter("RESOLVED");
      if (type === 'security') setCompFilter("Security");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
        const response = await axios.get("/api/hub/export", {
            params: { search: debouncedSearch, sort_key: sortConfig.key, sort_dir: sortConfig.direction, sev: sevFilter, status: statusFilter, comp: compFilter },
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a'); link.href = url;
        link.setAttribute('download', `apex_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link); link.click(); link.remove();
    } catch { alert("Export failed."); } finally { setExporting(false); }
  };

  const hasFilters = !!(sevFilter || statusFilter || compFilter || search);

  // Select options
  const sevOptions = [
      { value: "", label: "Any Severity" },
      { value: "S1", label: "S1 — Critical" },
      { value: "S2", label: "S2 — High" },
      { value: "S3", label: "S3 — Normal" },
      { value: "S4", label: "S4 — Low" },
  ];
  const statusOptions = [
      { value: "", label: "Any Status" },
      { value: "NEW", label: "New" },
      { value: "UNCONFIRMED", label: "Unconfirmed" },
      { value: "RESOLVED", label: "Resolved" },
      { value: "VERIFIED", label: "Verified" },
  ];
  const compOptions = [
      { value: "", label: "Any Component" },
      { value: "Core", label: "Core" },
      { value: "DevTools", label: "DevTools" },
      { value: "Frontend", label: "Frontend" },
      { value: "Security", label: "Security" },
      { value: "Layout", label: "Layout" },
      { value: "Networking", label: "Networking" },
  ];
  const perPageOptions = [
      { value: 10, label: "10 rows" }, { value: 25, label: "25 rows" },
      { value: 50, label: "50 rows" }, { value: 100, label: "100 rows" },
  ];

  return (
    <div className="page-content fade-in" style={{ position: 'relative' }}>

      {/* ── Header ── */}
      <div className="explorer-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: -0.5 }}>DATABASE EXPLORER</h1>
            <span style={{ fontSize: 13, color: 'var(--text-sec)' }}>
              {loading ? 'Querying…' : `${total.toLocaleString()} record${total !== 1 ? 's' : ''} found`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {[
                  { key: 'critical', label: 'Critical', icon: <Zap size={11}/> },
                  { key: 'triage',   label: 'Triage Queue', icon: <Clock size={11}/> },
                  { key: 'resolved', label: 'Resolved', icon: <CheckCircle size={11}/> },
                  { key: 'security', label: 'Security', icon: <ShieldAlert size={11}/> },
              ].map(f => (
                  <button key={f.key} className="quick-chip" onClick={() => applyQuickFilter(f.key)} style={{ fontSize: 12 }}>
                      {f.icon} {f.label}
                  </button>
              ))}
              {hasFilters && (
                  <button className="quick-chip clear" onClick={clearFilters} style={{ fontSize: 12 }}>
                      <X size={11}/> Clear All
                  </button>
              )}
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto', gap: 10, alignItems: 'center', background: 'var(--bg)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
          {/* Search with exact-match toggle */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={15} color="var(--text-sec)" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }}/>
              <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder={exactMode ? 'Exact match search…' : 'Search summary or ID…'}
                  style={{
                      width: '100%', height: 42, paddingLeft: 38, paddingRight: exactMode ? 80 : 12,
                      background: 'var(--input-bg)', border: `1px solid ${exactMode ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 8, fontSize: 13, color: 'var(--text-main)', outline: 'none',
                      boxShadow: exactMode ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
                      fontFamily: 'var(--font-head)'
                  }}
                  onFocus={e => { if (!exactMode) e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={e => { if (!exactMode) e.target.style.borderColor = 'var(--border)'; }}
              />
              {search && (
                  <button onClick={() => setSearch("")} style={{ position: 'absolute', right: exactMode ? 52 : 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)', padding: 4, display: 'flex' }}>
                      <X size={13}/>
                  </button>
              )}
              <button
                  onClick={() => setExactMode(m => !m)}
                  title="Toggle exact match"
                  style={{
                      position: 'absolute', right: 8, height: 26, padding: '0 8px',
                      background: exactMode ? 'var(--accent)' : 'var(--hover-bg)',
                      border: 'none', borderRadius: 5, cursor: 'pointer',
                      fontSize: 10, fontWeight: 800, color: exactMode ? 'white' : 'var(--text-sec)',
                      letterSpacing: 0.3, transition: '0.15s'
                  }}>
                  {exactMode ? 'EXACT' : 'FUZZY'}
              </button>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: 'var(--border)' }}/>

          {/* Custom selects */}
          <div style={{ width: 148 }}>
              <CustomSelect value={sevFilter} onChange={v => { setSevFilter(v); setPage(1); }} options={sevOptions} placeholder="Any Severity"/>
          </div>
          <div style={{ width: 158 }}>
              <CustomSelect value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }} options={statusOptions} placeholder="Any Status"/>
          </div>
          <div style={{ width: 162 }}>
              <CustomSelect value={compFilter} onChange={v => { setCompFilter(v); setPage(1); }} options={compOptions} placeholder="Any Component"/>
          </div>

          {/* Export */}
          <button className="sys-btn outline" onClick={handleExport} disabled={exporting}
              style={{ height: 42, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--card-bg)', whiteSpace: 'nowrap' }}>
              {exporting ? <Loader size={13} className="spin"/> : <Download size={13}/>} Export CSV
          </button>
        </div>

        {/* Active filter pills */}
        {hasFilters && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {search && <span style={filterPillStyle}>{exactMode ? '=' : '~'} "{search}"</span>}
                {sevFilter && <span style={{ ...filterPillStyle, background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', borderColor: 'rgba(37,99,235,0.3)' }}>Severity: {sevFilter}</span>}
                {statusFilter && <span style={filterPillStyle}>Status: {statusFilter}</span>}
                {compFilter && <span style={filterPillStyle}>Component: {compFilter}</span>}
            </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="sys-card table-card" style={{ marginTop: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="sleek-table" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 90 }}/><col style={{ width: 88 }}/><col style={{ width: 160 }}/>
              <col/><col style={{ width: 120 }}/>
            </colgroup>
            <thead>
              <tr>
                {[['id','ID'],['severity','SEV'],['component','COMPONENT'],['summary','SUMMARY'],['status','STATUS']].map(([key, label]) => (
                    <th key={key} onClick={() => requestSort(key)} style={{ cursor: 'pointer', whiteSpace: 'nowrap', textAlign: key === 'status' ? 'right' : 'left' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {label}
                            <ArrowUpDown size={11} style={{ opacity: sortConfig.key === key ? 1 : 0.35, color: sortConfig.key === key ? 'var(--accent)' : 'inherit' }}/>
                        </span>
                    </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: 50 }}>
                      <Loader size={22} className="spin" color="var(--accent)" style={{ display: 'block', margin: '0 auto 10px' }}/>
                      <span style={{ color: 'var(--text-sec)', fontSize: 13 }}>Querying archive…</span>
                  </td></tr>
              )}
              {!loading && bugs.length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: 50, color: 'var(--text-sec)', fontSize: 13 }}>
                      <Search size={28} style={{ opacity: 0.2, display: 'block', margin: '0 auto 10px' }}/>
                      No records match the current filters.
                  </td></tr>
              )}
              {!loading && bugs.map(b => {
                const isResolved = ['fixed','resolved','verified'].some(s => (b.status||'').toLowerCase().includes(s));
                return (
                  <tr key={b.id} onClick={() => setSelectedBug(b)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>#{b.id}</td>
                    <td><SevBadge sev={b.severity}/></td>
                    <td>
                        <span style={{ background: 'var(--hover-bg)', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', display: 'inline-block', maxWidth: 140, textOverflow: 'ellipsis', verticalAlign: 'middle' }}>
                            {b.component || 'General'}
                        </span>
                    </td>
                    <td>
                        <div style={{ maxWidth: 380, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }} title={b.summary}>
                            {b.summary}
                        </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                        <span style={{ color: isResolved ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isResolved ? 'var(--success)' : 'var(--danger)' }}/>
                            {b.status || 'NEW'}
                        </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="table-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-sec)' }}>Rows per page</span>
              <div style={{ width: 100 }}>
                  <CustomSelect value={itemsPerPage} onChange={v => { setItemsPerPage(Number(v)); setPage(1); }} options={perPageOptions} placeholder="10 rows"/>
              </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-sec)' }}>
                  {Math.min((page-1)*itemsPerPage+1, total)}–{Math.min(page*itemsPerPage, total)} of {total.toLocaleString()}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                  <button className="sys-btn outline" disabled={page===1} onClick={() => setPage(p=>p-1)} style={{ padding: '6px 10px', height: 34 }}><ChevronLeft size={15}/></button>
                  <button className="sys-btn outline" disabled={page>=totalPages} onClick={() => setPage(p=>p+1)} style={{ padding: '6px 10px', height: 34 }}><ChevronRight size={15}/></button>
              </div>
          </div>
        </div>
      </div>

      {/* ── Bug Inspector Pane ── */}
      {selectedBug && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 2000 }} onClick={() => setSelectedBug(null)}/>
            <div className="bug-inspector-pane fade-in-right">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Target size={18} color="var(--accent)"/>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Record Inspection</span>
                    </div>
                    <button className="inspector-close" onClick={() => setSelectedBug(null)}><X size={18}/></button>
                </div>

                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>#{selectedBug.id}</div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.4, margin: '0 0 24px 0' }}>{selectedBug.summary}</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                    <div className="inspector-detail-box">
                        <span className="detail-label">Severity</span>
                        <SevBadge sev={selectedBug.severity}/>
                    </div>
                    <div className="inspector-detail-box">
                        <span className="detail-label">Status</span>
                        <span className="detail-value" style={{ color: ['fixed','resolved','verified'].some(s => (selectedBug.status||'').toLowerCase().includes(s)) ? 'var(--success)' : 'var(--danger)', fontSize: 13 }}>
                            {selectedBug.status}
                        </span>
                    </div>
                    <div className="inspector-detail-box" style={{ gridColumn: 'span 2' }}>
                        <span className="detail-label">Component</span>
                        <span style={{ background: 'var(--hover-bg)', padding: '5px 12px', borderRadius: 8, display: 'inline-block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                            {selectedBug.component || 'General'}
                        </span>
                    </div>
                </div>

                <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 10, border: '1px dashed var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        <Clock size={12}/> System Timeline
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-sec)', paddingLeft: 10, borderLeft: '2px solid var(--border)', marginLeft: 4, lineHeight: 1.8 }}>
                        <div style={{ marginBottom: 10 }}><strong style={{ color: 'var(--text-main)' }}>Report Logged</strong><br/>System ingestion via API.</div>
                        <div><strong style={{ color: 'var(--text-main)' }}>AI Triage Applied</strong><br/>Classified into {selectedBug.component || 'General'}.</div>
                    </div>
                </div>
            </div>
          </>
      )}
    </div>
  );
}

const filterPillStyle = {
    fontSize: 11, fontWeight: 700, padding: '4px 10px',
    background: 'var(--hover-bg)', color: 'var(--text-sec)',
    border: '1px solid var(--border)', borderRadius: 99,
    display: 'inline-flex', alignItems: 'center', gap: 5
};
