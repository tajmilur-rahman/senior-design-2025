import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useEscapeKey } from '../Components/Modal';
import {
    Search, Download, ChevronLeft, ChevronRight, Loader,
    X, Target, Clock, ShieldAlert, CheckCircle, Zap, ChevronDown, Database,
    Globe, PenTool, UploadCloud, Info
} from 'lucide-react';
import { GlossaryDrawer, GlossaryTrigger, SEVERITY_DEFS, STATUS_DEFS } from '../Components/Glossary';

function statusColor(status) {
    const s = (status || '').toUpperCase();
    if (s === 'VERIFIED') return 'text-indigo-400';
    if (['RESOLVED', 'CONFIRMED', 'FIXED'].some(x => s.includes(x))) return 'text-emerald-400';
    if (s === 'UNCONFIRMED') return 'text-amber-500';
    return 'text-white/40';
}

function CustomSelect({ value, onChange, options, placeholder, disabled = false, ariaLabel, triggerClassName, dropUp = false }) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);
  const listId = useRef(`sf-listbox-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedIdx = options.findIndex(o => String(o.value) === String(value));
  const selected = selectedIdx >= 0 ? options[selectedIdx] : null;

  useEffect(() => {
    if (!open) return;
    setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0);
  }, [open]);

  const openAnd = (idx) => { if (disabled) return; setOpen(true); setActiveIdx(idx); };
  const commit = (idx) => {
    if (idx < 0 || idx >= options.length) return;
    onChange(options[idx].value);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter': case ' ': e.preventDefault(); if (!open) openAnd(selectedIdx >= 0 ? selectedIdx : 0); else commit(activeIdx); break;
      case 'ArrowDown': e.preventDefault(); if (!open) openAnd(selectedIdx >= 0 ? selectedIdx : 0); else setActiveIdx(i => Math.min(options.length - 1, i + 1)); break;
      case 'ArrowUp': e.preventDefault(); if (!open) openAnd(Math.max(0, selectedIdx)); else setActiveIdx(i => Math.max(0, i - 1)); break;
      case 'Escape': if (open) { e.preventDefault(); setOpen(false); } break;
      case 'Tab': setOpen(false); break;
      default: break;
    }
  };

  return (
    <div ref={ref} className={`relative select-none w-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div
        role="combobox" tabIndex={disabled ? -1 : 0} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-disabled={disabled} aria-label={ariaLabel || placeholder}
        onClick={() => { if (!disabled) setOpen(o => !o); }}
        onKeyDown={onKeyDown}
        className={triggerClassName || `h-14 flex items-center justify-between px-5 border rounded-2xl cursor-pointer text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-blue-500/40 ${open ? 'border-blue-500/50 bg-white/10 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20'}`}
      >
        <span className={`truncate pr-2 ${selected ? 'text-white' : ''}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div id={listId} role="listbox" ref={listRef} aria-label={ariaLabel || placeholder} className={`absolute z-[9999] w-full bg-[#1a1d27] border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] overflow-hidden py-1.5 ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
          <div className="max-h-52 overflow-y-auto custom-scrollbar">
            {options.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              const isActive   = i === activeIdx;
              return (
                <div key={opt.value} role="option" aria-selected={isSelected} onClick={() => commit(i)} onMouseEnter={() => setActiveIdx(i)}
                  className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors mx-1.5 rounded-xl ${isSelected ? 'bg-blue-500/20 text-blue-400' : isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
                  {opt.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SevBadge({ sev }) {
    const badgeStyle = {
        S1: 'text-red-500 bg-red-500/10 border-red-500/20',
        S2: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        S3: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        S4: 'text-white/40 bg-white/5 border-white/10'
    }[sev] || 'text-white/40 bg-white/5 border-white/10';
    return (
        <span className={`px-2.5 py-1 rounded text-[10px] font-bold border font-mono whitespace-nowrap ${badgeStyle}`}>
            {sev || '—'}
        </span>
    );
}

// Bugzilla bugs carry Bugzilla-specific workflow statuses that no other source uses.
const BUGZILLA_STATUSES = new Set(['UNCONFIRMED', 'CONFIRMED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'REOPENED']);

function inferOrigin(bug) {
    const status = (bug.status || '').toUpperCase();
    // Bugzilla: detected by its unique workflow status values — NOT by ID range,
    // because bulk-imported bugs can also have high auto-incremented IDs.
    if (BUGZILLA_STATUSES.has(status)) return { label: 'Bugzilla', icon: <Globe size={11} />, desc: 'Synced from Mozilla Bugzilla. Status values (UNCONFIRMED, RESOLVED, etc.) are preserved directly from Bugzilla\'s own workflow.' };
    if (status === 'PROCESSED') return { label: 'Dataset', icon: <Database size={11} />, desc: 'From the pre-loaded Firefox historical dataset (220k+ bugs used for ML training).' };
    if (bug.batch_id || status === 'BULK') return { label: 'Bulk upload', icon: <UploadCloud size={11} />, desc: 'Uploaded via admin bulk import (JSON/CSV file).' };
    return { label: 'Manual', icon: <PenTool size={11} />, desc: 'Submitted directly by a team member via the Submit tab.' };
}

function OriginBadge({ origin }) {
    const tailwindStyle = origin.label === 'Bugzilla' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
                          origin.label === 'Dataset' ? 'text-slate-400 bg-slate-500/10 border-slate-500/20' :
                          origin.label === 'Bulk upload' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
                          'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border whitespace-nowrap ${tailwindStyle}`}>
            {origin.icon} {origin.label}
        </span>
    );
}

const SEV_OPTIONS = [
    { value: '', label: 'All severities' }, { value: 'S1', label: 'S1 — Critical' },
    { value: 'S2', label: 'S2 — High' },    { value: 'S3', label: 'S3 — Medium' },
    { value: 'S4', label: 'S4 — Low' },
];
const STATUS_OPTIONS = [
    { value: '', label: 'All statuses' },        { value: 'NEW', label: 'New' },
    { value: 'UNCONFIRMED', label: 'Unconfirmed' }, { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'RESOLVED', label: 'Resolved' },    { value: 'VERIFIED', label: 'Verified' },
];
const COMP_OPTIONS = [
    { value: '', label: 'All components' }, { value: 'Core', label: 'Core' },
    { value: 'DevTools', label: 'DevTools' }, { value: 'Frontend', label: 'Frontend' },
    { value: 'Security', label: 'Security' }, { value: 'Layout', label: 'Layout' },
    { value: 'Networking', label: 'Networking' },
];
const PER_PAGE_OPTIONS = [
    { value: 10, label: '10 rows' }, { value: 25, label: '25 rows' },
    { value: 50, label: '50 rows' }, { value: 100, label: '100 rows' },
];
const QUICK_FILTERS = [
    { key: 'critical', label: 'Critical',  icon: <Zap size={11} /> },
    { key: 'triage',   label: 'Triage',    icon: <Clock size={11} /> },
    { key: 'resolved', label: 'Resolved',  icon: <CheckCircle size={11} /> },
    { key: 'security', label: 'Security',  icon: <ShieldAlert size={11} /> },
];

export default function Explorer({ user, initialQuery = "", initialFilters = null, onNavigate }) {
    const isSystemLevel = user?.role === 'super_admin' || user?.role === 'developer';

    const [bugs,            setBugs]            = useState([]);
    const [total,           setTotal]           = useState(0);
    const [loading,         setLoading]         = useState(true);
    const [exporting,       setExporting]       = useState(false);
    const [showGlossary,    setShowGlossary]    = useState(false);
    const [search,          setSearch]          = useState(initialQuery);
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
    const [sevFilter,       setSevFilter]       = useState(initialFilters?.sev || '');
    const [statusFilter,    setStatusFilter]    = useState(initialFilters?.status || '');
    const [compFilter,      setCompFilter]      = useState(initialFilters?.comp || '');
    const [companyFilter,   setCompanyFilter]   = useState('');  // company_id for system users
    const [companies,       setCompanies]       = useState([]);
    const [sortConfig,      setSortConfig]      = useState({ key: 'id', direction: 'desc' });
    const [page,            setPage]            = useState(1);
    const [itemsPerPage,    setItemsPerPage]    = useState(10);
    const [selectedBug,     setSelectedBug]     = useState(null);
    useEscapeKey(() => setSelectedBug(null), !!selectedBug);

    // Fetch companies list for system-level users
    useEffect(() => {
        if (!isSystemLevel) return;
        axios.get('/api/superadmin/companies')
            .then(r => setCompanies(r.data || []))
            .catch(() => {});
    }, [isSystemLevel]);

    useEffect(() => { setSearch(initialQuery); setPage(1); }, [initialQuery]);
    useEffect(() => {
        const handler = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
        return () => clearTimeout(handler);
    }, [search]);

    const fetchBugs = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page, limit: itemsPerPage, search: debouncedSearch,
                sort_key: sortConfig.key, sort_dir: sortConfig.direction,
                sev: sevFilter, status: statusFilter, comp: compFilter,
                requested_role: user?.context_role || user?.role || 'user',
            };
            if (isSystemLevel && companyFilter) params.filter_company_id = companyFilter;
            const response = await axios.get('/api/hub/explorer', { params });
            setBugs(response.data.bugs || []);
            setTotal(response.data.total || 0);
        } catch (err) {
            if (err.response?.status === 401 && onNavigate) onNavigate('login');
        } finally { setLoading(false); }
    }, [page, itemsPerPage, debouncedSearch, sortConfig, sevFilter, statusFilter, compFilter, companyFilter, onNavigate, user?.context_role, user?.role, isSystemLevel]);

    useEffect(() => { fetchBugs(); }, [fetchBugs]);
    useEffect(() => { const iv = setInterval(fetchBugs, 30000); return () => clearInterval(iv); }, [fetchBugs]);

    const totalPages = Math.ceil(total / itemsPerPage);
    const requestSort = (key) => { setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' })); setPage(1); };
    const clearFilters = () => { setSearch(''); setSevFilter(''); setStatusFilter(''); setCompFilter(''); setCompanyFilter(''); setPage(1); };
    const applyQuickFilter = (type) => {
        clearFilters();
        if (type === 'critical') { setSevFilter('S1'); setStatusFilter('NEW'); }
        if (type === 'triage')   setStatusFilter('UNCONFIRMED');
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
            link.setAttribute('download', `spotfixes_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link); link.click(); link.remove();
        } catch { alert('Export failed.'); } finally { setExporting(false); }
    };

    const hasFilters = !!(sevFilter || statusFilter || compFilter || companyFilter || search);

    return (
        <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
            {showGlossary && <GlossaryDrawer onClose={() => setShowGlossary(false)} />}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
              <div className="relative z-10">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
                  Data <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">explorer</span>
                </h1>
                <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
                  Search, filter, and export the comprehensive history of all logged anomalies across your organization.
                </p>
                <p className="text-xs font-mono text-white/30 mt-4">
                  {loading ? 'Aggregating index…' : `${total.toLocaleString()} record${total !== 1 ? 's' : ''} available`}
                </p>
              </div>
              <div className="relative z-10 flex flex-col items-start md:items-end gap-4">
                 <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 w-max">
                   <Database size={12} className="text-emerald-500" />
                   <span className="text-[10px] font-bold tracking-widest uppercase">System Database</span>
                 </div>
                 <GlossaryTrigger onClick={() => setShowGlossary(true)} label="Labels & statuses" />
                 <div className="flex flex-wrap items-center gap-2">
                        {QUICK_FILTERS.map(f => (
                            <button key={f.key} onClick={() => applyQuickFilter(f.key)} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold text-white/50 hover:text-white uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-sm">
                                {f.icon} {f.label}
                            </button>
                        ))}
                        {hasFilters && <button onClick={clearFilters} className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-[10px] font-bold text-red-400 uppercase tracking-widest transition-all flex items-center gap-1.5"><X size={12} /> Clear</button>}
                 </div>
              </div>
              <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-emerald-500/20 via-white/5 to-transparent" />
            </div>

            {/* Company filter for system-level users */}
            {isSystemLevel && companies.length > 0 && (
                <div className="mb-4">
                    <div className="w-full md:w-72">
                        <CustomSelect
                            value={companyFilter}
                            onChange={v => { setCompanyFilter(v); setPage(1); }}
                            options={[
                                { value: '', label: 'All companies (global)' },
                                ...companies.map(c => ({ value: String(c.id), label: c.name })),
                            ]}
                            placeholder="All companies (global)"
                        />
                    </div>
                    {companyFilter && (
                        <p className="text-[10px] font-bold text-amber-500/70 uppercase tracking-widest mt-2 ml-1">
                            Filtering by: {companies.find(c => String(c.id) === companyFilter)?.name || companyFilter}
                        </p>
                    )}
                </div>
            )}

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center flex-wrap mb-8">
                    <div className="flex-1 w-full min-w-0 relative">
                        <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                        <input placeholder="Search summaries or #ID…" value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-white placeholder:text-white/30 focus:border-emerald-500/50 focus:bg-white/10 outline-none transition-all text-sm" />
                        {search && <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-2"><X size={16} /></button>}
                    </div>
                    <div className="w-full md:w-40"><CustomSelect value={sevFilter} onChange={v => { setSevFilter(v); setPage(1); }} options={SEV_OPTIONS} placeholder="All severities" /></div>
                    <div className="w-full md:w-40"><CustomSelect value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }} options={STATUS_OPTIONS} placeholder="All statuses" /></div>
                    <div className="w-full md:w-44"><CustomSelect value={compFilter} onChange={v => { setCompFilter(v); setPage(1); }} options={COMP_OPTIONS} placeholder="All components" /></div>
                    <button onClick={handleExport} disabled={exporting}
                        className="h-14 w-full md:w-auto px-6 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap">
                        {exporting ? <Loader size={16} className="animate-spin" /> : <Download size={16} />} Export
                    </button>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl backdrop-blur-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left min-w-[700px]">
                        <thead>
                            <tr className="bg-black/20 border-b border-white/10">
                                {[
                                    { key: 'id',        label: 'ID',        w: 90  },
                                    { key: 'severity',  label: 'Severity',  w: 90  },
                                    { key: 'component', label: 'Component', w: 150 },
                                    { key: 'summary',   label: 'Summary',   w: null },
                                    { key: 'status',    label: 'Status',    w: 130 },
                                ].map(col => (
                                    <th key={col.key} onClick={() => requestSort(col.key)} className="px-6 py-5 text-[10px] font-bold text-white/40 uppercase tracking-widest cursor-pointer select-none transition-colors hover:text-white" style={{ width: col.w || undefined }}>
                                        <span className="flex items-center gap-2">
                                            {col.label}
                                            {sortConfig.key === col.key && <span className="text-emerald-400">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={5} className="py-24 text-center">
                                    <Loader size={28} className="animate-spin text-white/20 mx-auto mb-4" />
                                    <div className="text-sm text-white/40 font-medium">Querying database…</div>
                                </td></tr>
                            )}
                            {!loading && bugs.length === 0 && (
                                <tr><td colSpan={5} className="py-24 text-center text-white/30 text-sm">No telemetry records match your exact filters.</td></tr>
                            )}
                            {!loading && bugs.map(b => {
                                const sColorClass = statusColor(b.status);
                                return (
                                    <tr key={b.id} onClick={() => setSelectedBug(b)} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer group">
                                        <td className="px-6 py-4 font-mono text-white/40 text-xs font-bold transition-colors group-hover:text-white/60">#{b.id}</td>
                                        <td className="px-6 py-4"><SevBadge sev={b.severity} /></td>
                                        <td className="px-6 py-4">
                                            <span className="bg-white/5 text-white/60 px-3 py-1.5 rounded-lg text-xs font-bold truncate max-w-[130px] inline-block">
                                                {b.component || 'General'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-white font-medium truncate max-w-[300px]" title={b.summary}>
                                            {b.summary}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap ${sColorClass}`}>
                                                {b.status || 'NEW'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-5 border-t border-white/10 bg-black/20 gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Display</span>
                        <div className="w-32"><CustomSelect value={itemsPerPage} onChange={v => { setItemsPerPage(Number(v)); setPage(1); }} options={PER_PAGE_OPTIONS} placeholder="10 rows" dropUp={true} /></div>
                    </div>
                    <div className="flex items-center gap-6">
                        <span className="text-xs font-mono text-white/40">
                            {total === 0 ? '0' : Math.min((page - 1) * itemsPerPage + 1, total)}–{Math.min(page * itemsPerPage, total)} of {total.toLocaleString()}
                        </span>
                        <div className="flex gap-2">
                            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-30 transition-all"><ChevronLeft size={16} /></button>
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-30 transition-all"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                </div>
            </div>

            {selectedBug && (() => {
                const origin = inferOrigin(selectedBug);
                const sevDef = SEVERITY_DEFS.find(d => d.code === selectedBug.severity);
                const statusDef = STATUS_DEFS.find(d => d.code === (selectedBug.status || '').toUpperCase());
                return createPortal(
                    <>
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9998] animate-in fade-in duration-300" onClick={() => setSelectedBug(null)} aria-hidden="true" />
                        <div role="dialog" aria-modal="true" aria-label="Bug detail" className="fixed top-0 right-0 bottom-0 w-full sm:w-[500px] bg-black/80 backdrop-blur-3xl border-l border-white/10 shadow-[-20px_0_60px_rgba(0,0,0,0.7)] z-[9999] p-6 lg:p-10 overflow-y-auto animate-in slide-in-from-right duration-300 custom-scrollbar">
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-3">
                                    <Target size={18} className="text-emerald-400" />
                                    <span className="text-sm font-bold text-white uppercase tracking-widest">Telemetry Detail</span>
                                </div>
                                <button onClick={() => setSelectedBug(null)} aria-label="Close bug detail" className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white/50 hover:text-white transition-colors"><X size={16} /></button>
                            </div>

                            <div className="font-mono text-xs text-white/40 mb-2">#{selectedBug.id}</div>
                            <h2 className="text-xl font-bold text-white leading-snug mb-8 break-words">{selectedBug.summary}</h2>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                                    <span className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Severity</span>
                                    <div>
                                        <SevBadge sev={selectedBug.severity} />
                                        <p className="text-xs text-white/50 mt-3 leading-relaxed">{sevDef?.desc || '—'}</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                                    <span className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Status</span>
                                    <div>
                                        <span className={`font-bold text-sm uppercase tracking-widest ${statusColor(selectedBug.status)}`}>{selectedBug.status || 'NEW'}</span>
                                        <p className="text-xs text-white/50 mt-3 leading-relaxed">{statusDef?.desc || '—'}</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl col-span-2 flex justify-between items-center">
                                    <span className="block text-[10px] font-bold text-white/40 uppercase tracking-widest">Component</span>
                                    <span className="bg-white/10 px-3 py-1.5 rounded-lg text-sm font-bold text-white truncate max-w-[200px]">
                                        {selectedBug.component || 'General'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-6 bg-white/[0.03] rounded-3xl border border-white/10 mb-6">
                                <div className="text-[10px] font-bold text-white/40 mb-5 flex items-center gap-2 uppercase tracking-widest">
                                    <Clock size={11} /> How this bug entered the system
                                </div>
                                <div className="flex items-center gap-4 mb-4">
                                    <OriginBadge origin={origin} />
                                </div>
                                <p className="text-xs text-white/50 mb-4">{origin.desc}</p>
                                <div className="text-xs text-white/50 pl-4 border-l-2 border-white/10 space-y-3">
                                    {origin.label === 'Bugzilla' ? (
                                        <>
                                            <div><strong className="text-white">Origin</strong> — Pulled from Mozilla Bugzilla API via background sync</div>
                                            <div><strong className="text-white">Status</strong> — <span className={`${statusColor(selectedBug.status)} font-bold`}>{selectedBug.status}</span> reflects Bugzilla's own workflow</div>
                                            <div><strong className="text-white">AI triage</strong> — Re-classified to <strong className="text-blue-400">{selectedBug.severity}</strong> using Random Forest</div>
                                        </>
                                    ) : origin.label === 'Manual' ? (
                                        <>
                                            <div><strong className="text-white">Origin</strong> — Submitted manually via Triage Entry</div>
                                            <div><strong className="text-white">Status</strong> — Logged as NEW; updates through pipeline</div>
                                            <div><strong className="text-white">AI triage</strong> — Classified as <strong className="text-blue-400">{selectedBug.severity}</strong> dynamically</div>
                                        </>
                                    ) : origin.label === 'Bulk upload' ? (
                                        <>
                                            <div><strong className="text-white">Origin</strong> — Ingested from JSON/CSV batch file</div>
                                            <div><strong className="text-white">AI triage</strong> — Batch-classified as <strong className="text-blue-400">{selectedBug.severity}</strong></div>
                                        </>
                                    ) : (
                                        <>
                                            <div><strong className="text-white">Origin</strong> — Pre-loaded Firefox historical DB</div>
                                            <div><strong className="text-white">Purpose</strong> — Baseline ML training data</div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {(selectedBug.status === 'UNCONFIRMED' || selectedBug.status === 'CONFIRMED') && (
                                <div className="flex gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mt-4">
                                    <Info size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                    <div className="text-xs text-white/60 leading-relaxed">
                                        <strong className="text-amber-500">{selectedBug.status}</strong> — Originates from Bugzilla lifecycle. {selectedBug.status === 'UNCONFIRMED' ? 'Reported but not yet reproduced.' : 'Verified by a second engineer.'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                , document.body);
            })()}
        </div>
    );
}
