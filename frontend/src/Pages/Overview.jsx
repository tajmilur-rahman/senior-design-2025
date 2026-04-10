import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Database, Activity, AlertTriangle, ExternalLink, RefreshCw,
  TrendingUp, ShieldCheck, Zap, ArrowRight, LayoutTemplate,
  Building2, Globe, Users, Crown, Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function LiveFeedRow({ bug }) {
  const isCritical = bug.severity === 'S1';
  const badgeColors = {
    S1: 'bg-red-500/10 text-red-400 border-red-500/20',
    S2: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    S3: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    S4: 'bg-white/5 text-white/50 border-white/10'
  }[bug.severity] || 'bg-white/5 text-white/50 border-white/10';

  return (
    <div className="group flex items-center gap-4 px-4 py-3 mx-2 my-1 rounded-2xl hover:bg-white/[0.04] transition-all cursor-pointer border border-transparent hover:border-white/5">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isCritical ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-white/20'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[10px] text-white/30 font-bold tracking-wider group-hover:text-white/50 transition-colors">#{bug.id}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${badgeColors}`}>{bug.severity || 'S3'}</span>
        </div>
        <div className="text-sm text-white/80 truncate font-medium group-hover:text-white transition-colors">{bug.summary}</div>
      </div>
      <div className="text-[10px] font-bold text-white/20 group-hover:text-white/60 transition-colors uppercase tracking-widest flex items-center gap-1 flex-shrink-0">
        {bug.status || 'NEW'} <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

// ── Global Overview for super_admin / developer ───────────────────────────────
function GlobalOverview({ user, onNavigate, data, error, lastUpdated, onRefresh }) {
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
    <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-500">
              <Crown size={12} />
              <span className="text-[10px] font-bold tracking-widest uppercase">Global Overview</span>
            </div>
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border ${error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'}`} />
              <span className="text-[10px] font-bold tracking-widest uppercase">{error ? 'Reconnecting…' : 'All Systems Live'}</span>
            </div>
            {lastUpdated && !error && (
              <span className="text-xs text-white/30 font-medium font-mono">
                Synced {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Global <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Command</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            Cross-organization telemetry — aggregate analytics and real-time health across all registered companies.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
          <button onClick={() => { onRefresh(); fetchGlobal(); }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">
            <RefreshCw size={14} className={loadingCo ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => onNavigate('database')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all">
            <Database size={16} className="text-white/50" /> Explorer
          </button>
          <button onClick={() => onNavigate('submit')}
            className="group flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)]">
            <Zap size={16} className="text-black" /> Triage Issue
          </button>
        </div>
        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-amber-500/20 via-white/5 to-transparent" />
      </div>

      {/* Pending approvals banner */}
      {pending.length > 0 && (
        <div className="mb-8 flex items-center gap-4 p-4 bg-amber-500/[0.06] border border-amber-500/30 rounded-2xl animate-in fade-in">
          <Clock size={16} className="text-amber-500 flex-shrink-0" />
          <span className="text-sm font-bold text-amber-400">
            {pending.length} user{pending.length !== 1 ? 's' : ''} awaiting approval
          </span>
          <button onClick={() => onNavigate('superadmin')}
            className="ml-auto text-xs font-bold text-amber-500 hover:text-amber-300 transition-colors uppercase tracking-widest flex items-center gap-1">
            Review <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Global stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Records',     value: totalBugs.toLocaleString(),     icon: <Database size={15} className="text-blue-400" />,      color: 'text-white',        nav: () => onNavigate('database') },
          { label: 'Critical Open',     value: totalCritical.toLocaleString(), icon: <AlertTriangle size={15} className="text-red-400" />,   color: 'text-red-400',     nav: () => onNavigate('database', '', null, { sev: 'S1' }) },
          { label: 'Resolved',          value: totalResolved.toLocaleString(), icon: <ShieldCheck size={15} className="text-emerald-400" />, color: 'text-emerald-400', nav: () => onNavigate('database', '', null, { status: 'RESOLVED' }) },
          { label: 'Active Users',      value: totalUsers,                     icon: <Users size={15} className="text-indigo-400" />,        color: 'text-white',        nav: () => onNavigate('superadmin') },
          { label: 'Resolution Rate',   value: resolutionRate + '%',           icon: <TrendingUp size={15} className="text-amber-400" />,    color: 'text-amber-400',   nav: null },
        ].map(s => (
          <div key={s.label}
            onClick={s.nav || undefined}
            className={`bg-white/[0.02] border border-white/10 rounded-2xl p-5 relative overflow-hidden group transition-colors ${s.nav ? 'cursor-pointer hover:bg-white/[0.05] hover:border-white/20' : ''}`}>
            <div className="flex items-center gap-2 mb-3">{s.icon}<span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{s.label}</span></div>
            <div className={`text-2xl font-bold font-mono tracking-tight ${s.color}`}>{s.value}</div>
            {s.nav && <ExternalLink size={12} className="absolute top-4 right-4 text-white/20 group-hover:text-white/50 transition-colors" />}
          </div>
        ))}
      </div>

      {/* Charts + Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Live Feed */}
        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
            <span className="text-sm font-bold text-white flex items-center gap-2 tracking-wide">
              <Activity size={16} className="text-white/40" /> LIVE TRIAGE FEED
            </span>
            <div className="flex items-center gap-3">
              <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'}`} />
              <button onClick={() => onNavigate('database', '')} className="text-xs font-bold text-white/30 hover:text-white transition-colors uppercase tracking-wider">View all &rarr;</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-3 px-2 min-h-[300px] custom-scrollbar">
            {(data?.recent || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm font-medium min-h-[280px]">
                <Database size={32} className="mb-4 opacity-20" />No recent reports
              </div>
            ) : (data?.recent || []).map((bug, i) => <LiveFeedRow key={i} bug={bug} />)}
          </div>
        </div>

        {/* Hotspot chart */}
        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl p-6 lg:p-8 flex flex-col relative">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          <div className="flex justify-between items-center mb-8">
            <span className="text-sm font-bold text-white flex items-center gap-2 tracking-wide uppercase">
              <LayoutTemplate size={16} className="text-blue-400/60" /> Global Vulnerability Hotspots
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 border border-white/10 px-2 py-1 rounded-md">By Volume</span>
          </div>
          {data?.charts?.components?.length > 0 ? (
            <div className="flex-1 flex flex-col">
              <div className="flex-1" style={{ minHeight: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.components} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120}
                      tick={{ fontSize: 12, fill: isLight ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}
                      axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ borderRadius: '16px', border: `1px solid ${isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)'}`, background: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(10,10,10,0.95)', color: isLight ? '#0f172a' : '#fff', fontSize: '13px', boxShadow: isLight ? '0 20px 40px rgba(0,0,0,0.12)' : '0 20px 40px rgba(0,0,0,0.5)', padding: '12px 16px' }}
                      itemStyle={{ color: isLight ? '#0f172a' : '#fff', fontWeight: 700 }}
                      formatter={(v) => [v, 'Issues']}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                      {data.charts.components.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#f59e0b' : isLight ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.12)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {topComponent !== 'General' && (
                <p className="text-xs text-white/40 pt-4 pb-1 leading-relaxed text-center border-t border-white/5 mt-4 flex-shrink-0">
                  <strong className="text-white">{topComponent}</strong> holds the highest density of unresolved anomalies globally.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col flex-1 items-center justify-center min-h-[240px] text-white/30 text-sm font-medium">
              <ShieldCheck size={32} className="mb-4 opacity-20" />System clear — no data yet.
            </div>
          )}
        </div>
      </div>

      {/* Company breakdown table */}
      <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10 bg-black/20 flex items-center gap-3">
          <Globe size={16} className="text-blue-400" />
          <span className="text-xs font-bold text-white uppercase tracking-widest">Registered Organizations</span>
          <span className="ml-auto text-[10px] font-bold text-white/40 uppercase tracking-widest px-2.5 py-1 border border-white/10 rounded">
            {companies.length} org{companies.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                {['Organisation', 'Total Bugs', 'Critical', 'Resolved', 'Users', 'Resolution Rate', ''].map(h => (
                  <th key={h} className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingCo ? (
                <tr><td colSpan={7} className="py-16 text-center">
                  <RefreshCw size={22} className="animate-spin text-white/30 mx-auto" />
                </td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-white/30 text-sm font-medium">No companies found.</td></tr>
              ) : companies.map(co => {
                const rate = co.total > 0 ? ((co.resolved / co.total) * 100).toFixed(1) : '0';
                return (
                  <tr key={co.id} className="border-b border-white/5 transition-colors hover:bg-white/[0.03]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                          <Building2 size={14} className="text-white" />
                        </div>
                        <span className="font-bold text-sm text-white truncate max-w-[160px]">{co.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-white font-mono">{(co.total || 0).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded border border-red-500/20">
                        {co.critical || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-emerald-400 font-bold">{(co.resolved || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-white/50">{co.users || 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: rate + '%' }} />
                        </div>
                        <span className="text-xs font-bold text-white/60 font-mono">{rate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => onNavigate('database')}
                        className="text-[10px] font-bold text-white/30 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1">
                        Explore <ArrowRight size={10} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Standard overview for regular users ──────────────────────────────────────
export default function Overview({ user, onNavigate }) {
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
      <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/20 to-transparent animate-pulse" />
        <RefreshCw size={24} className="animate-spin text-white/50 relative z-10" />
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
      />
    );
  }

  const topComponent = data.charts?.components?.[0]?.name || 'General';

  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border ${error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'}`} />
              <span className="text-[10px] font-bold tracking-widest uppercase">{error ? 'Reconnecting...' : 'System Live'}</span>
            </div>
            {lastUpdated && !error && (
              <span className="text-xs text-white/30 font-medium font-mono">Synced {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Command <span className={isLight ? 'text-slate-400' : 'text-transparent bg-clip-text bg-gradient-to-r from-white/50 to-white/20'}>Center</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            Real-time telemetry on your issue tracking ecosystem. Monitor incoming anomalies, AI severity classifications, and systemic bottlenecks.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
          <button onClick={() => onNavigate('database')} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg">
            <Database size={16} className="text-white/50" /> Explorer
          </button>
          <button onClick={() => onNavigate('submit')} className="group flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)]">
            <Zap size={16} className="text-black group-hover:scale-110 transition-transform" /> Triage Issue
          </button>
        </div>
        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-white/20 via-white/5 to-transparent" />
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div onClick={() => onNavigate('database', '', null, null)} className="relative group bg-white/[0.02] border border-white/10 rounded-[2rem] p-7 overflow-hidden cursor-pointer transition-all hover:bg-white/[0.04] hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div className="flex items-center gap-2 text-white/40">
              <Database size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Total Records</span>
            </div>
            <ExternalLink size={14} className="text-white/20 group-hover:text-blue-400 transition-colors" />
          </div>
          <div className="relative z-10">
            <div className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-2 font-mono">{data.stats.total_db.toLocaleString()}</div>
            <div className="text-sm text-white/40 font-medium">Historical bugs in database</div>
          </div>
        </div>

        <div onClick={() => onNavigate('database', '', null, { status: 'RESOLVED' })} className="relative group bg-white/[0.02] border border-white/10 rounded-[2rem] p-7 overflow-hidden cursor-pointer transition-all hover:bg-white/[0.04] hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div className="flex items-center gap-2 text-white/40">
              <TrendingUp size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Processed</span>
            </div>
            <ExternalLink size={14} className="text-white/20 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div className="relative z-10">
            <div className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-2 font-mono">{data.stats.analyzed.toLocaleString()}</div>
            <div className="text-sm text-white/40 font-medium">Triaged and actioned</div>
          </div>
        </div>

        <div onClick={() => onNavigate('database', '', null, { sev: 'S1' })} className="relative group bg-red-500/[0.03] border border-red-500/20 rounded-[2rem] p-7 overflow-hidden cursor-pointer transition-all hover:bg-red-500/[0.08] hover:border-red-500/30 hover:shadow-[0_8px_30px_rgba(239,68,68,0.15)]">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Critical Open</span>
            </div>
            <ExternalLink size={14} className="text-red-400/40 group-hover:text-red-400 transition-colors" />
          </div>
          <div className="relative z-10">
            <div className="text-3xl md:text-5xl font-bold text-red-500 tracking-tight mb-2 font-mono">{(data.stats.critical ?? 0).toLocaleString()}</div>
            <div className="text-sm text-red-400/60 font-medium">Unresolved S1 priority</div>
          </div>
        </div>
      </div>

      {/* Lower Section (Charts & Feed) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Feed */}
        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
            <span className="text-sm font-bold text-white flex items-center gap-2 tracking-wide">
              <Activity size={16} className="text-white/40" /> LIVE TRIAGE FEED
            </span>
            <div className="flex items-center gap-3">
              <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'}`} />
              <button onClick={() => onNavigate('database', '')} className="text-xs font-bold text-white/30 hover:text-white transition-colors uppercase tracking-wider">View all &rarr;</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-3 px-2 min-h-[340px] custom-scrollbar">
            {(data.recent || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm font-medium">
                <Database size={32} className="mb-4 opacity-20" />
                No recent reports
              </div>
            ) : (data.recent || []).map((bug, i) => <LiveFeedRow key={i} bug={bug} />)}
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl p-6 lg:p-8 flex flex-col relative">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          <div className="flex justify-between items-center mb-10">
            <span className="text-sm font-bold text-white flex items-center gap-2 tracking-wide uppercase">
              <LayoutTemplate size={16} className="text-blue-400/60" /> Vulnerability Hotspots
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 border border-white/10 px-2 py-1 rounded-md">By Volume</span>
          </div>
          {data.charts?.components?.length > 0 ? (
            <div className="flex-1 flex flex-col">
              <div className="flex-1" style={{ minHeight: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.components} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fill: isLight ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.6)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ borderRadius: '16px', border: `1px solid ${isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)'}`, background: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(10,10,10,0.95)', color: isLight ? '#0f172a' : '#fff', fontSize: '13px', boxShadow: isLight ? '0 20px 40px rgba(0,0,0,0.12)' : '0 20px 40px rgba(0,0,0,0.5)', padding: '12px 16px' }}
                      itemStyle={{ color: isLight ? '#0f172a' : '#fff', fontWeight: 700 }}
                      formatter={(v) => [v, 'Issues Open']}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                      {data.charts.components.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#3b82f6' : isLight ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.15)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {topComponent !== 'General' && (
                <p className="text-xs text-white/40 pt-4 pb-1 leading-relaxed text-center border-t border-white/5 mt-4 flex-shrink-0">
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
        </div>
      </div>
    </div>
  );
}
