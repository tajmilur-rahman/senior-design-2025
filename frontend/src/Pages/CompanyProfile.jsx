import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Building2, Globe, Save, CheckCircle, AlertTriangle,
  RefreshCw, Users, Bug, ShieldCheck, Crown, TrendingUp,
  BrainCircuit, Database, Layers, Activity, Zap, Clock, BarChart2, Lock,
  ShieldAlert, ExternalLink, MessageSquare
} from 'lucide-react';
import { motion } from 'framer-motion';
import { LiquidButton as Button } from '../liquid-glass-button';
import { BentoCard } from '../bento-card';

// ── Super Admin view: reworked system intelligence panel ─────────────────────
function SystemPanel() {
  const [companies, setCompanies] = useState([]);
  const [overview,  setOverview]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    Promise.all([
      axios.get('/api/superadmin/companies'),
      axios.get('/api/hub/overview'),
    ])
      .then(([coRes, ovRes]) => {
        setCompanies(coRes.data || []);
        setOverview(ovRes.data || null);
      })
      .catch(e => setError(e.response?.data?.detail || 'Failed to load system data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-transparent animate-pulse" />
        <RefreshCw size={24} className="animate-spin text-white/50 relative z-10" />
      </div>
      <div className="text-white font-bold text-xl tracking-tight">Loading System Intelligence</div>
    </div>
  );

  const totalBugs     = overview?.stats?.total_db     || 0;
  const totalCritical = overview?.stats?.critical      || 0;
  const totalResolved = overview?.stats?.analyzed      || 0;
  const totalUsers    = companies.reduce((s, c) => s + (c.users || 0), 0);
  const totalFeedback = companies.reduce((s, c) => s + (c.total_feedback || 0), 0);
  const modelsActive  = companies.filter(c => c.has_own_model).length;
  const pendingOrgs   = companies.filter(c => c.status === 'pending').length;

  const hotspots      = overview?.charts?.components || [];
  const recentBugs    = overview?.recent || [];

  const SEV_COLORS = {
    S1: 'bg-red-500/10 text-red-400 border-red-500/20',
    S2: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    S3: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    S4: 'bg-white/5 text-white/50 border-white/10',
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-400 w-max mb-4">
            <Crown size={12} className="text-amber-500" />
            <span className="text-[11px] font-medium tracking-[0.06em] uppercase">System Intelligence</span>
          </div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight mb-3 text-white">
            Platform <span className="text-amber-400">overview</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            Live system health, database telemetry, and ML intelligence across all {companies.length} registered organizations.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-semibold flex items-center gap-3 mb-6">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Platform KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5 mb-6">
        {[
          { label: 'Total Bugs',      value: totalBugs,     icon: <Bug size={16} className="text-indigo-400" />,      color: 'blue' },
          { label: 'Critical Open',   value: totalCritical, icon: <AlertTriangle size={16} className="text-red-400" />, color: 'red' },
          { label: 'Triaged',         value: totalResolved, icon: <TrendingUp size={16} className="text-emerald-400" />, color: 'emerald' },
          { label: 'Platform Users',  value: totalUsers,    icon: <Users size={16} className="text-indigo-400" />,   color: 'indigo' },
        ].map(s => (
          <BentoCard key={s.label} className="p-5 lg:p-6 shadow-2xl hover:!bg-white/[0.04]">
            <div className="flex items-center gap-2 mb-4 relative z-10">
              {s.icon}
              <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">{s.label}</span>
            </div>
            <div className="text-3xl font-bold text-white font-mono tracking-tight relative z-10">{s.value.toLocaleString()}</div>
          </BentoCard>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5 mb-8">
        {[
          { label: 'Organizations',   value: companies.length, icon: <Building2 size={14} className="text-purple-400" /> },
          { label: 'Pending Approval',value: pendingOrgs,      icon: <Clock size={14} className="text-amber-400" />,      alert: pendingOrgs > 0 },
          { label: 'Models Trained',  value: modelsActive,     icon: <BrainCircuit size={14} className="text-emerald-400" /> },
          { label: 'Feedback Items',  value: totalFeedback,    icon: <MessageSquare size={14} className="text-indigo-400" /> },
        ].map(s => (
          <BentoCard key={s.label} className={`p-4 ${s.alert ? '!border-amber-500/30 !bg-amber-500/5' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              {s.icon}
              <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">{s.label}</span>
            </div>
            <div className="text-2xl font-bold text-white font-mono">{s.value.toLocaleString()}</div>
          </BentoCard>
        ))}
      </div>

      {/* Two-column: hotspots + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Vulnerability hotspots */}
        <BentoCard className="p-6 lg:p-8 shadow-2xl">
          <div className="text-xs font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <BarChart2 size={14} className="text-indigo-400" /> Vulnerability Hotspots
          </div>
          {hotspots.length === 0 ? (
            <div className="text-white/30 text-sm py-8 text-center">No hotspot data yet</div>
          ) : (
            <div className="flex flex-col gap-3">
              {hotspots.map((h, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="text-sm font-semibold text-white/70 w-28 truncate">{h.name}</div>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${Math.min(100, (h.value / (hotspots[0]?.value || 1)) * 100)}%` }} />
                  </div>
                  <div className="text-xs font-bold text-white/50 font-mono w-12 text-right">{h.value?.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </BentoCard>

        {/* Recent system activity */}
        <BentoCard className="p-6 lg:p-8 shadow-2xl">
          <div className="text-xs font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <Activity size={14} className="text-emerald-400" /> Recent System Activity
          </div>
          {recentBugs.length === 0 ? (
            <div className="text-white/30 text-sm py-8 text-center">No recent activity</div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentBugs.slice(0, 6).map((bug, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border font-mono flex-shrink-0 ${SEV_COLORS[bug.severity] || SEV_COLORS.S4}`}>
                    {bug.severity || 'S3'}
                  </span>
                  <span className="flex-1 text-xs text-white/60 truncate">{bug.summary}</span>
                  <span className="text-[11px] text-white/30 flex-shrink-0">{bug.status || 'NEW'}</span>
                </div>
              ))}
            </div>
          )}
        </BentoCard>
      </div>

      {/* Per-company breakdown */}
      <BentoCard className="p-6 lg:p-8 shadow-2xl">
        <div className="text-xs font-bold text-white uppercase tracking-widest mb-6">
          Organizations — Full Breakdown ({companies.length})
        </div>
        <div className="flex flex-col gap-3">
          {companies.map(co => (
            <div key={co.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/[0.08] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-black/40 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10">
                  <Building2 size={14} className="text-white/50" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white truncate">{co.name}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full border ${co.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                      {co.status || 'active'}
                    </span>
                    {co.has_own_model && (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">Model</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-5 text-xs text-white/50">
                <div className="text-center">
                  <div className="font-bold text-white text-sm">{(co.total || 0).toLocaleString()}</div>
                  <div className="text-[11px] uppercase tracking-widest text-white/30">Bugs</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-white text-sm">{co.users || 0}</div>
                  <div className="text-[11px] uppercase tracking-widest text-white/30">Users</div>
                </div>
                <div className="text-center">
                  <div className={`font-bold text-sm ${co.critical > 0 ? 'text-red-400' : 'text-white'}`}>{co.critical || 0}</div>
                  <div className="text-[11px] uppercase tracking-widest text-white/30">Critical</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-white text-sm">{co.resolved || 0}</div>
                  <div className="text-[11px] uppercase tracking-widest text-white/30">Resolved</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </BentoCard>
    </div>
  );
}

// ── Admin view: company profile with micro-level detail ──────────────────────
export default function CompanyProfile({ user }) {
  if (user?.role === 'super_admin') return <SystemPanel />;

  const [profile,     setProfile]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [description, setDescription] = useState('');
  const [website,     setWebsite]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/company_profile');
      setProfile(res.data);
      setDescription(res.data.description || '');
      setWebsite(res.data.website || '');
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to load company profile.' });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      await axios.patch('/api/admin/company_profile', { description, website });
      setProfile(prev => ({ ...prev, description, website }));
      setMsg({ type: 'success', text: 'Company profile updated.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Update failed.' });
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent animate-pulse" />
        <RefreshCw size={24} className="animate-spin text-white/50 relative z-10" />
      </div>
      <div className="text-white font-bold text-xl tracking-tight">Loading Context</div>
    </div>
  );

  const totalBugs     = profile?.stats?.total_bugs     || 0;
  const totalUsers    = profile?.stats?.total_users    || 0;
  const totalCritical = profile?.stats?.critical        || 0;
  const totalResolved = profile?.stats?.resolved        || 0;
  const hasOwnModel   = profile?.has_own_model;

  const resolutionRate = totalBugs > 0 ? Math.round((totalResolved / totalBugs) * 100) : null;

  const sevBreakdown = [
    { label: 'S1', count: profile?.stats?.s1 || 0, color: '#f87171', bg: 'bg-red-500/60' },
    { label: 'S2', count: profile?.stats?.s2 || 0, color: '#fbbf24', bg: 'bg-amber-500/60' },
    { label: 'S3', count: profile?.stats?.s3 || 0, color: '#6366f1', bg: 'bg-indigo-500/60' },
    { label: 'S4', count: profile?.stats?.s4 || 0, color: '#94a3b8', bg: 'bg-slate-500/60' },
  ];
  const sevTotal = sevBreakdown.reduce((s, b) => s + b.count, 0);
  const hasSevData = sevTotal > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-5xl mx-auto p-6 lg:px-8 lg:py-10 font-sans relative z-10"
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-indigo-500/10 border-indigo-500/20 text-indigo-400 w-max mb-3">
          <Building2 size={12} />
          <span className="text-[11px] font-medium tracking-[0.06em] uppercase">Workspace</span>
        </div>
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[1.75rem] font-semibold tracking-tight mb-1 text-white">
              {profile?.name || 'Company'} <span className="text-indigo-400">profile</span>
            </h1>
            {profile?.description ? (
              <p className="text-white/50 text-sm max-w-xl leading-relaxed">{profile.description}</p>
            ) : (
              <p className="text-white/30 text-sm italic">No description set — add one below.</p>
            )}
          </div>
          {profile?.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0">
              <ExternalLink size={12} /> Website
            </a>
          )}
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          {
            label: 'Total Bugs', value: totalBugs,
            icon: <Bug size={15} className="text-indigo-400" />,
          },
          {
            label: 'Team Members', value: totalUsers,
            icon: <Users size={15} className="text-indigo-400" />,
          },
          {
            label: 'Critical Open', value: totalCritical,
            icon: <ShieldAlert size={15} className={totalCritical > 0 ? 'text-red-400' : 'text-white/30'} />,
            accent: totalCritical > 0,
          },
          {
            label: 'Resolved', value: totalResolved,
            icon: <CheckCircle size={15} className="text-emerald-400" />,
            sub: resolutionRate !== null ? `${resolutionRate}% rate` : null,
          },
        ].map(s => (
          <BentoCard key={s.label}
            className={`p-4 transition-colors ${s.accent ? '!border-red-500/20 !bg-red-500/5' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              {s.icon}
              <span className="text-[11px] text-white/40 uppercase tracking-[0.06em]">{s.label}</span>
            </div>
            <div className={`text-2xl font-semibold font-mono tracking-tight ${s.accent ? 'text-red-400' : 'text-white'}`}>
              {s.value.toLocaleString()}
            </div>
            {s.sub && <div className="text-[11px] text-white/30 mt-0.5">{s.sub}</div>}
          </BentoCard>
        ))}
      </div>

      {/* Severity distribution strip — only if data exists */}
      {hasSevData && (
        <BentoCard className="p-4 mb-4">
          <div className="text-[11px] text-white/40 uppercase tracking-[0.06em] mb-3">Severity distribution</div>
          <div className="flex gap-1 h-2 rounded-full overflow-hidden mb-3">
            {sevBreakdown.map(s => s.count > 0 && (
              <div key={s.label} className={`${s.bg} rounded-full`}
                style={{ width: `${(s.count / sevTotal) * 100}%` }} />
            ))}
          </div>
          <div className="flex gap-5">
            {sevBreakdown.map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-[11px] font-mono text-white/50">{s.label}</span>
                <span className="text-[11px] font-semibold font-mono text-white/70">{s.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </BentoCard>
      )}

      {/* ML Model status */}
      <BentoCard className={`mb-4 p-4 ${hasOwnModel ? '!border-emerald-500/20 !bg-emerald-500/5' : ''}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${hasOwnModel ? 'bg-emerald-500/15 border-emerald-500/25' : 'bg-white/5 border-white/10'}`}>
            <BrainCircuit size={18} className={hasOwnModel ? 'text-emerald-400' : 'text-white/40'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white text-sm">
              {hasOwnModel ? 'Company model active' : 'Using global model'}
            </div>
            <div className="text-xs text-white/40 mt-0.5 leading-relaxed">
              {hasOwnModel
                ? "Custom RF model trained on your bug history. Predictions are tuned to your team's patterns."
                : 'Shared model trained on 220k+ bugs. Submit feedback corrections to build an isolated model.'}
            </div>
          </div>
          <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-[11px] font-medium uppercase tracking-[0.06em] ${hasOwnModel ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
            {hasOwnModel ? 'Isolated' : 'Universal'}
          </div>
        </div>
      </BentoCard>

      {/* Configuration + Edit Profile — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Configuration */}
        <BentoCard className="p-5">
          <div className="text-[11px] font-medium text-white/40 uppercase tracking-[0.06em] mb-4 flex items-center gap-2">
            <Lock size={12} className="text-white/50" /> Workspace configuration
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
              <div className="text-[11px] text-white/30 uppercase tracking-[0.06em] mb-1">Status</div>
              <div className={`inline-flex items-center gap-1.5 text-sm font-semibold ${profile?.status === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${profile?.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {profile?.status || 'active'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
              <div className="text-[11px] text-white/30 uppercase tracking-[0.06em] mb-1">Data isolation</div>
              <div className="text-sm font-semibold text-white">
                {profile?.data_table && profile.data_table !== 'bugs' ? 'Dedicated table' : 'Shared table'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
              <div className="text-[11px] text-white/30 uppercase tracking-[0.06em] mb-1">Registered</div>
              <div className="text-sm font-semibold text-white">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
              <div className="text-[11px] text-white/30 uppercase tracking-[0.06em] mb-1">Website</div>
              {profile?.website ? (
                <a href={profile.website} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors truncate block">
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              ) : (
                <span className="text-sm text-white/20 italic">Not set</span>
              )}
            </div>
          </div>
        </BentoCard>

        {/* Edit Profile */}
        <BentoCard className="p-5">
          <div className="text-[11px] font-medium text-white/40 uppercase tracking-[0.06em] mb-4 flex items-center gap-2">
            <Save size={12} className="text-white/50" /> Edit profile
          </div>
          <form onSubmit={handleSave} className="flex flex-col gap-3.5">
            <div>
              <label className="block text-[11px] text-white/30 uppercase tracking-[0.06em] mb-1.5">Website</label>
              <div className="relative">
                <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                <input className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-white placeholder:text-white/40 focus:border-indigo-500/40 focus:bg-white/[0.06] outline-none transition-all text-sm" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourcompany.com" type="url" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-white/30 uppercase tracking-[0.06em] mb-1.5">Description</label>
              <textarea className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder:text-white/40 focus:border-indigo-500/40 focus:bg-white/[0.06] outline-none transition-all text-sm resize-none" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief description of your organisation…" maxLength={300} />
              <div className="text-[11px] text-white/20 mt-0.5 text-right font-mono">{description.length}/300</div>
            </div>
            <div className="flex items-center justify-between gap-3 pt-0.5">
              {msg ? (
                <div className={`flex items-center gap-1.5 text-xs font-medium ${msg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                  {msg.type === 'error' ? <AlertTriangle size={13} /> : <CheckCircle size={13} />} {msg.text}
                </div>
              ) : <div />}
              <Button type="submit" disabled={saving} className="font-semibold text-sm px-5 py-2 flex-shrink-0">
                <Save size={13} /> {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </BentoCard>
      </div>
    </motion.div>
  );
}
