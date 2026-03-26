import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Building2, Globe, Save, CheckCircle, AlertTriangle,
  RefreshCw, Users, Bug, MessageSquare, ShieldCheck, Crown, TrendingUp
} from 'lucide-react';

// ── Super Admin view: aggregate system panel ─────────────────────────────────
function SystemPanel() {
  const [companies, setCompanies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    axios.get('/api/superadmin/companies')
      .then(r => setCompanies(r.data || []))
      .catch(e => setError(e.response?.data?.detail || 'Failed to load system data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/20 to-transparent animate-pulse" />
        <RefreshCw size={24} className="animate-spin text-white/50 relative z-10" />
      </div>
      <div className="text-white font-bold text-xl tracking-tight">Fetching Telemetry</div>
    </div>
  );

  const totalBugs     = companies.reduce((s, c) => s + (c.total    || 0), 0);
  const totalCritical = companies.reduce((s, c) => s + (c.critical || 0), 0);
  const totalResolved = companies.reduce((s, c) => s + (c.resolved || 0), 0);
  const totalUsers    = companies.reduce((s, c) => s + (c.users    || 0), 0);

  return (
    <div className="w-full max-w-5xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-400 w-max mb-4">
            <Crown size={12} className="text-amber-500" />
            <span className="text-[10px] font-bold tracking-widest uppercase">Global View</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            System <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Overview</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            Aggregate statistics across all {companies.length} registered organizations.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-semibold flex items-center gap-3 mb-6">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 mb-8">
        {[
          { label: 'Total Bugs',     value: totalBugs,     icon: <Bug size={16} className="text-blue-400" /> },
          { label: 'Critical',       value: totalCritical, icon: <AlertTriangle size={16} className="text-red-400" /> },
          { label: 'Resolved',       value: totalResolved, icon: <TrendingUp size={16} className="text-emerald-400" /> },
          { label: 'Team Members',   value: totalUsers,    icon: <Users size={16} className="text-indigo-400" /> },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.02] border border-white/10 rounded-3xl p-5 lg:p-6 backdrop-blur-md shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4 relative z-10">
              {s.icon}
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{s.label}</span>
            </div>
            <div className="text-3xl font-bold text-white font-mono tracking-tight relative z-10">{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
        <div className="text-xs font-bold text-white uppercase tracking-widest mb-6">
          Companies ({companies.length})
        </div>
        <div className="flex flex-col gap-3">
          {companies.map(co => (
            <div key={co.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-black/40 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10">
                  <Building2 size={16} className="text-white/50" />
                </div>
                <span className="font-bold text-sm text-white">{co.name}</span>
              </div>
              <div className="flex items-center gap-6 text-xs text-white/50">
                <span><strong className="text-white">{co.total?.toLocaleString() || 0}</strong> bugs</span>
                <span><strong className="text-white">{co.users || 0}</strong> users</span>
              {co.critical > 0 && (
                <span className="px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 uppercase tracking-widest">
                  {co.critical} critical
                </span>
              )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Admin view: company profile editor ───────────────────────────────────────
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

  return (
    <div className="w-full max-w-5xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-indigo-500/10 border-indigo-500/20 text-indigo-400 w-max mb-4">
            <Building2 size={12} className="text-indigo-500" />
            <span className="text-[10px] font-bold tracking-widest uppercase">Workspace Info</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Company <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Profile</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            {profile?.name} — Manage your organizational details and view macro-level statistics.
          </p>
        </div>
        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-indigo-500/20 via-white/5 to-transparent" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6 mb-8">
        {[
          { label: 'Total Bugs',     value: profile?.stats?.total_bugs     || 0, icon: <Bug size={16} className="text-blue-400" /> },
          { label: 'Team Members',   value: profile?.stats?.total_users    || 0, icon: <Users size={16} className="text-indigo-400" /> },
          { label: 'Feedback Items', value: profile?.stats?.total_feedback || 0, icon: <MessageSquare size={16} className="text-emerald-400" /> },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.02] border border-white/10 rounded-3xl p-5 lg:p-6 backdrop-blur-md shadow-2xl relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex items-center gap-2 mb-4 relative z-10">
              {s.icon}
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{s.label}</span>
            </div>
            <div className="text-3xl font-bold text-white font-mono tracking-tight relative z-10">{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>


      <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
        <div className="text-xs font-bold text-white uppercase tracking-widest mb-6">Edit Profile</div>
        <form onSubmit={handleSave}>
          <div className="mb-6">
            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Company Description</label>
            <textarea className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all text-sm resize-y min-h-[100px]" value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief description of your organisation…" maxLength={300} />
            <div className="text-[10px] text-white/40 mt-2 text-right font-mono">{description.length}/300</div>
          </div>
          <div className="mb-8">
            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Website</label>
            <div className="relative">
              <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all text-sm" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourcompany.com" type="url" />
            </div>
          </div>
          {msg && (
            <div className={`flex items-center gap-2 mb-6 text-xs font-bold ${msg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
              {msg.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />} {msg.text}
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <button type="submit" disabled={saving} className="bg-white text-black hover:bg-zinc-200 font-bold px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={16} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <div className="flex flex-col sm:items-end gap-1">
              <div className={`flex items-center gap-2 text-xs font-bold ${profile?.has_own_model ? 'text-emerald-400' : 'text-amber-500'}`}>
                <ShieldCheck size={14} />
                {profile?.has_own_model ? 'Company model active' : 'Global model (shared)'}
              </div>
              <div className="text-[10px] text-white/40 sm:text-right max-w-[200px] leading-relaxed">
                {profile?.has_own_model
                  ? 'Your company has a custom RF model trained on your own data and feedback corrections.'
                  : 'Your company uses the global RF model. Submit feedback corrections or bulk-upload to train your own.'}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
