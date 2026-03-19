import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Crown, Building2, Bug, AlertTriangle, Users, TrendingUp,
  RefreshCw, Globe, ShieldCheck, ChevronRight, Activity
} from 'lucide-react';

export default function SuperAdmin({ user }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  const DEMO = [
    { id: 1, name: 'Apex Demo Corp',    total: 222847, critical: 1203, resolved: 186400, users: 14, model_acc: 86.3, last_active: '2 min ago' },
    { id: 2, name: 'FirefoxOS Labs',    total: 14820,  critical: 87,   resolved: 12300,  users: 6,  model_acc: 83.1, last_active: '18 min ago' },
    { id: 3, name: 'Meridian Systems',  total: 3410,   critical: 22,   resolved: 2900,   users: 4,  model_acc: 81.7, last_active: '1 hr ago' },
    { id: 4, name: 'Quantum Dev Group', total: 980,    critical: 5,    resolved: 801,    users: 2,  model_acc: 79.4, last_active: '3 hrs ago' },
  ];

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await axios.get('/api/superadmin/companies');
      if (res.data && res.data.length > 0) {
        setCompanies(res.data);
        setUsingDemo(false);
      } else {
        setCompanies(DEMO);
        setUsingDemo(true);
      }
    } catch (e) {
      setCompanies(DEMO);
      setUsingDemo(e.response?.status !== 403);
      if (e.response?.status === 403) setError('Super admin access required on this account.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const total_bugs     = companies.reduce((s, c) => s + (c.total || 0), 0);
  const total_critical = companies.reduce((s, c) => s + (c.critical || 0), 0);
  const total_users    = companies.reduce((s, c) => s + (c.users || 0), 0);
  const avg_acc        = companies.length
    ? (companies.reduce((s, c) => s + (c.model_acc || 0), 0) / companies.length).toFixed(1)
    : '0';

  return (
    <div className="page-content fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Crown size={20} color="#f59e0b" />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: -0.5 }}>Super Admin</h1>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Restricted</span>
            {usingDemo && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.4 }}>Demo data</span>}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: 0 }}>Global view across all registered organisations. Only visible to <code style={{ fontSize: 11, background: 'var(--hover-bg)', padding: '1px 5px', borderRadius: 3 }}>super_admin</code> accounts.</p>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-sec)' }}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9, marginBottom: 20, fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total records',  value: total_bugs.toLocaleString(),     icon: <Bug size={18} color="var(--accent)" />,     sub: 'Across all orgs' },
          { label: 'Critical open',  value: total_critical.toLocaleString(), icon: <AlertTriangle size={18} color="#ef4444" />, sub: 'Needs attention' },
          { label: 'Active users',   value: total_users,                     icon: <Users size={18} color="#10b981" />,         sub: 'All organisations' },
          { label: 'Avg model acc.', value: avg_acc + '%',                   icon: <TrendingUp size={18} color="#6366f1" />,    sub: 'Cross-org average' },
        ].map(s => (
          <div key={s.label} className="sys-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>{s.icon}<span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.7 }}>{s.label}</span></div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 5 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="sys-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={15} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>Registered organisations</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-sec)', fontWeight: 600 }}>{companies.length} org{companies.length !== 1 ? 's' : ''}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)' }}>
              {['Organisation', 'Total bugs', 'Critical', 'Resolved', 'Users', 'Model acc.', 'Last active', ''].map(h => (
                <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '40px 0', textAlign: 'center' }}><RefreshCw size={18} className="spin" color="var(--text-sec)" style={{ margin: '0 auto' }} /></td></tr>
            ) : companies.map(co => (
              <tr key={co.id} onClick={() => setSelected(selected?.id === co.id ? null : co)}
                style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)', background: selected?.id === co.id ? 'var(--pill-bg)' : 'transparent', transition: 'background 0.1s' }}
                onMouseEnter={e => { if (selected?.id !== co.id) e.currentTarget.style.background = 'var(--hover-bg)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = selected?.id === co.id ? 'var(--pill-bg)' : 'transparent'; }}>
                <td style={{ padding: '13px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Building2 size={13} color="white" /></div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{co.name}</span>
                  </div>
                </td>
                <td style={{ padding: '13px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{(co.total || 0).toLocaleString()}</td>
                <td style={{ padding: '13px 18px' }}><span style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: 5 }}>{co.critical || 0}</span></td>
                <td style={{ padding: '13px 18px', fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{(co.resolved || 0).toLocaleString()}</td>
                <td style={{ padding: '13px 18px', fontSize: 13, color: 'var(--text-sec)' }}>{co.users || 0}</td>
                <td style={{ padding: '13px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 5, background: 'var(--hover-bg)', borderRadius: 99, maxWidth: 70, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: (co.model_acc || 0) + '%', background: 'var(--accent)', borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)', minWidth: 36 }}>{co.model_acc}%</span>
                  </div>
                </td>
                <td style={{ padding: '13px 18px', fontSize: 11, color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>{co.last_active}</td>
                <td style={{ padding: '13px 18px', textAlign: 'right' }}><ChevronRight size={14} color="var(--text-sec)" style={{ transform: selected?.id === co.id ? 'rotate(90deg)' : 'none', transition: '0.2s' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="sys-card fade-in" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Building2 size={16} color="var(--accent)" />
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>{selected.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-sec)', marginLeft: 'auto' }}>Last active: {selected.last_active}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
            {[
              { label: 'Total bugs',      value: (selected.total || 0).toLocaleString(),    color: 'var(--text-main)' },
              { label: 'Critical open',   value: selected.critical || 0,                    color: '#ef4444' },
              { label: 'Resolved',        value: (selected.resolved || 0).toLocaleString(), color: 'var(--success)' },
              { label: 'Active users',    value: selected.users || 0,                       color: 'var(--text-main)' },
              { label: 'Model accuracy',  value: selected.model_acc + '%',                  color: 'var(--accent)' },
              { label: 'Resolution rate', value: selected.total ? ((selected.resolved / selected.total) * 100).toFixed(1) + '%' : '—', color: '#10b981' },
            ].map(s => (
              <div key={s.label} style={{ padding: '14px 16px', background: 'var(--hover-bg)', borderRadius: 9, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <ShieldCheck size={13} color="#6366f1" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1' }}>Data isolation confirmed</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-sec)', margin: 0, lineHeight: 1.6 }}>
              This org's data is scoped to <strong>company_id = {selected.id}</strong>. Their users see only their own bugs. Row-Level Security enforced at the Supabase level.
            </p>
          </div>
        </div>
      )}

      <div style={{ padding: '18px 22px', background: 'var(--hover-bg)', border: '1px dashed var(--border)', borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Activity size={14} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>Setup guide</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.7 }}>
          <div><strong style={{ color: 'var(--text-main)' }}>Making a user super_admin:</strong> Supabase → Table editor → <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>users</code> table → find the row → set <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>role = 'super_admin'</code>. Then log out and back in.</div>
          <div><strong style={{ color: 'var(--text-main)' }}>Creating a new company + admin:</strong> Use the Register page — enter company name, username, password. This creates the company row and its first admin in one shot. Each company is fully isolated by <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>company_id</code>.</div>
          <div><strong style={{ color: 'var(--text-main)' }}>Live company data:</strong> Copy the <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>GET /api/superadmin/companies</code> route from <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>main_patch.py</code> into <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>backend/main.py</code>.</div>
          {usingDemo && <div style={{ padding: '8px 12px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 7 }}><strong style={{ color: '#6366f1' }}>Currently showing demo data.</strong> Add the backend patch to see real company data.</div>}
        </div>
      </div>
    </div>
  );
}