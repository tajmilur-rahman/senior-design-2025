import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Building2, Globe, Save, CheckCircle, AlertTriangle,
  RefreshCw, KeyRound, Users, Bug, MessageSquare, ShieldCheck, Crown, TrendingUp
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
    <div className="page-content fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <RefreshCw size={20} className="spin" color="var(--text-sec)" />
    </div>
  );

  const totalBugs     = companies.reduce((s, c) => s + (c.total    || 0), 0);
  const totalCritical = companies.reduce((s, c) => s + (c.critical || 0), 0);
  const totalResolved = companies.reduce((s, c) => s + (c.resolved || 0), 0);
  const totalUsers    = companies.reduce((s, c) => s + (c.users    || 0), 0);

  return (
    <div className="page-content fade-in" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <Crown size={22} color="#f59e0b" /> System Overview
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: 0 }}>
          Aggregate statistics across all {companies.length} registered companies.
        </p>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Bugs',     value: totalBugs,     icon: <Bug size={16} color="var(--accent)" /> },
          { label: 'Critical',       value: totalCritical, icon: <AlertTriangle size={16} color="#ef4444" /> },
          { label: 'Resolved',       value: totalResolved, icon: <TrendingUp size={16} color="#10b981" /> },
          { label: 'Team Members',   value: totalUsers,    icon: <Users size={16} color="#6366f1" /> },
        ].map(s => (
          <div key={s.label} className="sys-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {s.icon}
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="sys-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 }}>
          Companies ({companies.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {companies.map(co => (
            <div key={co.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--hover-bg)', borderRadius: 8 }}>
              <Building2 size={15} color="var(--text-sec)" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', flex: 1 }}>{co.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-sec)' }}>{(co.total || 0).toLocaleString()} bugs</span>
              <span style={{ fontSize: 12, color: '#6366f1' }}>{co.users || 0} users</span>
              {co.critical > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                  {co.critical} critical
                </span>
              )}
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
    <div className="page-content fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <RefreshCw size={20} className="spin" color="var(--text-sec)" />
    </div>
  );

  return (
    <div className="page-content fade-in" style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <Building2 size={22} color="var(--accent)" /> Company Information
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: 0 }}>{profile?.name} — manage your company profile and view statistics.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Bugs',     value: profile?.stats?.total_bugs     || 0, icon: <Bug size={16} color="var(--accent)" /> },
          { label: 'Team Members',   value: profile?.stats?.total_users    || 0, icon: <Users size={16} color="#6366f1" /> },
          { label: 'Feedback Items', value: profile?.stats?.total_feedback || 0, icon: <MessageSquare size={16} color="#10b981" /> },
        ].map(s => (
          <div key={s.label} className="sys-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {s.icon}
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="sys-card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <KeyRound size={15} color="var(--accent)" />
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)' }}>Invite Code</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-sec)' }}>Share with new team members</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, letterSpacing: 4, color: 'var(--accent)', padding: '10px 16px', background: 'var(--hover-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
          {profile?.invite_code || '—'}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-sec)' }}>Go to Admin Panel → Invite Code to rotate this code.</p>
      </div>

      <div className="sys-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 18 }}>Edit Profile</div>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 6 }}>Company Description</label>
            <textarea className="sys-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief description of your organisation…" rows={3} maxLength={300} style={{ fontSize: 13, resize: 'vertical', lineHeight: 1.6 }} />
            <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 4, textAlign: 'right' }}>{description.length}/300</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 6 }}>
              <Globe size={12} style={{ marginRight: 5, opacity: 0.7 }} />Website
            </label>
            <div style={{ position: 'relative' }}>
              <Globe size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }} />
              <input className="sys-input" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourcompany.com" type="url" style={{ paddingLeft: 36, fontSize: 13 }} />
            </div>
          </div>
          {msg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13, color: msg.type === 'error' ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
              {msg.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
              {msg.text}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="submit" disabled={saving} className="sys-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: saving ? 0.6 : 1 }}>
              <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: profile?.has_own_model ? 'var(--success)' : '#f59e0b', fontWeight: 700 }}>
                <ShieldCheck size={14} />
                {profile?.has_own_model ? 'Company model active' : 'Global model (shared)'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-sec)', textAlign: 'right', maxWidth: 200 }}>
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
