import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useEscapeKey } from '../Components/Modal';
import {
    Search, Download, ChevronLeft, ChevronRight, Loader,
    X, Target, Clock, ShieldAlert, CheckCircle, Zap, ChevronDown, Database,
    Globe, PenTool, UploadCloud, Info
} from 'lucide-react';
import { GlossaryDrawer, GlossaryTrigger, SEVERITY_DEFS, STATUS_DEFS } from '../Components/Glossary';
import { LiquidButton as Button } from '../liquid-glass-button';
import { BentoCard } from '../bento-card';
import { MultipleSelect } from '../multiple-select';

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
  const isMulti = String(value).includes(',');

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
        className={triggerClassName || `h-11 flex items-center justify-between px-5 border rounded-xl cursor-pointer text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-indigo-500/30 ${open ? 'border-indigo-500/40 bg-white/[0.08] text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20'}`}
      >
        <span className={`truncate pr-2 text-sm tracking-wide ${selected || isMulti ? 'text-white' : 'text-white/50'}`}>{selected ? selected.label : (isMulti ? 'Multiple components' : placeholder)}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div id={listId} role="listbox" ref={listRef} aria-label={ariaLabel || placeholder} className={`absolute z-[9999] w-full border border-white/10 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-200 ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'}`} style={{ backgroundColor: 'var(--bg-elevated)', backdropFilter: 'blur(16px)' }}>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              const isActive   = i === activeIdx;
              return (
                <div key={opt.value} role="option" aria-selected={isSelected} onClick={() => commit(i)} onMouseEnter={() => setActiveIdx(i)}
                  className={`px-5 py-3 text-[13px] font-semibold tracking-wide cursor-pointer transition-colors mx-2 my-0.5 rounded-lg ${isSelected ? 'bg-indigo-500/15 text-indigo-400' : isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
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
        S3: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        S4: 'text-white/40 bg-white/5 border-white/10'
    }[sev] || 'text-white/40 bg-white/5 border-white/10';
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-mono whitespace-nowrap uppercase tracking-wider ${badgeStyle}`}>
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
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest border whitespace-nowrap ${tailwindStyle}`}>
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
    { key: 'critical',  label: 'S1 Critical',    dot: '#f87171' },
    { key: 'high',      label: 'S2 High',        dot: '#fbbf24' },
    { key: 'new',       label: 'New Issues',     dot: '#60a5fa' },
    { key: 'triage',    label: 'Needs triage',   dot: '#94a3b8' },
    { key: 'resolved',  label: 'Resolved',       dot: '#34d399' },
    { key: 'security',  label: 'Security',       dot: '#a855f7' },
    { key: 'frontend',  label: 'Frontend',       dot: '#e879f9' },
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
    const [companyFilter,   setCompanyFilter]   = useState(initialFilters?.company_id ? String(initialFilters.company_id) : '');  // company_id for system users
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
        if (initialFilters?.company_id) setCompanyFilter(String(initialFilters.company_id));
    }, [initialFilters?.company_id]);
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

    const activeQuickFilters = useMemo(() => {
        const active = [];
        if (sevFilter === 'S1') active.push('critical');
        if (sevFilter === 'S2') active.push('high');
        if (statusFilter === 'NEW') active.push('new');
        if (statusFilter === 'UNCONFIRMED') active.push('triage');
        if (statusFilter === 'RESOLVED') active.push('resolved');
        
        const comps = (compFilter || '').split(',').map(c => c.trim());
        if (comps.includes('Security')) active.push('security');
        if (comps.includes('Frontend')) active.push('frontend');
        return active;
    }, [sevFilter, statusFilter, compFilter]);

    const handleQuickFiltersChange = (newKeys) => {
        let newSev = '';
        let newStatus = '';
        let newComps = [];
        newKeys.forEach(k => {
            if (k === 'critical') newSev = 'S1';
            if (k === 'high')     newSev = 'S2';
            if (k === 'new')      newStatus = 'NEW';
            if (k === 'triage')   newStatus = 'UNCONFIRMED';
            if (k === 'resolved') newStatus = 'RESOLVED';
            if (k === 'security') newComps.push('Security');
            if (k === 'frontend') newComps.push('Frontend');
        });
        setSevFilter(newSev);
        setStatusFilter(newStatus);
        setCompFilter(newComps.join(','));
        setPage(1);
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
        <div className="w-full max-w-6xl mx-auto px-6 md:px-8 lg:px-10 py-8 lg:py-10 animate-in fade-in duration-700 font-sans" style={{ background: 'var(--bg)' }}>
            {showGlossary && <GlossaryDrawer onClose={() => setShowGlossary(false)} />}

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-[1.75rem] font-semibold tracking-tight mb-1 text-white">
                        Data explorer
                    </h1>
                    <p className="text-white/50 text-sm">
                        Query and inspect all bugs in the database.
                    </p>
                    <p className="text-xs font-mono text-white/30 mt-1">
                        {loading ? 'Aggregating index…' : `${total.toLocaleString()} record${total !== 1 ? 's' : ''} available`}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <GlossaryTrigger onClick={() => setShowGlossary(true)} label="Labels & statuses" />
                    <Button variant="outline"
                        onClick={handleExport}
                        disabled={exporting}
                    >
                        {exporting ? <Loader size={15} className="animate-spin" /> : <Download size={15} />}
                        Export
                    </Button>
                </div>
            </div>

            {/* Filter Toolbar Card */}
                <BentoCard className="p-6 mb-6 flex flex-col gap-6 !overflow-visible relative z-20" style={{ background: 'var(--card-bg)' }}>
                {/* Row 1: search bar — always full width */}
                    <div className="border-b border-white/5 pb-6">
                        <div className="relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                            <input
                                placeholder="Search summaries or #ID…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full h-12 border border-white/10 rounded-xl pl-11 pr-10 text-white placeholder:text-white/50 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all text-sm shadow-inner"
                                style={{ background: 'var(--bg)' }}
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10">
                                    <X size={15} />
                                </button>
                            )}
                        </div>
                </div>

                {/* Row 2: Dropdowns Grid */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${isSystemLevel && companies.length > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
                    {isSystemLevel && companies.length > 0 && (
                        <div className="w-full">
                            <CustomSelect
                                value={companyFilter}
                                onChange={v => { setCompanyFilter(v); setPage(1); }}
                                options={[
                                    { value: '', label: 'All orgs' },
                                    ...companies.map(c => ({ value: String(c.id), label: c.name })),
                                ]}
                                placeholder="All orgs"
                                ariaLabel="Filter by organisation"
                            />
                        </div>
                    )}
                    <div className="w-full">
                        <CustomSelect
                            value={compFilter}
                            onChange={v => { setCompFilter(v); setPage(1); }}
                            options={COMP_OPTIONS}
                            placeholder="Component"
                            ariaLabel="Filter by component"
                        />
                    </div>
                    <div className="w-full">
                        <CustomSelect
                            value={sevFilter}
                            onChange={v => { setSevFilter(v); setPage(1); }}
                            options={SEV_OPTIONS}
                            placeholder="Severity"
                            ariaLabel="Filter by severity"
                        />
                    </div>
                    <div className="w-full">
                        <CustomSelect
                            value={statusFilter}
                            onChange={v => { setStatusFilter(v); setPage(1); }}
                            options={STATUS_OPTIONS}
                            placeholder="Status"
                            ariaLabel="Filter by status"
                        />
                    </div>
                </div>

                {/* Row 3: Quick Filters & Clear */}
                <div className="flex flex-col gap-4 pt-4 mt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Quick Filters</span>
                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="h-9 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-[11px] font-bold uppercase tracking-widest text-red-400 transition-all flex items-center gap-1.5 flex-shrink-0"
                            >
                                <X size={14} /> Clear All
                            </button>
                        )}
                    </div>
                    <MultipleSelect 
                        tags={QUICK_FILTERS} 
                        value={activeQuickFilters} 
                        onChange={handleQuickFiltersChange} 
                    />
                </div>
            </BentoCard>

            {/* Company filter active label */}
            {isSystemLevel && companyFilter && (
                <p className="text-[11px] font-bold text-amber-500/70 uppercase tracking-widest mb-3 ml-1">
                    Filtering by: {companies.find(c => String(c.id) === companyFilter)?.name || companyFilter}
                </p>
            )}

            {/* Main Table Card */}
            <BentoCard className="overflow-hidden flex flex-col" style={{ background: 'var(--card-bg)' }}>

                {/* ── Desktop table (hidden on mobile) ── */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-white/10" style={{ background: 'var(--bg-elevated)' }}>
                                {[
                                    { key: 'id',        label: 'ID',        w: 80  },
                                    { key: 'severity',  label: 'Severity',  w: 96  },
                                    { key: 'component', label: 'Component', w: 140 },
                                    { key: 'summary',   label: 'Summary',   w: null },
                                    { key: 'status',    label: 'Status',    w: 130 },
                                ].map(col => (
                                    <th
                                        key={col.key}
                                        onClick={() => requestSort(col.key)}
                                        className="px-5 py-3 text-xs font-bold text-white/50 uppercase tracking-wider cursor-pointer select-none transition-colors hover:text-white"
                                        style={{ width: col.w || undefined }}
                                    >
                                        <span className="flex items-center gap-1.5">
                                            {col.label}
                                            {sortConfig.key === col.key && (
                                                <span className="text-emerald-400">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {loading && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <Loader size={26} className="animate-spin text-white/20 mx-auto mb-3" />
                                        <div className="text-sm text-white/40 font-medium">Querying database…</div>
                                    </td>
                                </tr>
                            )}
                            {!loading && bugs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-white/30 text-sm">
                                        No telemetry records match your exact filters.
                                    </td>
                                </tr>
                            )}
                            {!loading && bugs.map(b => {
                                const sColorClass = statusColor(b.status);
                                return (
                                    <tr
                                        key={b.id}
                                        onClick={() => setSelectedBug(b)}
                                        className="hover:bg-white/[0.03] transition-colors cursor-pointer group relative"
                                    >
                                        <td className="px-5 py-3.5 font-mono text-white/40 text-xs font-bold transition-colors group-hover:text-white/60">
                                            #{b.id}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <SevBadge sev={b.severity} />
                                        </td>
                                        <td className="px-5 py-3.5 text-white/60 text-xs">
                                            {b.component || 'General'}
                                        </td>
                                        <td className="px-5 py-3.5 text-white font-medium truncate max-w-xs" title={b.summary}>
                                            {b.summary}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${sColorClass}`}>
                                                {b.status || 'NEW'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* ── Mobile card list (hidden on desktop) ── */}
                <div className="block md:hidden">
                    {loading && (
                        <div className="py-16 text-center">
                            <Loader size={24} className="animate-spin text-white/20 mx-auto mb-3" />
                            <div className="text-sm text-white/40 font-medium">Querying database…</div>
                        </div>
                    )}
                    {!loading && bugs.length === 0 && (
                        <div className="py-16 text-center text-white/30 text-sm px-6">
                            No telemetry records match your filters.
                        </div>
                    )}
                    {!loading && bugs.map(b => {
                        const sColorClass = statusColor(b.status);
                        return (
                            <button
                                key={b.id}
                                onClick={() => setSelectedBug(b)}
                                className="w-full text-left px-4 py-4 border-b border-white/5 hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors flex flex-col gap-2"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] text-white/40 font-bold">#{b.id}</span>
                                        <SevBadge sev={b.severity} />
                                    </div>
                                    <span className={`text-[11px] font-bold uppercase tracking-wider whitespace-nowrap ${sColorClass}`}>
                                        {b.status || 'NEW'}
                                    </span>
                                </div>
                                <p className="text-sm text-white/80 font-medium leading-snug line-clamp-2">{b.summary}</p>
                                {b.component && (
                                    <span className="text-[11px] text-white/40">{b.component}</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Pagination Footer */}
                <div
                    className="px-5 py-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3"
                    style={{ background: 'var(--bg-elevated)' }}
                >
                    <div className="flex items-center gap-3 text-sm text-white/50">
                        <span className="text-xs font-mono">
                            {total === 0
                                ? '0 results'
                                : `Showing ${Math.min((page - 1) * itemsPerPage + 1, total)}–${Math.min(page * itemsPerPage, total)} of ${total.toLocaleString()}`}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-white/30 uppercase tracking-widest">Rows</span>
                            <div className="w-28">
                                <CustomSelect
                                    value={itemsPerPage}
                                    onChange={v => { setItemsPerPage(Number(v)); setPage(1); }}
                                    options={PER_PAGE_OPTIONS}
                                    placeholder="10 rows"
                                    dropUp={true}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            style={{ background: 'var(--card-bg)' }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            style={{ background: 'var(--card-bg)' }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </BentoCard>

            {/* Detail Slide-over Panel */}
            {selectedBug && (() => {
                const origin = inferOrigin(selectedBug);
                const sevDef = SEVERITY_DEFS.find(d => d.code === selectedBug.severity);
                const statusDef = STATUS_DEFS.find(d => d.code === (selectedBug.status || '').toUpperCase());
                return createPortal(
                    <>
                        <div
                            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9998] animate-in fade-in duration-300"
                            onClick={() => setSelectedBug(null)}
                            aria-hidden="true"
                        />
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-label="Bug detail"
                            className="fixed top-0 right-0 bottom-0 w-full sm:w-[500px] border-l border-white/10 shadow-[-20px_0_60px_rgba(0,0,0,0.7)] z-[9999] overflow-y-auto animate-in slide-in-from-right duration-300 custom-scrollbar"
                            style={{ background: 'var(--card-bg)', backdropFilter: 'blur(24px)' }}
                        >
                            {/* Panel Header */}
                            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between sticky top-0 z-10" style={{ background: 'var(--card-bg)', backdropFilter: 'blur(24px)' }}>
                                <div className="flex items-center gap-3">
                                    <Target size={16} className="text-emerald-400" />
                                    <span className="text-sm font-bold text-white uppercase tracking-widest">Telemetry Detail</span>
                                </div>
                                <button
                                    onClick={() => setSelectedBug(null)}
                                    aria-label="Close bug detail"
                                    className="p-1.5 border border-white/10 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Panel Content */}
                            <div className="p-6 lg:p-8 space-y-8">
                                {/* Top meta */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-xs text-white/40">#{selectedBug.id}</span>
                                        <SevBadge sev={selectedBug.severity} />
                                    </div>
                                    <h2 className="text-xl font-semibold text-white leading-snug break-words">
                                        {selectedBug.summary}
                                    </h2>

                                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                                        <div>
                                            <span className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Component</span>
                                            <span className="text-white font-medium bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-xs inline-block">
                                                {selectedBug.component || 'General'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Status</span>
                                            <span className={`font-bold text-sm uppercase tracking-widest ${statusColor(selectedBug.status)}`}>
                                                {selectedBug.status || 'NEW'}
                                            </span>
                                            {statusDef && <p className="text-xs text-white/40 mt-1 leading-relaxed">{statusDef.desc}</p>}
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Severity</span>
                                            <div>
                                                <SevBadge sev={selectedBug.severity} />
                                                {sevDef && <p className="text-xs text-white/40 mt-2 leading-relaxed">{sevDef.desc}</p>}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Reporter</span>
                                            <span className="text-white/70 text-xs">{selectedBug.reporter || '—'}</span>
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-white/10" />

                                {/* Origin provenance */}
                                <div className="p-5 bg-white/[0.03] rounded-2xl border border-white/10">
                                    <div className="text-[11px] font-bold text-white/40 mb-4 flex items-center gap-2 uppercase tracking-widest">
                                        <Clock size={11} /> How this bug entered the system
                                    </div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <OriginBadge origin={origin} />
                                    </div>
                                    <p className="text-xs text-white/50 mb-4">{origin.desc}</p>
                                    <div className="text-xs text-white/50 pl-4 border-l-2 border-white/10 space-y-3">
                                        {origin.label === 'Bugzilla' ? (
                                            <>
                                                <div><strong className="text-white">Origin</strong> — Pulled from Mozilla Bugzilla API via background sync</div>
                                                <div><strong className="text-white">Status</strong> — <span className={`${statusColor(selectedBug.status)} font-bold`}>{selectedBug.status}</span> reflects Bugzilla's own workflow</div>
                                                <div><strong className="text-white">AI triage</strong> — Re-classified to <strong className="text-indigo-400">{selectedBug.severity}</strong> using Random Forest</div>
                                            </>
                                        ) : origin.label === 'Manual' ? (
                                            <>
                                                <div><strong className="text-white">Origin</strong> — Submitted manually via Triage Entry</div>
                                                <div><strong className="text-white">Status</strong> — Logged as NEW; updates through pipeline</div>
                                                <div><strong className="text-white">Severity</strong> — Set to <strong className="text-indigo-400">{selectedBug.severity}</strong> at submission</div>
                                            </>
                                        ) : origin.label === 'Bulk upload' ? (
                                            <>
                                                <div><strong className="text-white">Origin</strong> — Ingested from JSON/CSV batch file</div>
                                                <div><strong className="text-white">AI triage</strong> — Batch-classified as <strong className="text-indigo-400">{selectedBug.severity}</strong></div>
                                            </>
                                        ) : (
                                            <>
                                                <div><strong className="text-white">Origin</strong> — Pre-loaded Firefox historical DB</div>
                                                <div><strong className="text-white">Purpose</strong> — Baseline ML training data</div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Bugzilla status callout */}
                                {(selectedBug.status === 'UNCONFIRMED' || selectedBug.status === 'CONFIRMED') && (
                                    <div className="flex gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                        <Info size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                        <div className="text-xs text-white/60 leading-relaxed">
                                            <strong className="text-amber-500">{selectedBug.status}</strong> — Originates from Bugzilla lifecycle.{' '}
                                            {selectedBug.status === 'UNCONFIRMED' ? 'Reported but not yet reproduced.' : 'Verified by a second engineer.'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                , document.body);
            })()}
        </div>
    );
}
