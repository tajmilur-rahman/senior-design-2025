import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Database, Activity, AlertTriangle, ExternalLink, RefreshCw, ChevronDown,
  TrendingUp, ShieldCheck, Zap, ArrowRight, LayoutTemplate,
  Building2, Globe, Users, Crown, Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, CartesianGrid } from 'recharts';

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
  useEffect(() => { if (!open) return; setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0); }, [open]);
  const openAnd = (idx) => { if (disabled) return; setOpen(true); setActiveIdx(idx); };
  const commit = (idx) => { if (idx < 0 || idx >= options.length) return; onChange(options[idx].value); setOpen(false); };
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
      <div role="combobox" tabIndex={disabled ? -1 : 0} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-disabled={disabled} aria-label={ariaLabel || placeholder} onClick={() => { if (!disabled) setOpen(o => !o); }} onKeyDown={onKeyDown}
        className={triggerClassName || `h-12 flex items-center justify-between px-4 border rounded-xl cursor-pointer text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-indigo-500/30 ${open ? 'border-indigo-500/40 bg-white/[0.08] text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20'}`}>
        <span className={`truncate pr-2 ${selected ? 'text-white' : ''}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div id={listId} role="listbox" ref={listRef} aria-label={ariaLabel || placeholder} className={`absolute z-[9999] w-full border border-white/10 rounded-xl shadow-md overflow-hidden py-1.5 ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`} style={{ background: 'var(--card-bg)' }}>
          <div className="max-h-52 overflow-y-auto custom-scrollbar">
            {options.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              return (<div key={opt.value} role="option" aria-selected={isSelected} onClick={() => commit(i)} onMouseEnter={() => setActiveIdx(i)} className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors mx-1.5 rounded-xl ${isSelected ? 'bg-indigo-500/15 text-indigo-400' : i === activeIdx ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>{opt.label}</div>);
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const HOTSPOT_BLUE  = '#6366f1';
const HOTSPOT_AMBER = '#f59e0b';

function LiveFeedRow({ bug }) {
  const isCritical = bug.severity === 'S1';
  const badgeColors = {
    S1: 'bg-red-500/10 text-red-400 border-red-500/20',
    S2: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    S3: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    S4: 'bg-white/5 text-white/50 border-white/10'
  }[bug.severity] || 'bg-white/5 text-white/50 border-white/10';

  return (
    <div className="group flex items-center gap-4 px-4 py-3 mx-2 my-0.5 rounded-lg hover:bg-white/[0.04] transition-all duration-200 cursor-pointer border border-transparent hover:border-white/5">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isCritical ? 'bg-red-400' : 'bg-white/20'}`} />
      <div className="flex-1 min-w-0 transition-transform duration-300 group-hover:translate-x-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[11px] text-white/30 font-bold tracking-wider group-hover:text-white/50 transition-colors">#{bug.id}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${badgeColors}`}>{bug.severity || 'S3'}</span>
        </div>
        <div className="text-sm text-white/80 truncate font-medium group-hover:text-white transition-colors leading-relaxed">{bug.summary}</div>
      </div>
      <div className="text-[11px] font-bold text-white/20 group-hover:text-white/60 transition-colors uppercase tracking-widest flex items-center gap-1 flex-shrink-0">
        {bug.status || 'NEW'} <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

// ── Global Overview for super_admin / developer ───────────────────────────────
function GlobalOverview({ user, onNavigate, data, error, lastUpdated, onRefresh, selectedCompany, onSelectCompany }) {
  const [companies, setCompanies] = useState([]);
  const [pending,   setPending]   = useState([]);
  const [loadingCo, setLoadingCo] = useState(true);
  const [isLight,   setIsLight]   = useState(false);

  // Observe theme changes without querying the DOM on every render
  useEffect(() => {
    const root = document.querySelector('[data-theme]') || document.documentElement;
    const update = () => setIsLight(root.getAttribute('data-theme') === 'light');
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const fetchGlobal = useCallback(async () => {
    setLoadingCo(true);
    try {
      const [coRes, pendRes] = await Promise.all([
        axios.get('/api/superadmin/companies'),
        axios.get('/api/superadmin/pending'),
      ]);
      setCompanies(coRes.data || []);
      setPending(pendRes.data || []);
    } catch { /* ignore */ }
    finally { setLoadingCo(false); }
  }, []);

  useEffect(() => { fetchGlobal(); }, [fetchGlobal]);

  const totalBugs     = companies.reduce((s, c) => s + (c.total    || 0), 0);
  const totalCritical = companies.reduce((s, c) => s + (c.critical || 0), 0);
  const totalResolved = companies.reduce((s, c) => s + (c.resolved || 0), 0);
  const totalUsers    = companies.reduce((s, c) => s + (c.users    || 0), 0);
  const resolutionRate = totalBugs > 0 ? ((totalResolved / totalBugs) * 100).toFixed(1) : '0';

  const topComponent = data?.charts?.components?.[0]?.name || 'General';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-10 font-sans"
      style={{ background: 'var(--bg)' }}
    >
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-white/10 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-500">
              <Crown size={12} />
              <span className="text-[11px] font-medium tracking-[0.06em] uppercase">Global Overview</span>
            </div>
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border ${error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-400'}`} />
              <span className="text-[11px] font-medium tracking-[0.06em] uppercase">{error ? 'Reconnecting…' : 'All Systems Live'}</span>
            </div>
            {lastUpdated && !error && (
              <span className="text-xs text-white/30 font-medium font-mono">
                Synced {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-white mb-1">
            Global <span className="text-amber-400">command</span>
          </h1>
          <p className="text-sm text-white/50 leading-relaxed">
            Every registered company, live — one view, one truth.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full md:w-auto min-w-[340px]">
          {/* Action buttons row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onRefresh(); fetchGlobal(); }}
              className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            >
              <RefreshCw size={14} className={loadingCo ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => onNavigate('database')}
              className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            >
              <Database size={15} className="text-white/50" /> Explorer
            </button>
            {selectedCompany && (
              <button
                onClick={() => onNavigate('submit')}
                className="flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 px-5 py-2.5 rounded-xl text-sm font-bold transition-all "
              >
                <Zap size={15} className="text-black" /> Triage
              </button>
            )}
          </div>
          {/* Company selector */}
          <div className="flex items-center gap-2">
            <CustomSelect
              value={selectedCompany?.id ?? ''}
              onChange={v => {
                const id = v;
                if (!id) { onSelectCompany && onSelectCompany(null); return; }
                const co = companies.find(c => String(c.id) === String(id));
                onSelectCompany && onSelectCompany(co || null);
              }}
              options={[{ value: '', label: 'All Organizations' }, ...companies.map(co => ({ value: co.id, label: co.name }))]}
              placeholder="All Organizations"
            />
            {selectedCompany && (
              <button
                onClick={() => onSelectCompany && onSelectCompany(null)}
                className="text-xs font-bold text-white/40 hover:text-red-400 transition-colors px-3 py-2.5 border border-white/10 rounded-xl bg-white/5 hover:border-red-500/20"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Pending approvals banner ─────────────────────────────────────────── */}
      {pending.length > 0 && (
        <div className="mb-8 flex items-center gap-4 p-4 bg-amber-500/[0.06] border border-amber-500/30 rounded-2xl animate-in fade-in">
          <Clock size={16} className="text-amber-500 flex-shrink-0" />
          <span className="text-sm font-bold text-amber-400">
            {pending.length} user{pending.length !== 1 ? 's' : ''} awaiting approval
          </span>
          <button
            onClick={() => onNavigate('superadmin')}
            className="ml-auto text-xs font-bold text-amber-500 hover:text-amber-300 transition-colors uppercase tracking-widest flex items-center gap-1"
          >
            Review <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* ── Per-company stat override ────────────────────────────────────────── */}
      {selectedCompany && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 border border-amber-500/20 rounded-2xl p-1 bg-amber-500/[0.02]">
          <div className="col-span-2 md:col-span-5 px-4 pt-3 pb-1 flex items-center gap-2">
            <Building2 size={14} className="text-amber-400" />
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">{selectedCompany.name} — Stats</span>
          </div>
          {[
            { label: 'Total Records',   value: (selectedCompany.total    || 0).toLocaleString(), color: 'text-white'       },
            { label: 'Critical Open',   value: (selectedCompany.critical || 0).toLocaleString(), color: 'text-red-400'     },
            { label: 'Resolved',        value: (selectedCompany.resolved || 0).toLocaleString(), color: 'text-[var(--accent)]'   },
            { label: 'Active Users',    value:  selectedCompany.users    || 0,                   color: 'text-white'       },
            { label: 'Resolution Rate', value: (selectedCompany.total > 0
                ? ((selectedCompany.resolved / selectedCompany.total) * 100).toFixed(1)
                : '0') + '%',                                                                     color: 'text-amber-400'  },
          ].map(s => (
            <div key={s.label} className="border border-white/10 rounded-2xl p-5" style={{ background: 'var(--card-bg)' }}>
              <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">{s.label}</div>
              <div className={`text-2xl font-bold font-mono tracking-tight ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Global stat cards ────────────────────────────────────────────────── */}
      {!selectedCompany && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            {
              label: 'Total Records',
              value: totalBugs.toLocaleString(),
              icon: <Database size={18} className="text-indigo-400" />,
              valueColor: 'text-white',
              nav: () => onNavigate('database'),
            },
            {
              label: 'Critical Open',
              value: totalCritical.toLocaleString(),
              icon: <AlertTriangle size={18} className="text-red-400" />,
              valueColor: 'text-red-400',
              nav: () => onNavigate('database', '', null, { sev: 'S1' }),
            },
            {
              label: 'Resolution Rate',
              value: resolutionRate + '%',
              icon: <TrendingUp size={18} className="text-[var(--accent)]" />,
              valueColor: 'text-[var(--accent)]',
              nav: null,
            },
          ].map(s => (
            <motion.div
              key={s.label}
              whileInView={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              viewport={{ once: true }}
              onClick={s.nav || undefined}
              className={`border border-white/10 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 ease-out ${s.nav ? 'cursor-pointer hover:border-white/20 hover:-translate-y-1 hover:shadow-xl' : ''}`}
              style={{ background: 'var(--card-bg)' }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10" style={{ background: 'var(--bg-elevated)' }}>
                  {s.icon}
                </div>
                {s.nav && (
                  <ExternalLink size={14} className="text-white/20 group-hover:text-white/50 transition-colors" />
                )}
              </div>
              <div className={`text-3xl font-bold font-mono tracking-tight mb-1 ${s.valueColor}`}>{s.value}</div>
              <div className="text-xs text-white/40 font-medium uppercase tracking-widest">{s.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Second row of global stats (when no company selected) ────────────── */}
      {!selectedCompany && (
        <div className="grid grid-cols-2 md:grid-cols-2 gap-6 mb-8">
          {[
            {
              label: 'Resolved',
              value: totalResolved.toLocaleString(),
              icon: <ShieldCheck size={18} className="text-[var(--accent)]" />,
              valueColor: 'text-[var(--accent)]',
              nav: () => onNavigate('database', '', null, { status: 'RESOLVED' }),
            },
            {
              label: 'Active Users',
              value: totalUsers,
              icon: <Users size={18} className="text-indigo-400" />,
              valueColor: 'text-white',
              nav: () => onNavigate('superadmin'),
            },
          ].map(s => (
            <motion.div
              key={s.label}
              whileInView={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              viewport={{ once: true }}
              onClick={s.nav || undefined}
              className={`border border-white/10 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 ease-out ${s.nav ? 'cursor-pointer hover:border-white/20 hover:-translate-y-1 hover:shadow-xl' : ''}`}
              style={{ background: 'var(--card-bg)' }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10" style={{ background: 'var(--bg-elevated)' }}>
                  {s.icon}
                </div>
                {s.nav && (
                  <ExternalLink size={14} className="text-white/20 group-hover:text-white/50 transition-colors" />
                )}
              </div>
              <div className={`text-3xl font-bold font-mono tracking-tight mb-1 ${s.valueColor}`}>{s.value}</div>
              <div className="text-xs text-white/40 font-medium uppercase tracking-widest">{s.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Live Feed + Chart ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Live Feed — wider column */}
        <motion.div
          whileInView={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          className="lg:col-span-3 border border-white/10 rounded-2xl flex flex-col overflow-hidden"
          style={{ background: 'var(--card-bg)' }}
        >
          <div className="p-5 border-b border-white/10 flex justify-between items-center rounded-t-2xl" style={{ background: 'var(--bg-elevated)' }}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-white flex items-center gap-2 tracking-wide">
                <Activity size={15} className="text-white/40" /> LIVE TRIAGE FEED
              </span>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-red-500' : 'bg-[var(--accent)]'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${error ? 'bg-red-500' : 'bg-[var(--accent)]'}`} />
              </span>
            </div>
            <button
              onClick={() => onNavigate('database', '')}
              className="text-xs font-bold text-white/30 hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1"
            >
              View All <ArrowRight size={12} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-3 px-2 min-h-[300px] custom-scrollbar">
            {(data?.recent || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm font-medium min-h-[280px]">
                <Database size={32} className="mb-4 opacity-20" />No recent reports
              </div>
            ) : (data?.recent || []).map((bug, i) => <LiveFeedRow key={i} bug={bug} />)}
          </div>
        </motion.div>

        {/* Hotspot chart — narrower column */}
        <motion.div
          whileInView={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          className="lg:col-span-2 border border-white/10 rounded-2xl p-6 flex flex-col"
          style={{ background: 'var(--card-bg)' }}
        >
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm font-bold text-white flex items-center gap-2 tracking-wide uppercase">
              <LayoutTemplate size={15} className="text-indigo-400/60" /> Global Hotspots
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/30 border border-white/10 px-2 py-1 rounded-md" style={{ background: 'var(--bg-elevated)' }}>By Volume</span>
          </div>
          {data?.charts?.components?.length > 0 ? (
            <div className="flex-1 flex flex-col">
              <div className="flex-1" style={{ minHeight: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.components} layout="vertical" margin={{ top: 8, right: 48, left: 8, bottom: 28 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.05)'} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.55)' }}
                      axisLine={false} tickLine={false}
                      label={{ value: 'Open issues', position: 'insideBottom', offset: -16, fill: isLight ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em' }}
                    />
                    <YAxis dataKey="name" type="category" width={120}
                      tick={{ fontSize: 12, fill: isLight ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}
                      axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ borderRadius: '16px', border: `1px solid ${isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)'}`, background: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(10,10,10,0.95)', color: isLight ? '#0f172a' : '#fff', fontSize: '13px', boxShadow: isLight ? '0 20px 40px rgba(0,0,0,0.12)' : '0 20px 40px rgba(0,0,0,0.5)', padding: '12px 16px' }}
                      itemStyle={{ color: isLight ? '#0f172a' : '#fff', fontWeight: 700 }}
                      formatter={(v) => [v, 'Issues']}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                      {data.charts.components.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? HOTSPOT_AMBER : HOTSPOT_BLUE} fillOpacity={i === 0 ? 1 : 0.55} />
                      ))}
                      <LabelList dataKey="value" position="right" fill={isLight ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.75)'} fontSize={11} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {topComponent !== 'General' && (
                <p className="text-xs text-white/40 pt-4 pb-1 leading-relaxed text-center border-t border-white/10 mt-4 flex-shrink-0">
                  <strong className="text-white">{topComponent}</strong> holds the highest density of unresolved anomalies globally.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col flex-1 items-center justify-center min-h-[240px] text-white/30 text-sm font-medium">
              <ShieldCheck size={32} className="mb-4 opacity-20" />System clear — no data yet.
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Company breakdown table ──────────────────────────────────────────── */}
      <motion.div
        whileInView={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 20 }}
        viewport={{ once: true }}
        className="border border-white/10 rounded-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)' }}
      >
        <div className="p-5 border-b border-white/10 flex items-center gap-3" style={{ background: 'var(--bg-elevated)' }}>
          <Globe size={15} className="text-indigo-400" />
          <span className="text-xs font-bold text-white uppercase tracking-widest">Registered Organizations</span>
          <span className="ml-auto text-[11px] font-bold text-white/40 uppercase tracking-widest px-2.5 py-1 border border-white/10 rounded-lg" style={{ background: 'var(--bg)' }}>
            {companies.length} org{companies.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-white/10" style={{ background: 'var(--bg-elevated)' }}>
                {['Organisation', 'Total Bugs', 'Critical', 'Resolved', 'Users', 'Resolution Rate', '', ''].map((h, i) => (
                  <th key={i} className="px-6 py-3 text-xs font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loadingCo ? (
                <tr><td colSpan={8} className="py-16 text-center">
                  <RefreshCw size={22} className="animate-spin text-white/30 mx-auto" />
                </td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-white/30 text-sm font-medium">No companies found.</td></tr>
              ) : companies.map(co => {
                const rate = co.total > 0 ? ((co.resolved / co.total) * 100).toFixed(1) : '0';
                return (
                  <tr key={co.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                          <Building2 size={14} className="text-white" />
                        </div>
                        <span className="font-bold text-sm text-white truncate max-w-[160px]">{co.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-white font-mono">{(co.total || 0).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded border border-red-500/20">
                        {co.critical || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--accent)] font-bold">{(co.resolved || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-white/50">{co.users || 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: rate + '%' }} />
                        </div>
                        <span className="text-xs font-bold text-white/60 font-mono">{rate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onNavigate('database')}
                        className="text-[11px] font-bold text-white/30 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1"
                      >
                        Explore <ArrowRight size={10} />
                      </button>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => onSelectCompany && onSelectCompany(selectedCompany?.id === co.id ? null : co)}
                        className={`text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-1 px-2.5 py-1 rounded ${
                          selectedCompany?.id === co.id
                            ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                            : 'text-white/30 hover:text-amber-400 hover:bg-amber-500/10'
                        }`}
                      >
                        {selectedCompany?.id === co.id ? 'Selected' : 'Select'} <Building2 size={10} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Standard overview for regular users ──────────────────────────────────────
export default function Overview({ user, onNavigate, selectedCompany, onSelectCompany }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const root = document.querySelector('[data-theme]') || document.documentElement;
    const update = () => setIsLight(root.getAttribute('data-theme') === 'light');
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const isSystemLevel = user?.role === 'super_admin' || user?.role === 'developer';

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get('/api/hub/overview');
      setData(res.data); setError(false); setLastUpdated(new Date());
    } catch { setError(true); }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!error) return;
    const fastPoll = setInterval(fetchData, 3000);
    return () => clearInterval(fastPoll);
  }, [error, fetchData]);

  if (error && !data) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-2">
        <AlertTriangle size={24} className="text-red-500" />
      </div>
      <div className="text-white font-bold text-xl tracking-tight">System Disconnected</div>
      <div className="text-white/50 text-sm max-w-xs text-center leading-relaxed">Waiting for the intelligence backend to respond. Make sure your local server is running.</div>
      <button onClick={fetchData} className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-bold text-white">
        <RefreshCw size={14} /> Retry Connection
      </button>
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-2">
        <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
      <div className="text-white font-bold text-xl tracking-tight">Initializing Workspace</div>
      <div className="text-white/40 text-sm">Aggregating telemetry...</div>
    </div>
  );

  // System-level users get the global overview
  if (isSystemLevel) {
    return (
      <GlobalOverview
        user={user}
        onNavigate={onNavigate}
        data={data}
        error={error}
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        selectedCompany={selectedCompany}
        onSelectCompany={onSelectCompany}
      />
    );
  }

  const topComponent = data.charts?.components?.[0]?.name || 'General';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-10 font-sans"
      style={{ background: 'var(--bg)' }}
    >
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-white/10 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border ${error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-400'}`} />
              <span className="text-[11px] font-medium tracking-[0.06em] uppercase">{error ? 'Reconnecting...' : 'System Live'}</span>
            </div>
            {lastUpdated && !error && (
              <span className="text-xs text-white/30 font-medium font-mono">
                Synced {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-white mb-1">
            Command <span className="text-white/50">center</span>
          </h1>
          <p className="text-sm text-white/50 leading-relaxed">
            Live incoming bugs, AI severity, and the components slowing you down.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => onNavigate('database')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
          >
            <Database size={15} className="text-white/50" /> Explorer
          </button>
          <button
            onClick={() => onNavigate('submit')}
            className="group flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 px-5 py-2.5 rounded-xl text-sm font-bold transition-all "
          >
            <Zap size={15} className="text-black group-hover:scale-110 transition-transform" /> Triage Issue
          </button>
        </div>
      </div>

      {/* ── Stat Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Card 1 — Total Records */}
        <motion.div
          whileInView={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          onClick={() => onNavigate('database', '', null, null)}
          className="border border-white/10 rounded-2xl p-6 relative overflow-hidden group cursor-pointer transition-all duration-300 ease-out hover:border-white/20 hover:-translate-y-1 hover:shadow-xl"
          style={{ background: 'var(--card-bg)' }}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10" style={{ background: 'var(--bg-elevated)' }}>
              <Database size={18} className="text-indigo-400" />
            </div>
            <ExternalLink size={14} className="text-white/20 group-hover:text-indigo-400 transition-colors" />
          </div>
          <div className="text-3xl font-bold text-white tracking-tight mb-1 font-mono">{data.stats.total_db.toLocaleString()}</div>
          <div className="text-xs text-white/40 font-medium uppercase tracking-widest">Total Records</div>
        </motion.div>

        {/* Card 2 — Processed */}
        <motion.div
          whileInView={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          onClick={() => onNavigate('database', '', null, { status: 'RESOLVED' })}
          className="border border-white/10 rounded-2xl p-6 relative overflow-hidden group cursor-pointer transition-all duration-300 ease-out hover:border-white/20 hover:-translate-y-1 hover:shadow-xl"
          style={{ background: 'var(--card-bg)' }}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10" style={{ background: 'var(--bg-elevated)' }}>
              <TrendingUp size={18} className="text-[var(--accent)]" />
            </div>
            <ExternalLink size={14} className="text-white/20 group-hover:text-[var(--accent)] transition-colors" />
          </div>
          <div className="text-3xl font-bold text-white tracking-tight mb-1 font-mono">{data.stats.analyzed.toLocaleString()}</div>
          <div className="text-xs text-white/40 font-medium uppercase tracking-widest">Processed</div>
        </motion.div>

        {/* Card 3 — Critical Open */}
        <motion.div
          whileInView={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          onClick={() => onNavigate('database', '', null, { sev: 'S1' })}
          className="border border-red-500/20 rounded-2xl p-6 relative overflow-hidden group cursor-pointer transition-all duration-300 ease-out hover:border-red-500/30 hover:shadow-[0_12px_40px_rgba(239,68,68,0.12)] hover:-translate-y-1 bg-red-500/[0.03]"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-red-500/20 bg-red-500/10">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <ExternalLink size={14} className="text-red-400/30 group-hover:text-red-400 transition-colors" />
          </div>
          <div className="text-3xl font-bold text-red-500 tracking-tight mb-1 font-mono">{(data.stats.critical ?? 0).toLocaleString()}</div>
          <div className="text-xs text-red-400/60 font-medium uppercase tracking-widest">Critical Open</div>
        </motion.div>
      </div>

      {/* ── Live Feed + Chart ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Live Feed — wider column */}
        <motion.div
          whileInView={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          className="lg:col-span-3 border border-white/10 rounded-2xl flex flex-col overflow-hidden"
          style={{ background: 'var(--card-bg)' }}
        >
          <div className="p-5 border-b border-white/10 flex justify-between items-center rounded-t-2xl" style={{ background: 'var(--bg-elevated)' }}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-white flex items-center gap-2 tracking-wide">
                <Activity size={15} className="text-white/40" /> LIVE TRIAGE FEED
              </span>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-red-500' : 'bg-[var(--accent)]'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${error ? 'bg-red-500' : 'bg-[var(--accent)]'}`} />
              </span>
            </div>
            <button
              onClick={() => onNavigate('database', '')}
              className="text-xs font-bold text-white/30 hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1"
            >
              View All <ArrowRight size={12} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-4 px-2 min-h-[340px] custom-scrollbar">
            {(data.recent || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm font-medium">
                <Database size={32} className="mb-4 opacity-20" />
                No recent reports
              </div>
            ) : (data.recent || []).map((bug, i) => <LiveFeedRow key={i} bug={bug} />)}
          </div>
        </motion.div>

        {/* Chart — narrower column */}
        <motion.div
          whileInView={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          className="lg:col-span-2 border border-white/10 rounded-2xl p-6 flex flex-col"
          style={{ background: 'var(--card-bg)' }}
        >
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm font-bold text-white flex items-center gap-2 tracking-wide uppercase">
              <LayoutTemplate size={15} className="text-indigo-400/60" /> Vulnerability Hotspots
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/30 border border-white/10 px-2 py-1 rounded-md" style={{ background: 'var(--bg-elevated)' }}>By Volume</span>
          </div>
          {data.charts?.components?.length > 0 ? (
            <div className="flex-1 flex flex-col">
              <div className="flex-1" style={{ minHeight: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.components} layout="vertical" margin={{ top: 8, right: 48, left: 8, bottom: 28 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.05)'} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.55)' }}
                      axisLine={false} tickLine={false}
                      label={{ value: 'Open issues', position: 'insideBottom', offset: -16, fill: isLight ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em' }}
                    />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fill: isLight ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.6)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ borderRadius: '16px', border: `1px solid ${isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)'}`, background: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(10,10,10,0.95)', color: isLight ? '#0f172a' : '#fff', fontSize: '13px', boxShadow: isLight ? '0 20px 40px rgba(0,0,0,0.12)' : '0 20px 40px rgba(0,0,0,0.5)', padding: '12px 16px' }}
                      itemStyle={{ color: isLight ? '#0f172a' : '#fff', fontWeight: 700 }}
                      formatter={(v) => [v, 'Issues Open']}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                      {data.charts.components.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? HOTSPOT_AMBER : HOTSPOT_BLUE} fillOpacity={i === 0 ? 1 : 0.55} />
                      ))}
                      <LabelList dataKey="value" position="right" fill={isLight ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.75)'} fontSize={11} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {topComponent !== 'General' && (
                <p className="text-xs text-white/40 pt-4 pb-1 leading-relaxed text-center border-t border-white/10 mt-4 flex-shrink-0">
                  <strong className="text-white">{topComponent}</strong> currently holds the highest density of unresolved anomalies.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col flex-1 items-center justify-center min-h-[280px] text-white/30 text-sm font-medium">
              <ShieldCheck size={32} className="mb-4 opacity-20" />
              System clear — no data yet.
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
