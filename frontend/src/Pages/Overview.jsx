import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Database, Activity, AlertTriangle, ExternalLink, RefreshCw, TrendingUp, ShieldCheck, Zap, ArrowRight, LayoutTemplate } from 'lucide-react';
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
      <div className="text-[10px] font-bold text-white/20 group-hover:text-white/60 transition-colors uppercase tracking-widest flex items-center gap-1">
        {bug.status || 'NEW'} <ArrowRight size={10} className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
      </div>
    </div>
  );
}

export default function Overview({ user, onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

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
            Command <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/50 to-white/20">Center</span>
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
        {/* Subtle decorative line */}
        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-white/20 via-white/5 to-transparent" />
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div onClick={() => onNavigate('database', '')} className="relative group bg-white/[0.02] border border-white/10 rounded-[2rem] p-7 overflow-hidden cursor-pointer transition-all hover:bg-white/[0.04] hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
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

        <div onClick={() => onNavigate('database', 'Fixed')} className="relative group bg-white/[0.02] border border-white/10 rounded-[2rem] p-7 overflow-hidden cursor-pointer transition-all hover:bg-white/[0.04] hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
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

        <div onClick={() => onNavigate('database', 'S1')} className="relative group bg-red-500/[0.03] border border-red-500/20 rounded-[2rem] p-7 overflow-hidden cursor-pointer transition-all hover:bg-red-500/[0.08] hover:border-red-500/30 hover:shadow-[0_8px_30px_rgba(239,68,68,0.15)]">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Critical Open</span>
            </div>
            <ExternalLink size={14} className="text-red-400/40 group-hover:text-red-400 transition-colors" />
          </div>
          <div className="relative z-10">
            <div className="text-3xl md:text-5xl font-bold text-red-500 tracking-tight mb-2 font-mono">{data.stats.critical}</div>
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
            <div className="flex-1 min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.components} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(16px)', color: '#fff', fontSize: '13px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', padding: '12px 16px' }}
                    itemStyle={{ color: '#fff', fontWeight: 700 }}
                    formatter={(v) => [v, 'Issues Open']}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                    {data.charts.components.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#3b82f6' : 'rgba(255,255,255,0.15)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {topComponent !== 'General' && (
                <p className="text-xs text-white/40 mt-6 leading-relaxed text-center">
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
