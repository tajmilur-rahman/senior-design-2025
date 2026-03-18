import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
    Search, Download, ArrowUpDown, ChevronLeft, ChevronRight, Loader,
    X, Target, Clock, ShieldAlert, CheckCircle, Zap, ChevronDown, Database
} from 'lucide-react';
import { GlossaryDrawer, GlossaryTrigger, SEVERITY_DEFS, STATUS_DEFS } from '../Components/Glossary';

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
                <ChevronDown size={14} color="var(--text-sec)" style={{ transition: '0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }} />
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
                            {opt.value === value && <CheckCircle size={13} color="var(--accent)" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const SEV_STYLES = {
    S1: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
    S2: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
    S3: { bg: 'rgba(37,99,235,0.1)', color: '#3b82f6', border: 'rgba(37,99,235,0.3)' },
    S4: { bg: 'var(--hover-bg)', color: 'var(--text-sec)', border: 'var(--border)' },
};

function SevBadge({ sev }) {
    const s = SEV_STYLES[sev] || SEV_STYLES.S3;
    const def = SEVERITY_DEFS.find(d => d.code === sev);
    return (
        <span
            title={def ? `${def.label} — ${def.desc}` : sev}
            style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                letterSpacing: 0.3, cursor: 'help',
            }}>
            {sev || 'S3'}
        </span>
    );
}

// Source badge — shows where a bug came from
function SourceBadge({ source }) {
    if (!source) return null;
    const map = {
        manual:   { label: 'Manual', color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
        bugzilla: { label: 'Bugzilla', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
        bulk:     { label: 'Bulk import', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
        dataset:  { label: 'Firefox dataset', color: '#64748b', bg: 'var(--hover-bg)' },
    };
    const s = map[source.toLowerCase()] || map.dataset;
    return (
        <span style={{
            padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
            background: s.bg, color: s.color, border: '1px solid transparent',
        }}>{s.label}</span>
    );
}

export default function Explorer({ user, initialQuery = "", onNavigate }) {
    const [bugs, setBugs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [showGlossary, setShowGlossary] = useState(false);

    const [search, setSearch] = useState(initialQuery);
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
    const [sevFilter, setSevFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [compFilter, setCompFilter] = useState('');

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
            const response = await axios.get('/api/hub/explorer', {
                params: {
                    page, limit: itemsPerPage,
                    search: debouncedSearch,
                    sort_key: sortConfig.key,
                    sort_dir: sortConfig.direction,
                    sev: sevFilter, status: statusFilter, comp: compFilter,
                }
            });
            setBugs(response.data.bugs || []);
            setTotal(response.data.total || 0);
        } catch (err) {
            if (err.response?.status === 401 && onNavigate) onNavigate('login');
        } finally { setLoading(false); }
    }, [page, itemsPerPage, debouncedSearch, sortConfig, sevFilter, statusFilter, compFilter, onNavigate]);

    useEffect(() => { fetchBugs(); }, [fetchBugs]);
    useEffect(() => {
        const interval = setInterval(fetchBugs, 30000);
        return () => clearInterval(interval);
    }, [fetchBugs]);

    const totalPages = Math.ceil(total / itemsPerPage);

    const requestSort = (key) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
        setPage(1);
    };

    const clearFilters = () => { setSearch(''); setSevFilter(''); setStatusFilter(''); setCompFilter(''); setPage(1); };

    const applyQuickFilter = (type) => {
        clearFilters();
        if (type === 'critical') { setSevFilter('S1'); setStatusFilter('NEW'); }
        if (type === 'triage') setStatusFilter('UNCONFIRMED');
        if (type === 'resolved') setStatusFilter('RESOLVED');
        if (type === 'security') setCompFilter('Security');
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const response = await axios.get('/api/hub/export', {
                params: { search: debouncedSearch, sort_key: sortConfig.key, sort_dir: sortConfig.direction, sev: sevFilter, status: statusFilter, comp: compFilter },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a'); link.href = url;
            link.setAttribute('download', `apex_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link); link.click(); link.remove();
        } catch { alert('Export failed.'); } finally { setExporting(false); }
    };

    const hasFilters = !!(sevFilter || statusFilter || compFilter || search);

    const sevOptions = [
        { value: '', label: 'All severities' },
        { value: 'S1', label: 'S1 — Critical' },
        { value: 'S2', label: 'S2 — High' },
        { value: 'S3', label: 'S3 — Medium' },
        { value: 'S4', label: 'S4 — Low' },
    ];
    const statusOptions = [
        { value: '', label: 'All statuses' },
        { value: 'NEW', label: 'New' },
        { value: 'UNCONFIRMED', label: 'Unconfirmed' },
        { value: 'CONFIRMED', label: 'Confirmed' },
        { value: 'RESOLVED', label: 'Resolved' },
        { value: 'VERIFIED', label: 'Verified' },
    ];
    const compOptions = [
        { value: '', label: 'All components' },
        { value: 'Core', label: 'Core' },
        { value: 'DevTools', label: 'DevTools' },
        { value: 'Frontend', label: 'Frontend' },
        { value: 'Security', label: 'Security' },
        { value: 'Layout', label: 'Layout' },
        { value: 'Networking', label: 'Networking' },
    ];
    const perPageOptions = [
        { value: 10, label: '10 rows' }, { value: 25, label: '25 rows' },
        { value: 50, label: '50 rows' }, { value: 100, label: '100 rows' },
    ];

    return (
        <div className="page-content fade-in" style={{ position: 'relative' }}>
            {showGlossary && <GlossaryDrawer onClose={() => setShowGlossary(false)} />}

            {/* ── Header ── */}
            <div className="explorer-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: -0.5 }}>
                            Database
                        </h1>
                        <span style={{ fontSize: 13, color: 'var(--text-sec)' }}>
                            {loading ? 'Loading…' : `${total.toLocaleString()} record${total !== 1 ? 's' : ''} found`}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <GlossaryTrigger onClick={() => setShowGlossary(true)} label="Labels & statuses" />
                        {[
                            { key: 'critical', label: 'Critical open', icon: <Zap size={11} /> },
                            { key: 'triage', label: 'Needs triage', icon: <Clock size={11} /> },
                            { key: 'resolved', label: 'Resolved', icon: <CheckCircle size={11} /> },
                            { key: 'security', label: 'Security', icon: <ShieldAlert size={11} /> },
                        ].map(f => (
                            <button key={f.key} className="quick-chip" onClick={() => applyQuickFilter(f.key)} style={{ fontSize: 12 }}>
                                {f.icon} {f.label}
                            </button>
                        ))}
                        {hasFilters && (
                            <button className="quick-chip clear" onClick={clearFilters} style={{ fontSize: 12 }}>
                                <X size={11} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Data source info strip */}
                <div style={{
                    display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
                    padding: '9px 14px', background: 'var(--hover-bg)',
                    borderRadius: 8, border: '1px solid var(--border)',
                }}>
                    <Database size={13} color="var(--text-sec)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, color: 'var(--text-sec)', fontWeight: 600 }}>Data sources:</span>
                    {[
                        { label: 'Firefox dataset', color: '#64748b' },
                        { label: 'Bugzilla sync', color: '#10b981' },
                        { label: 'Manual entry', color: '#6366f1' },
                        { label: 'Bulk import', color: '#f59e0b' },
                    ].map(s => (
                        <span key={s.label} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 11, fontWeight: 600, color: s.color,
                        }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                            {s.label}
                        </span>
                    ))}
                    <span style={{ fontSize: 11, color: 'var(--text-sec)', marginLeft: 'auto' }}>
                        Bugzilla auto-sync runs every 24 hours
                    </span>
                </div>

                {/* Filter bar */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto auto auto',
                    gap: 10, alignItems: 'center',
                    background: 'var(--bg)', padding: '12px 14px',
                    borderRadius: 10, border: '1px solid var(--border)',
                }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={14} color="var(--text-sec)" style={{ position: 'absolute', left: 11, pointerEvents: 'none', zIndex: 1 }} />
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search by summary or ID…"
                            style={{
                                width: '100%', height: 40, paddingLeft: 34, paddingRight: search ? 32 : 10,
                                background: 'var(--input-bg)', border: '1px solid var(--border)',
                                borderRadius: 8, fontSize: 13, color: 'var(--text-main)', outline: 'none',
                                fontFamily: 'var(--font-head)', transition: 'border-color 0.2s, box-shadow 0.2s',
                            }}
                            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} style={{
                                position: 'absolute', right: 8, background: 'none', border: 'none',
                                cursor: 'pointer', color: 'var(--text-sec)', padding: 4, display: 'flex', borderRadius: 4,
                            }}>
                                <X size={12} />
                            </button>
                        )}
                    </div>
                    <div style={{ width: 152 }}><CustomSelect value={sevFilter} onChange={v => { setSevFilter(v); setPage(1); }} options={sevOptions} placeholder="All severities" /></div>
                    <div style={{ width: 152 }}><CustomSelect value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }} options={statusOptions} placeholder="All statuses" /></div>
                    <div style={{ width: 158 }}><CustomSelect value={compFilter} onChange={v => { setCompFilter(v); setPage(1); }} options={compOptions} placeholder="All components" /></div>
                    <button className="sys-btn outline" onClick={handleExport} disabled={exporting}
                        style={{ height: 40, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--card-bg)', whiteSpace: 'nowrap' }}>
                        {exporting ? <Loader size={12} className="spin" /> : <Download size={12} />} Export CSV
                    </button>
                </div>

                {hasFilters && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {search && <span style={filterPillStyle}>Search: "{search}"</span>}
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
                            <col style={{ width: 86 }} /><col style={{ width: 86 }} /><col style={{ width: 150 }} />
                            <col /><col style={{ width: 115 }} />
                        </colgroup>
                        <thead>
                            <tr>
                                {[['id', 'ID'], ['severity', 'Severity'], ['component', 'Component'], ['summary', 'Summary'], ['status', 'Status']].map(([key, label]) => (
                                    <th key={key} onClick={() => requestSort(key)} style={{ cursor: 'pointer', whiteSpace: 'nowrap', textAlign: key === 'status' ? 'right' : 'left' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                            {label}
                                            <ArrowUpDown size={10} style={{ opacity: sortConfig.key === key ? 1 : 0.3, color: sortConfig.key === key ? 'var(--accent)' : 'inherit', transition: '0.2s' }} />
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: 56 }}>
                                    <Loader size={20} className="spin" color="var(--accent)" style={{ display: 'block', margin: '0 auto 10px' }} />
                                    <span style={{ color: 'var(--text-sec)', fontSize: 13 }}>Loading records…</span>
                                </td></tr>
                            )}
                            {!loading && bugs.length === 0 && (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: 56, color: 'var(--text-sec)', fontSize: 13 }}>
                                    <Search size={26} style={{ opacity: 0.15, display: 'block', margin: '0 auto 10px' }} />
                                    No records match the current filters.
                                </td></tr>
                            )}
                            {!loading && bugs.map(b => {
                                const isResolved = ['fixed', 'resolved', 'verified'].some(s => (b.status || '').toLowerCase().includes(s));
                                const statusDef = STATUS_DEFS.find(d => d.code === (b.status || '').toUpperCase());
                                return (
                                    <tr key={b.id} onClick={() => setSelectedBug(b)} style={{ cursor: 'pointer' }}>
                                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>#{b.id}</td>
                                        <td><SevBadge sev={b.severity} /></td>
                                        <td>
                                            <span style={{ background: 'var(--hover-bg)', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', display: 'inline-block', maxWidth: 136, textOverflow: 'ellipsis', verticalAlign: 'middle' }}>
                                                {b.component || 'General'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ maxWidth: 380, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }} title={b.summary}>
                                                {b.summary}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span
                                                title={statusDef?.desc}
                                                style={{ color: isResolved ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'help' }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: isResolved ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }} />
                                                {b.status || 'NEW'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="table-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-sec)' }}>Rows per page</span>
                        <div style={{ width: 108 }}><CustomSelect value={itemsPerPage} onChange={v => { setItemsPerPage(Number(v)); setPage(1); }} options={perPageOptions} placeholder="10 rows" /></div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-sec)' }}>
                            {total === 0 ? '0' : Math.min((page - 1) * itemsPerPage + 1, total)}–{Math.min(page * itemsPerPage, total)} of {total.toLocaleString()}
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button className="sys-btn outline" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 10px', height: 34 }}><ChevronLeft size={14} /></button>
                            <button className="sys-btn outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 10px', height: 34 }}><ChevronRight size={14} /></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bug inspector pane */}
            {selectedBug && (
                <>
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 2000 }} onClick={() => setSelectedBug(null)} />
                    <div className="bug-inspector-pane fade-in-right">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Target size={16} color="var(--accent)" />
                                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Bug detail</span>
                            </div>
                            <button className="inspector-close" onClick={() => setSelectedBug(null)}><X size={16} /></button>
                        </div>

                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>#{selectedBug.id}</div>
                        <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.45, margin: '0 0 20px' }}>{selectedBug.summary}</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                            <div className="inspector-detail-box">
                                <span className="detail-label">Severity</span>
                                <div style={{ marginTop: 4 }}>
                                    <SevBadge sev={selectedBug.severity} />
                                    <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: '6px 0 0', lineHeight: 1.5 }}>
                                        {SEVERITY_DEFS.find(d => d.code === selectedBug.severity)?.desc || '—'}
                                    </p>
                                </div>
                            </div>
                            <div className="inspector-detail-box">
                                <span className="detail-label">Status</span>
                                <div style={{ marginTop: 4 }}>
                                    <span style={{ fontWeight: 700, fontSize: 12, color: ['fixed', 'resolved', 'verified'].some(s => (selectedBug.status || '').toLowerCase().includes(s)) ? 'var(--success)' : 'var(--danger)' }}>
                                        {selectedBug.status}
                                    </span>
                                    <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: '6px 0 0', lineHeight: 1.5 }}>
                                        {STATUS_DEFS.find(d => d.code === (selectedBug.status || '').toUpperCase())?.desc || '—'}
                                    </p>
                                </div>
                            </div>
                            <div className="inspector-detail-box" style={{ gridColumn: 'span 2' }}>
                                <span className="detail-label">Component</span>
                                <span style={{ background: 'var(--hover-bg)', padding: '4px 10px', borderRadius: 7, display: 'inline-block', fontSize: 12, fontWeight: 600, color: 'var(--text-main)', marginTop: 4 }}>
                                    {selectedBug.component || 'General'}
                                </span>
                            </div>
                        </div>

                        <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 10, border: '1px dashed var(--border)' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                <Clock size={11} /> Lifecycle
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-sec)', paddingLeft: 10, borderLeft: '2px solid var(--border)', marginLeft: 4, lineHeight: 1.9 }}>
                                <div style={{ marginBottom: 8 }}><strong style={{ color: 'var(--text-main)' }}>Logged</strong> — Bug entered the system</div>
                                <div><strong style={{ color: 'var(--text-main)' }}>AI triage</strong> — Classified as {selectedBug.severity} in {selectedBug.component || 'General'}</div>
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
    display: 'inline-flex', alignItems: 'center', gap: 5,
};