import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
    Search, Download, ChevronLeft, ChevronRight, Loader,
    X, Target, Clock, ShieldAlert, CheckCircle, Zap, ChevronDown, Database,
    Globe, PenTool, UploadCloud, Info
} from 'lucide-react';
import { GlossaryDrawer, GlossaryTrigger, SEVERITY_DEFS, STATUS_DEFS } from '../Components/Glossary';

// Status color helper
function statusColor(status) {
    const s = (status || '').toUpperCase();
    if (s === 'VERIFIED') return '#6366f1';
    if (['RESOLVED', 'CONFIRMED', 'FIXED'].some(x => s.includes(x))) return 'var(--success)';
    if (s === 'UNCONFIRMED') return '#f59e0b';
    return 'var(--text-sec)';
}

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
            <div onClick={() => setOpen(o => !o)} style={{
                height: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 14px', background: 'var(--input-bg)', border: '1px solid var(--border)',
                borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                color: selected ? 'var(--text-main)' : 'var(--text-sec)',
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
                }}>
                    {options.map(opt => (
                        <div key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }} style={{
                            padding: '10px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            color: opt.value === value ? 'var(--accent)' : 'var(--text-main)',
                            background: opt.value === value ? 'var(--pill-bg)' : 'transparent',
                        }}
                            onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'var(--hover-bg)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = opt.value === value ? 'var(--pill-bg)' : 'transparent'; }}>
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function SevBadge({ sev }) {
    const map = {
        S1: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
        S2: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
        S3: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
        S4: { bg: 'var(--hover-bg)', color: 'var(--text-sec)', border: 'var(--border)' },
    };
    const s = map[sev] || map.S4;
    return (
        <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 800, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            {sev || '—'}
        </span>
    );
}

// Infer the likely origin of a bug from its fields
function inferOrigin(bug) {
    const status = (bug.status || '').toUpperCase();
    const id = bug.id;
    // Bugzilla bugs have numeric IDs in the millions (Mozilla's real IDs)
    if (id > 100000) return { label: 'Bugzilla', icon: <Globe size={11} />, color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', desc: 'Synced from Mozilla Bugzilla. Status values (UNCONFIRMED, RESOLVED, etc.) are preserved directly from Bugzilla\'s own workflow.' };
    if (status === 'PROCESSED') return { label: 'Dataset', icon: <Database size={11} />, color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)', desc: 'From the pre-loaded Firefox historical dataset (220k+ bugs used for ML training).' };
    if (bug.batch_id || status === 'BULK') return { label: 'Bulk upload', icon: <UploadCloud size={11} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', desc: 'Uploaded via admin bulk import (JSON/CSV file).' };
    return { label: 'Manual', icon: <PenTool size={11} />, color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.25)', desc: 'Submitted directly by a team member via the Submit tab.' };
}

function OriginBadge({ origin }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5,
            fontSize: 10, fontWeight: 700, color: origin.color, background: origin.bg, border: `1px solid ${origin.border}`,
            fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
        }}>
            {origin.icon} {origin.label}
        </span>
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
                    page,
                    limit: itemsPerPage,
                    search: debouncedSearch,
                    sort_key: sortConfig.key,
                    sort_dir: sortConfig.direction,
                    sev: sevFilter,
                    status: statusFilter,
                    comp: compFilter,
                    requested_role: user?.context_role || user?.role || 'user',
                }
            });
            setBugs(response.data.bugs || []);
            setTotal(response.data.total || 0);
        } catch (err) {
            if (err.response?.status === 401 && onNavigate) onNavigate('login');
        } finally { setLoading(false); }
    }, [page, itemsPerPage, debouncedSearch, sortConfig, sevFilter, statusFilter, compFilter, onNavigate, user?.context_role, user?.role]);

    useEffect(() => { fetchBugs(); }, [fetchBugs]);
    useEffect(() => { const iv = setInterval(fetchBugs, 30000); return () => clearInterval(iv); }, [fetchBugs]);

    const totalPages = Math.ceil(total / itemsPerPage);
    const requestSort = (key) => { setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' })); setPage(1); };
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
        { value: '', label: 'All severities' }, { value: 'S1', label: 'S1 — Critical' },
        { value: 'S2', label: 'S2 — High' }, { value: 'S3', label: 'S3 — Medium' }, { value: 'S4', label: 'S4 — Low' },
    ];
    const statusOptions = [
        { value: '', label: 'All statuses' }, { value: 'NEW', label: 'New' },
        { value: 'UNCONFIRMED', label: 'Unconfirmed' }, { value: 'CONFIRMED', label: 'Confirmed' },
        { value: 'RESOLVED', label: 'Resolved' }, { value: 'VERIFIED', label: 'Verified' },
    ];
    const compOptions = [
        { value: '', label: 'All components' }, { value: 'Core', label: 'Core' },
        { value: 'DevTools', label: 'DevTools' }, { value: 'Frontend', label: 'Frontend' },
        { value: 'Security', label: 'Security' }, { value: 'Layout', label: 'Layout' },
        { value: 'Networking', label: 'Networking' },
    ];
    const perPageOptions = [
        { value: 10, label: '10 rows' }, { value: 25, label: '25 rows' },
        { value: 50, label: '50 rows' }, { value: 100, label: '100 rows' },
    ];

    return (
        <div className="page-content fade-in" style={{ position: 'relative' }}>
            {showGlossary && <GlossaryDrawer onClose={() => setShowGlossary(false)} />}

            {/* Header */}
            <div className="explorer-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: -0.5 }}>Database</h1>
                        <span style={{ fontSize: 13, color: 'var(--text-sec)' }}>
                            {loading ? 'Loading…' : `${total.toLocaleString()} record${total !== 1 ? 's' : ''} found`}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <GlossaryTrigger onClick={() => setShowGlossary(true)} label="Labels & statuses" />
                        {[
                            { key: 'critical', label: 'Critical',  icon: <Zap size={11} /> },
                            { key: 'triage',   label: 'Triage',    icon: <Clock size={11} /> },
                            { key: 'resolved', label: 'Resolved',  icon: <CheckCircle size={11} /> },
                            { key: 'security', label: 'Security',  icon: <ShieldAlert size={11} /> },
                        ].map(f => (
                            <button key={f.key} className="quick-chip" onClick={() => applyQuickFilter(f.key)} style={{ fontSize: 12 }}>
                                {f.icon} {f.label}
                            </button>
                        ))}
                        {hasFilters && <button className="quick-chip clear" onClick={clearFilters} style={{ fontSize: 12 }}><X size={11} /> Clear</button>}
                    </div>
                </div>

                {/* Filter bar */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                        <Search size={14} color="var(--text-sec)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <input className="sys-input" placeholder="Search bugs…" value={search} onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: 36, paddingRight: search ? 32 : 10, height: 42, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-main)', outline: 'none', fontFamily: 'var(--font-head)' }}
                            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }} />
                        {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)', padding: 4, display: 'flex' }}><X size={12} /></button>}
                    </div>
                    <div style={{ width: 152 }}><CustomSelect value={sevFilter} onChange={v => { setSevFilter(v); setPage(1); }} options={sevOptions} placeholder="All severities" /></div>
                    <div style={{ width: 152 }}><CustomSelect value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }} options={statusOptions} placeholder="All statuses" /></div>
                    <div style={{ width: 158 }}><CustomSelect value={compFilter} onChange={v => { setCompFilter(v); setPage(1); }} options={compOptions} placeholder="All components" /></div>
                    <button className="sys-btn outline" onClick={handleExport} disabled={exporting}
                        style={{ height: 40, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--card-bg)', whiteSpace: 'nowrap' }}>
                        {exporting ? <Loader size={13} className="spin" /> : <Download size={13} />} Export
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="sys-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)' }}>
                                {[
                                    { key: 'id',        label: '#',         w: 70  },
                                    { key: 'severity',  label: 'Severity',  w: 90  },
                                    { key: 'component', label: 'Component', w: 150 },
                                    { key: 'summary',   label: 'Summary',   w: null },
                                    { key: 'status',    label: 'Status',    w: 130 },
                                ].map(col => (
                                    <th key={col.key} onClick={() => requestSort(col.key)} style={{
                                        padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800,
                                        color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8,
                                        cursor: 'pointer', whiteSpace: 'nowrap', width: col.w || undefined, userSelect: 'none',
                                    }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            {col.label}
                                            {sortConfig.key === col.key && <span style={{ color: 'var(--accent)' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={5} style={{ padding: '40px 0', textAlign: 'center' }}>
                                    <Loader size={20} color="var(--text-sec)" className="spin" style={{ margin: '0 auto' }} />
                                </td></tr>
                            )}
                            {!loading && bugs.length === 0 && (
                                <tr><td colSpan={5} style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-sec)', fontSize: 13 }}>No bugs match your filters.</td></tr>
                            )}
                            {!loading && bugs.map(b => {
                                const sColor = statusColor(b.status);
                                return (
                                    <tr key={b.id} onClick={() => setSelectedBug(b)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>#{b.id}</td>
                                        <td style={{ padding: '12px 16px' }}><SevBadge sev={b.severity} /></td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ background: 'var(--hover-bg)', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-main)', display: 'inline-block', maxWidth: 136, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                                {b.component || 'General'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ maxWidth: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }} title={b.summary}>{b.summary}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ color: sColor, fontWeight: 700, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: sColor, flexShrink: 0 }} />
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

            {/* Bug inspector */}
            {selectedBug && (() => {
                const origin = inferOrigin(selectedBug);
                const sevDef = SEVERITY_DEFS.find(d => d.code === selectedBug.severity);
                const statusDef = STATUS_DEFS.find(d => d.code === (selectedBug.status || '').toUpperCase());
                return (
                    <>
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 2000 }} onClick={() => setSelectedBug(null)} />
                        <div className="bug-inspector-pane fade-in-right">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Target size={16} color="var(--accent)" />
                                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Bug detail</span>
                                </div>
                                <button className="inspector-close" onClick={() => setSelectedBug(null)}><X size={16} /></button>
                            </div>

                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>#{selectedBug.id}</div>
                            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.45, margin: '0 0 20px' }}>{selectedBug.summary}</h2>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                                <div className="inspector-detail-box">
                                    <span className="detail-label">Severity</span>
                                    <div style={{ marginTop: 4 }}>
                                        <SevBadge sev={selectedBug.severity} />
                                        <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: '6px 0 0', lineHeight: 1.5 }}>{sevDef?.desc || '—'}</p>
                                    </div>
                                </div>
                                <div className="inspector-detail-box">
                                    <span className="detail-label">Status</span>
                                    <div style={{ marginTop: 4 }}>
                                        <span style={{ fontWeight: 700, fontSize: 12, color: statusColor(selectedBug.status) }}>{selectedBug.status || 'NEW'}</span>
                                        <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: '6px 0 0', lineHeight: 1.5 }}>{statusDef?.desc || '—'}</p>
                                    </div>
                                </div>
                                <div className="inspector-detail-box" style={{ gridColumn: 'span 2' }}>
                                    <span className="detail-label">Component</span>
                                    <span style={{ background: 'var(--hover-bg)', padding: '4px 10px', borderRadius: 7, display: 'inline-block', fontSize: 12, fontWeight: 600, color: 'var(--text-main)', marginTop: 4 }}>
                                        {selectedBug.component || 'General'}
                                    </span>
                                </div>
                            </div>

                            {/* Lifecycle / origin panel */}
                            <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 10, border: '1px dashed var(--border)', marginBottom: 16 }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    <Clock size={11} /> How this bug entered the system
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <OriginBadge origin={origin} />
                                    <span style={{ fontSize: 12, color: 'var(--text-sec)' }}>{origin.desc}</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-sec)', paddingLeft: 10, borderLeft: '2px solid var(--border)', marginLeft: 4, lineHeight: 1.9, marginTop: 8 }}>
                                    {origin.label === 'Bugzilla' ? (
                                        <>
                                            <div style={{ marginBottom: 6 }}>
                                                <strong style={{ color: 'var(--text-main)' }}>Origin</strong> — Pulled from Mozilla Bugzilla API via 24-hour background sync
                                            </div>
                                            <div style={{ marginBottom: 6 }}>
                                                <strong style={{ color: 'var(--text-main)' }}>Status</strong> — <span style={{ color: statusColor(selectedBug.status), fontWeight: 700 }}>{selectedBug.status}</span> reflects Bugzilla's own workflow state, not our AI triage
                                            </div>
                                            <div>
                                                <strong style={{ color: 'var(--text-main)' }}>AI triage</strong> — Severity re-classified to <strong style={{ color: 'var(--accent)' }}>{selectedBug.severity}</strong> using our Random Forest model
                                            </div>
                                        </>
                                    ) : origin.label === 'Manual' ? (
                                        <>
                                            <div style={{ marginBottom: 6 }}>
                                                <strong style={{ color: 'var(--text-main)' }}>Origin</strong> — Submitted by a team member via the Severity Analysis tab
                                            </div>
                                            <div style={{ marginBottom: 6 }}>
                                                <strong style={{ color: 'var(--text-main)' }}>Status</strong> — Set to <strong>NEW</strong> on creation; updated as it moves through triage
                                            </div>
                                            <div>
                                                <strong style={{ color: 'var(--text-main)' }}>AI triage</strong> — Classified as <strong style={{ color: 'var(--accent)' }}>{selectedBug.severity}</strong> by the ML model at submission time
                                            </div>
                                        </>
                                    ) : origin.label === 'Bulk upload' ? (
                                        <>
                                            <div style={{ marginBottom: 6 }}>
                                                <strong style={{ color: 'var(--text-main)' }}>Origin</strong> — Ingested from an admin-uploaded JSON or CSV batch file
                                            </div>
                                            <div>
                                                <strong style={{ color: 'var(--text-main)' }}>AI triage</strong> — Batch-classified as <strong style={{ color: 'var(--accent)' }}>{selectedBug.severity}</strong> during upload processing
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ marginBottom: 6 }}>
                                                <strong style={{ color: 'var(--text-main)' }}>Origin</strong> — Pre-loaded from the Firefox historical bug dataset
                                            </div>
                                            <div>
                                                <strong style={{ color: 'var(--text-main)' }}>Purpose</strong> — Used as baseline training data for the Random Forest classifier
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Status explanation note */}
                            {(selectedBug.status === 'UNCONFIRMED' || selectedBug.status === 'CONFIRMED') && (
                                <div style={{ display: 'flex', gap: 8, padding: '10px 13px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8 }}>
                                    <Info size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                                    <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: 0, lineHeight: 1.6 }}>
                                        <strong style={{ color: '#f59e0b' }}>{selectedBug.status}</strong> — This status comes from Bugzilla's bug lifecycle. "Unconfirmed" means the bug was reported but not yet reproduced by a second engineer. "Confirmed" means it has been verified.
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                );
            })()}
        </div>
    );
}