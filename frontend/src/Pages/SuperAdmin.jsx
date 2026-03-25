import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Crown, Building2, Bug, AlertTriangle, Users, TrendingUp,
  RefreshCw, Globe, ShieldCheck, ChevronRight, Clock, CheckCircle, XCircle,
  UserPlus, X
} from 'lucide-react';

const BLANK_USER = { email: '', username: '', role: 'user', company_id: '' };

export default function SuperAdmin({ user }) {
  const [companies,    setCompanies]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [usingDemo,    setUsingDemo]    = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [error,        setError]        = useState(null);
  const [pending,      setPending]      = useState([]);
  const [actionMsg,    setActionMsg]    = useState('');
  const [showCreate,   setShowCreate]   = useState(false);
  const [createForm,   setCreateForm]   = useState(BLANK_USER);
  const [creating,     setCreating]     = useState(false);
  const [createMsg,    setCreateMsg]    = useState(null);

  const DEMO = [
    { id: 1, name: 'Apex Demo Corp',    total: 222847, critical: 1203, resolved: 186400, users: 14, model_acc: 86.3, last_active: '2 min ago' },
    { id: 2, name: 'FirefoxOS Labs',    total: 14820,  critical: 87,   resolved: 12300,  users: 6,  model_acc: 83.1, last_active: '18 min ago' },
    { id: 3, name: 'Meridian Systems',  total: 3410,   critical: 22,   resolved: 2900,   users: 4,  model_acc: 81.7, last_active: '1 hr ago' },
    { id: 4, name: 'Quantum Dev Group', total: 980,    critical: 5,    resolved: 801,    users: 2,  model_acc: 79.4, last_active: '3 hrs ago' },
  ];

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [companiesRes, pendingRes] = await Promise.all([
        axios.get('/api/superadmin/companies'),
        axios.get('/api/superadmin/pending'),
      ]);
      if (companiesRes.data && companiesRes.data.length > 0) {
        setCompanies(companiesRes.data);
        setUsingDemo(false);
      } else {
        setCompanies(DEMO);
        setUsingDemo(true);
      }
      setPending(pendingRes.data || []);
    } catch (e) {
      setCompanies(DEMO);
      setUsingDemo(e.response?.status !== 403);
      if (e.response?.status === 403) setError('Super admin access required on this account.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (uuid, username) => {
    try {
      await axios.patch(`/api/superadmin/users/${uuid}/approve`);
      setActionMsg(`✓ ${username} approved.`);
      setPending(p => p.filter(u => u.uuid !== uuid));
      setTimeout(() => setActionMsg(''), 4000);
    } catch (e) {
      setActionMsg('Approval failed. Try again.');
    }
  };

  const handleReject = async (uuid, username) => {
    if (!window.confirm(`Reject ${username}? They will be marked inactive.`)) return;
    try {
      await axios.patch(`/api/superadmin/users/${uuid}/reject`);
      setActionMsg(`${username} rejected.`);
      setPending(p => p.filter(u => u.uuid !== uuid));
      setTimeout(() => setActionMsg(''), 4000);
    } catch (e) {
      setActionMsg('Rejection failed. Try again.');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!createForm.company_id) { setCreateMsg({ type: 'error', text: 'Please select a company.' }); return; }
    setCreating(true); setCreateMsg(null);
    try {
      const res = await axios.post('/api/superadmin/users/create', {
        email:      createForm.email,
        username:   createForm.username,
        role:       createForm.role,
        company_id: Number(createForm.company_id),
      });
      setCreateMsg({ type: 'success', text: res.data.message });
      setCreateForm(BLANK_USER);
      setTimeout(() => { setShowCreate(false); setCreateMsg(null); load(); }, 2500);
    } catch (err) {
      setCreateMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to create user.' });
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => { load(); }, []);

  const total_bugs     = companies.reduce((s, c) => s + (c.total    || 0), 0);
  const total_critical = companies.reduce((s, c) => s + (c.critical || 0), 0);
  const total_users    = companies.reduce((s, c) => s + (c.users    || 0), 0);
  const avg_acc        = companies.length
    ? (companies.reduce((s, c) => s + (c.model_acc || 0), 0) / companies.length).toFixed(1)
    : '0';

  return (
    <div className="page-content fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Crown size={20} color="#f59e0b" />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: -0.5 }}>
              Super Admin
            </h1>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Restricted
            </span>
            {usingDemo && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Demo data
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: 0 }}>
            Global view across all registered organisations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setShowCreate(true); setCreateMsg(null); setCreateForm(BLANK_USER); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'white' }}
          >
            <UserPlus size={13} /> Create User
          </button>
          <button
            onClick={load}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-sec)' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9, marginBottom: 20, fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total records',  value: total_bugs.toLocaleString(),     icon: <Bug size={18} color="var(--accent)" />,     sub: 'Across all orgs' },
          { label: 'Critical open',  value: total_critical.toLocaleString(), icon: <AlertTriangle size={18} color="#ef4444" />, sub: 'Needs attention' },
          { label: 'Active users',   value: total_users,                     icon: <Users size={18} color="#10b981" />,         sub: 'All organisations' },
          { label: 'Avg model acc.', value: avg_acc + '%',                   icon: <TrendingUp size={18} color="#6366f1" />,    sub: 'Cross-org average' },
        ].map(s => (
          <div key={s.label} className="sys-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {s.icon}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.7 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 5 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {(pending.length > 0 || actionMsg) && (
        <div className="sys-card fade-in" style={{ padding: 0, overflow: 'hidden', marginBottom: 24, border: '1px solid rgba(245,158,11,0.3)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(245,158,11,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={15} color="#f59e0b" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>Pending Approvals</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
              {pending.length} awaiting review
            </span>
          </div>
          {actionMsg && (
            <div style={{ padding: '10px 20px', fontSize: 13, color: 'var(--success)', fontWeight: 600, background: 'rgba(16,185,129,0.06)', borderBottom: '1px solid var(--border)' }}>
              {actionMsg}
            </div>
          )}
          {pending.length === 0 && actionMsg ? null : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)' }}>
                  {['User', 'Email', 'Role', 'Company', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map(u => (
                  <tr key={u.uuid} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 18px', fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{u.username}</td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--text-sec)' }}>{u.email}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                        background: u.role === 'admin' ? 'rgba(99,102,241,0.1)' : 'var(--pill-bg)',
                        color: u.role === 'admin' ? '#6366f1' : 'var(--accent)', textTransform: 'uppercase' }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--text-sec)' }}>{u.company_name || '—'}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleApprove(u.uuid, u.username)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.08)', color: 'var(--success)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                          <CheckCircle size={12} /> Approve
                        </button>
                        <button onClick={() => handleReject(u.uuid, u.username)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="sys-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={15} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>Registered organisations</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-sec)', fontWeight: 600 }}>
            {companies.length} org{companies.length !== 1 ? 's' : ''}
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)' }}>
              {['Organisation', 'Total bugs', 'Critical', 'Resolved', 'Users', 'Model acc.', 'Last active', ''].map(h => (
                <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px 0', textAlign: 'center' }}>
                  <RefreshCw size={18} className="spin" color="var(--text-sec)" style={{ margin: '0 auto' }} />
                </td>
              </tr>
            ) : companies.map(co => (
              <tr
                key={co.id}
                onClick={() => setSelected(selected?.id === co.id ? null : co)}
                style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)', background: selected?.id === co.id ? 'var(--pill-bg)' : 'transparent', transition: 'background 0.1s' }}
                onMouseEnter={e => { if (selected?.id !== co.id) e.currentTarget.style.background = 'var(--hover-bg)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = selected?.id === co.id ? 'var(--pill-bg)' : 'transparent'; }}
              >
                <td style={{ padding: '13px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Building2 size={13} color="white" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{co.name}</span>
                  </div>
                </td>
                <td style={{ padding: '13px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                  {(co.total || 0).toLocaleString()}
                </td>
                <td style={{ padding: '13px 18px' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: 5 }}>
                    {co.critical || 0}
                  </span>
                </td>
                <td style={{ padding: '13px 18px', fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                  {(co.resolved || 0).toLocaleString()}
                </td>
                <td style={{ padding: '13px 18px', fontSize: 13, color: 'var(--text-sec)' }}>{co.users || 0}</td>
                <td style={{ padding: '13px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 5, background: 'var(--hover-bg)', borderRadius: 99, maxWidth: 70, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: (co.model_acc || 0) + '%', background: 'var(--accent)', borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)', minWidth: 36 }}>
                      {co.model_acc}%
                    </span>
                  </div>
                </td>
                <td style={{ padding: '13px 18px', fontSize: 11, color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>
                  {co.last_active}
                </td>
                <td style={{ padding: '13px 18px', textAlign: 'right' }}>
                  <ChevronRight size={14} color="var(--text-sec)" style={{ transform: selected?.id === co.id ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="sys-card fade-in" style={{ width: '100%', maxWidth: 440, padding: 28, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <UserPlus size={17} color="var(--accent)" />
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>Create User</span>
              <button onClick={() => setShowCreate(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              {[
                { label: 'Email', key: 'email', type: 'email', placeholder: 'user@company.com' },
                { label: 'Display Name', key: 'username', type: 'text', placeholder: 'Jane Smith' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 6 }}>{f.label}</label>
                  <input className="sys-input" type={f.type} required placeholder={f.placeholder}
                    value={createForm[f.key]}
                    onChange={e => setCreateForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ fontSize: 13 }} />
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 6 }}>Role</label>
                <select className="sys-input" value={createForm.role}
                  onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))}
                  style={{ fontSize: 13, height: 40, cursor: 'pointer' }}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 6 }}>Company</label>
                <select className="sys-input" value={createForm.company_id} required
                  onChange={e => setCreateForm(p => ({ ...p, company_id: e.target.value }))}
                  style={{ fontSize: 13, height: 40, cursor: 'pointer' }}>
                  <option value="" disabled>Select a company…</option>
                  {companies.filter(c => c.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {createMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, fontSize: 13,
                  color: createMsg.type === 'error' ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                  {createMsg.type === 'error' ? <AlertTriangle size={13} /> : <CheckCircle size={13} />}
                  {createMsg.text}
                </div>
              )}
              <button type="submit" disabled={creating} className="sys-btn"
                style={{ width: '100%', justifyContent: 'center', opacity: creating ? 0.6 : 1 }}>
                {creating ? <><RefreshCw size={13} className="spin" /> Creating…</> : <><UserPlus size={13} /> Create & Send Invite</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="sys-card fade-in" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Building2 size={16} color="var(--accent)" />
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>{selected.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-sec)', marginLeft: 'auto' }}>Last active: {selected.last_active}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
            {[
              { label: 'Total bugs',      value: (selected.total    || 0).toLocaleString(), color: 'var(--text-main)' },
              { label: 'Critical open',   value: selected.critical  || 0,                   color: '#ef4444' },
              { label: 'Resolved',        value: (selected.resolved || 0).toLocaleString(), color: 'var(--success)' },
              { label: 'Active users',    value: selected.users     || 0,                   color: 'var(--text-main)' },
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
    </div>
  );
}
