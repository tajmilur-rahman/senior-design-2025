import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Building2, Globe, Save, CheckCircle, AlertTriangle,
  RefreshCw, Users, Bug, MessageSquare, ShieldCheck, Crown, TrendingUp,
  BrainCircuit, Database, Layers, Activity, Zap, Clock, BarChart2, Lock, Key
} from 'lucide-react';
import { motion } from 'framer-motion';

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
      <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 relative overflow-hidden">
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
    S3: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    S4: 'bg-white/5 text-white/50 border-white/10',
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-400 w-max mb-4">
            <Crown size={12} className="text-amber-500" />
            <span className="text-[10px] font-bold tracking-widest uppercase">System Intelligence</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Platform <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">overview</span>
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
          { label: 'Total Bugs',      value: totalBugs,     icon: <Bug size={16} className="text-blue-400" />,      color: 'blue' },
          { label: 'Critical Open',   value: totalCritical, icon: <AlertTriangle size={16} className="text-red-400" />, color: 'red' },
          { label: 'Triaged',         value: totalResolved, icon: <TrendingUp size={16} className="text-emerald-400" />, color: 'emerald' },
          { label: 'Platform Users',  value: totalUsers,    icon: <Users size={16} className="text-indigo-400" />,   color: 'indigo' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.02] border border-white/10 rounded-3xl p-5 lg:p-6 backdrop-blur-md shadow-2xl relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-2 mb-4 relative z-10">
              {s.icon}
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{s.label}</span>
            </div>
            <div className="text-3xl font-bold text-white font-mono tracking-tight relative z-10">{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5 mb-8">
        {[
          { label: 'Organizations',   value: companies.length, icon: <Building2 size={14} className="text-purple-400" /> },
          { label: 'Pending Approval',value: pendingOrgs,      icon: <Clock size={14} className="text-amber-400" />,      alert: pendingOrgs > 0 },
          { label: 'Models Trained',  value: modelsActive,     icon: <BrainCircuit size={14} className="text-emerald-400" /> },
          { label: 'Feedback Items',  value: totalFeedback,    icon: <MessageSquare size={14} className="text-blue-400" /> },
        ].map(s => (
          <div key={s.label} className={`bg-white/[0.02] border rounded-2xl p-4 relative overflow-hidden ${s.alert ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10'}`}>
            <div className="flex items-center gap-2 mb-2">
              {s.icon}
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{s.label}</span>
            </div>
            <div className="text-2xl font-bold text-white font-mono">{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Two-column: hotspots + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Vulnerability hotspots */}
        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md">
          <div className="text-xs font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <BarChart2 size={14} className="text-blue-400" /> Vulnerability Hotspots
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
        </div>

        {/* Recent system activity */}
        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md">
          <div className="text-xs font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <Activity size={14} className="text-emerald-400" /> Recent System Activity
          </div>
          {recentBugs.length === 0 ? (
            <div className="text-white/30 text-sm py-8 text-center">No recent activity</div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentBugs.slice(0, 6).map((bug, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono flex-shrink-0 ${SEV_COLORS[bug.severity] || SEV_COLORS.S4}`}>
                    {bug.severity || 'S3'}
                  </span>
                  <span className="flex-1 text-xs text-white/60 truncate">{bug.summary}</span>
                  <span className="text-[10px] text-white/30 flex-shrink-0">{bug.status || 'NEW'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Per-company breakdown */}
      <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
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
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${co.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                      {co.status || 'active'}
                    </span>
                    {co.has_own_model && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-400">Model</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-5 text-xs text-white/50">
                <div className="text-center">
                  <div className="font-bold text-white text-sm">{(co.total || 0).toLocaleString()}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/30">Bugs</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-white text-sm">{co.users || 0}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/30">Users</div>
                </div>
                <div className="text-center">
                  <div className={`font-bold text-sm ${co.critical > 0 ? 'text-red-400' : 'text-white'}`}>{co.critical || 0}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/30">Critical</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-white text-sm">{co.resolved || 0}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/30">Resolved</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
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
      <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent animate-pulse" />
        <RefreshCw size={24} className="animate-spin text-white/50 relative z-10" />
      </div>
      <div className="text-white font-bold text-xl tracking-tight">Loading Context</div>
    </div>
  );

  const totalBugs     = profile?.stats?.total_bugs     || 0;
  const totalUsers    = profile?.stats?.total_users    || 0;
  const totalFeedback = profile?.stats?.total_feedback || 0;
  const hasOwnModel   = profile?.has_own_model;
  const inviteCode    = profile?.invite_code;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-5xl mx-auto p-6 lg:px-8 lg:py-12 font-sans relative z-10"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-indigo-500/10 border-indigo-500/20 text-indigo-400 w-max mb-4">
            <Building2 size={12} className="text-indigo-500" />
            <span className="text-[10px] font-bold tracking-widest uppercase">Workspace Info</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Company <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">profile</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            {profile?.name} — Manage your organizational details and review all company intelligence.
          </p>
        </div>
        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-indigo-500/20 via-white/5 to-transparent" />
      </div>

      {/* Macro stats */}
      <div className="grid grid-cols-3 gap-4 lg:gap-5 mb-6">
        {[
          { label: 'Total Bugs',     value: totalBugs,     icon: <Bug size={16} className="text-blue-400" /> },
          { label: 'Team Members',   value: totalUsers,    icon: <Users size={16} className="text-indigo-400" /> },
          { label: 'Feedback Items', value: totalFeedback, icon: <MessageSquare size={16} className="text-emerald-400" /> },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.02] border border-white/10 rounded-3xl p-5 lg:p-6 backdrop-blur-md shadow-2xl relative overflow-hidden group transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 mb-4 relative z-10">{s.icon}<span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{s.label}</span></div>
            <div className="text-3xl font-bold text-white font-mono tracking-tight relative z-10">{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* ML Model status — prominent */}
      <div className={`mb-6 p-5 rounded-[1.5rem] border-2 relative overflow-hidden ${hasOwnModel ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-blue-500/30 bg-blue-500/5'}`}>
        <div className="flex items-center gap-4 relative z-10">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 ${hasOwnModel ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-blue-500/20 border-blue-500/30'}`}>
            <BrainCircuit size={20} className={hasOwnModel ? 'text-emerald-400' : 'text-blue-400'} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-white text-base mb-0.5">
              {hasOwnModel ? 'Company Model Active' : 'Global Model (Shared)'}
            </div>
            <div className="text-sm text-white/50 leading-relaxed">
              {hasOwnModel
                ? 'Your company has a custom RF model trained on your own bug data and feedback corrections. Predictions are optimized for your patterns.'
                : 'Using the universal RF model trained on 220,000+ bugs. Submit corrections or bulk-upload to train your own isolated model.'}
            </div>
          </div>
          <div className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${hasOwnModel ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-blue-500/20 border-blue-500/30 text-blue-400'}`}>
            {hasOwnModel ? 'Isolated' : 'Universal'}
          </div>
        </div>
      </div>

      {/* Access & Configuration */}
      <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden mb-6">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
        <div className="text-xs font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
          <Key size={14} className="text-amber-400" /> Access & Configuration
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1.5">Invite Code</div>
            <div className="font-mono text-sm font-bold text-white tracking-widest">{inviteCode || '—'}</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1.5">Company Status</div>
            <div className={`inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest ${profile?.status === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${profile?.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {profile?.status || 'active'}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1.5">Data Isolation</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Lock size={13} className="text-indigo-400" />
              {profile?.data_table && profile.data_table !== 'bugs' ? 'Dedicated table' : 'Shared table'}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1.5">Registered Since</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={13} className="text-white/40" />
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile */}
      <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <div className="text-xs font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
          <Save size={14} className="text-blue-400" /> Edit Profile
        </div>
        <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-2xl">
          <div>
            <label className="block text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2">Website</label>
            <div className="relative">
              <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all text-sm" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourcompany.com" type="url" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2">Company Description</label>
            <textarea className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all text-sm resize-y min-h-[100px]" value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief description of your organisation…" maxLength={300} />
            <div className="text-[10px] text-white/40 mt-1 text-right font-mono">{description.length}/300</div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            {msg ? (
              <div className={`flex items-center gap-2 text-xs font-bold ${msg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                {msg.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />} {msg.text}
              </div>
            ) : <div />}
            <button type="submit" disabled={saving} className="bg-white text-black hover:bg-zinc-200 font-bold px-8 py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto">
              <Save size={16} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
