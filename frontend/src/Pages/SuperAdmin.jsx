import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Crown, Building2, Bug, AlertTriangle, Users, TrendingUp,
  RefreshCw, Globe, ShieldCheck, ChevronRight, Clock, CheckCircle, XCircle,
  UserPlus, X, Trash2, ArrowUpCircle, ArrowDownCircle, UserMinus, UserCheck,
  Search, Mail
} from 'lucide-react';

const BLANK_USER = { email: '', username: '', role: 'user', company_id: '' };

function RoleBadge({ role }) {
  const map = {
    super_admin: { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Super Admin' },
    admin:       { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', label: 'Admin' },
    user:        { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'User' },
  };
  const s = map[role] || map.user;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${s.bg} ${s.text} ${s.border}`}>
      {role === 'super_admin' && <Crown size={10} />}
      {s.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    active:   { label: 'Active',   text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    pending:  { label: 'Pending',  text: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
    inactive: { label: 'Inactive', text: 'text-white/40',    bg: 'bg-white/5',        border: 'border-white/10' },
  };
  const s = map[status] || map.active;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

function Toast({ msg, onClose }) {
  if (!msg?.text) return null;
  const isError = msg.type === 'error';
  return (
    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl flex items-center gap-3 z-[9999] text-sm font-bold shadow-2xl border animate-in slide-in-from-bottom-5 backdrop-blur-md max-w-[calc(100vw-2rem)] ${isError ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
      {isError ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
      {msg.text}
      <button onClick={onClose} className="ml-2 text-white/50 hover:text-white transition-colors"><X size={14} /></button>
    </div>
  );
}

export default function SuperAdmin({ user }) {
  const [activeTab, setActiveTab] = useState('orgs');

  // --- Organizations state ---
  const [companies,  setCompanies]  = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [usingDemo,  setUsingDemo]  = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [orgError,   setOrgError]   = useState(null);
  const [pending,    setPending]    = useState([]);
  const [actionMsg,  setActionMsg]  = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(BLANK_USER);
  const [creating,   setCreating]   = useState(false);
  const [createMsg,  setCreateMsg]  = useState(null);

  // --- Users state ---
  const [users,      setUsers]      = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [actioning,  setActioning]  = useState(null);
  const [toDelete,   setToDelete]   = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [toast,      setToast]      = useState({ text: '', type: '' });

  const DEMO = [
    { id: 1, name: 'Apex Demo Corp',    total: 222847, critical: 1203, resolved: 186400, users: 14, model_acc: 86.3, last_active: 'Live' },
    { id: 2, name: 'FirefoxOS Labs',    total: 14820,  critical: 87,   resolved: 12300,  users: 6,  model_acc: 83.1, last_active: 'Live' },
    { id: 3, name: 'Meridian Systems',  total: 3410,   critical: 22,   resolved: 2900,   users: 4,  model_acc: 81.7, last_active: 'Live' },
    { id: 4, name: 'Quantum Dev Group', total: 980,    critical: 5,    resolved: 801,    users: 2,  model_acc: 79.4, last_active: 'Live' },
  ];

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: '', type: '' }), 4000);
  };

  const loadOrgs = async () => {
    setLoadingOrgs(true); setOrgError(null);
    try {
      const [companiesRes, pendingRes] = await Promise.all([
        axios.get('/api/superadmin/companies'),
        axios.get('/api/superadmin/pending'),
      ]);
      if (companiesRes.data?.length > 0) {
        setCompanies(companiesRes.data); setUsingDemo(false);
      } else {
        setCompanies(DEMO); setUsingDemo(true);
      }
      setPending(pendingRes.data || []);
    } catch (e) {
      setCompanies(DEMO);
      setUsingDemo(e.response?.status !== 403);
      if (e.response?.status === 403) setOrgError('Super admin access required on this account.');
    } finally { setLoadingOrgs(false); }
  };

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get('/api/superadmin/users');
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to load users.', 'error');
    } finally { setLoadingUsers(false); }
  }, []);

  useEffect(() => { loadOrgs(); }, []);
  useEffect(() => { if (activeTab === 'users') loadUsers(); }, [activeTab, loadUsers]);

  // --- Org actions ---
  const handleApprove = async (uuid, username) => {
    try {
      const res = await axios.patch(`/api/superadmin/users/${uuid}/approve`);
      const msg = res.data?.email_sent
        ? `${username} approved — invite email sent.`
        : `${username} approved — they can now sign in.`;
      setActionMsg(msg);
      setPending(p => p.filter(u => u.uuid !== uuid));
      setTimeout(() => setActionMsg(''), 6000);
    } catch { setActionMsg('Approval failed. Try again.'); setTimeout(() => setActionMsg(''), 4000); }
  };

  const handleReject = async (uuid, username) => {
    if (!window.confirm(`Reject ${username}? They will be marked inactive.`)) return;
    try {
      await axios.patch(`/api/superadmin/users/${uuid}/reject`);
      setActionMsg(`${username} rejected.`);
      setPending(p => p.filter(u => u.uuid !== uuid));
      setTimeout(() => setActionMsg(''), 4000);
    } catch { setActionMsg('Rejection failed.'); }
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
      const msg = res.data.email_sent
        ? res.data.message
        : `${res.data.message}${res.data.invite_code ? ` Invite code: ${res.data.invite_code}` : ''}`;
      setCreateMsg({ type: res.data.email_sent ? 'success' : 'warning', text: msg });
      setCreateForm(BLANK_USER);
      setTimeout(() => { setShowCreate(false); setCreateMsg(null); loadOrgs(); loadUsers(); }, 4000);
    } catch (err) {
      setCreateMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to create user.' });
    } finally { setCreating(false); }
  };

  // --- User actions ---
  const handlePromote = async (u) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`${newRole === 'admin' ? 'Promote' : 'Demote'} ${u.username}?`)) return;
    setActioning(u.uuid);
    try {
      await axios.patch(`/api/admin/users/${u.uuid}`, { role: newRole });
      setUsers(prev => prev.map(x => x.uuid === u.uuid ? { ...x, role: newRole } : x));
      showToast(`${u.username} is now ${newRole === 'admin' ? 'an Admin' : 'a User'}.`);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Role update failed.', 'error');
    } finally { setActioning(null); }
  };

  const handleToggleStatus = async (u) => {
    const isActive = (u.status || 'active') === 'active';
    const action   = isActive ? 'deactivate' : 'reactivate';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${u.username}?`)) return;
    setActioning(u.uuid);
    try {
      await axios.patch(`/api/admin/users/${u.uuid}/${action}`);
      setUsers(prev => prev.map(x => x.uuid === u.uuid ? { ...x, status: isActive ? 'inactive' : 'active' } : x));
      showToast(`${u.username} ${isActive ? 'deactivated' : 'reactivated'}.`);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Status update failed.', 'error');
    } finally { setActioning(null); }
  };

  const handleDeleteUser = async (deleteCompany = false) => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const params = deleteCompany ? '?delete_company=true' : '';
      const res = await axios.delete(`/api/admin/users/${toDelete.uuid}${params}`);
      setUsers(prev => prev.filter(u => u.uuid !== toDelete.uuid));
      let msg = `${toDelete.username || toDelete.email} deleted.`;
      if (res.data?.company_deleted) msg += ' Company also removed.';
      showToast(msg);
      setToDelete(null);
      loadOrgs();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed.', 'error');
    } finally { setDeleting(false); }
  };

  // Computed ---
  const total_bugs     = companies.reduce((s, c) => s + (c.total    || 0), 0);
  const total_critical = companies.reduce((s, c) => s + (c.critical || 0), 0);
  const total_users    = companies.reduce((s, c) => s + (c.users    || 0), 0);
  const avg_acc        = companies.length
    ? (companies.reduce((s, c) => s + (c.model_acc || 0), 0) / companies.length).toFixed(1) : '0';

  const myUuid = user?.uuid || user?.id;
  const ROLE_ORDER = { super_admin: 0, admin: 1, user: 2 };
  const filteredUsers = users
    .filter(u => {
      if (!u) return false;
      if (!userSearch.trim()) return true;
      const q = userSearch.toLowerCase();
      return (u.username || '').toLowerCase().includes(q)
          || (u.email || '').toLowerCase().includes(q)
          || (u.role  || '').toLowerCase().includes(q)
          || (u.company_name || '').toLowerCase().includes(q);
    })
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 2) - (ROLE_ORDER[b.role] ?? 2));

  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      <Toast msg={toast} onClose={() => setToast({ text: '', type: '' })} />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-500">
              <Crown size={12} /> <span className="text-[10px] font-bold tracking-widest uppercase">Global Control</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded border bg-red-500/10 border-red-500/20 text-red-400 uppercase tracking-widest">Restricted</span>
            {usingDemo && <span className="text-[10px] font-bold px-2 py-1 rounded border bg-indigo-500/10 border-indigo-500/20 text-indigo-400 uppercase tracking-widest">Demo data</span>}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Super <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Admin</span>
          </h1>
          <p className="text-white/50 text-sm max-w-xl leading-relaxed">Global control panel — manage all tenants, users, approvals, and system health in one place.</p>
        </div>
        <div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
          <button onClick={() => { loadOrgs(); if (activeTab === 'users') loadUsers(); }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">
            <RefreshCw size={14} className={(loadingOrgs || loadingUsers) ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => { setShowCreate(true); setCreateMsg(null); setCreateForm(BLANK_USER); }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            <UserPlus size={16} /> Create User
          </button>
        </div>
        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-amber-500/20 via-white/5 to-transparent" />
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 mb-8">
        {[
          { label: 'Total records',  value: total_bugs.toLocaleString(),     icon: <Bug size={16} className="text-blue-400" />,         sub: 'Across all orgs' },
          { label: 'Critical open',  value: total_critical.toLocaleString(), icon: <AlertTriangle size={16} className="text-red-400" />, sub: 'Needs attention' },
          { label: 'Active users',   value: total_users,                     icon: <Users size={16} className="text-emerald-400" />,     sub: 'All organisations' },
          { label: 'Avg model acc.', value: avg_acc + '%',                   icon: <TrendingUp size={16} className="text-indigo-400" />, sub: 'Cross-org average' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.02] border border-white/10 rounded-3xl p-5 lg:p-6 shadow-2xl relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex items-center gap-2 mb-4 relative z-10">{s.icon}<span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{s.label}</span></div>
            <div className="text-3xl font-bold text-white font-mono tracking-tight mb-2 relative z-10">{s.value}</div>
            <div className="text-xs text-white/40 font-medium relative z-10">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-2xl mb-8 w-fit">
        {[{ id: 'orgs', label: 'Organizations', icon: <Globe size={14} /> }, { id: 'users', label: 'Users', icon: <Users size={14} /> }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === t.id ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── ORGANIZATIONS TAB ── */}
      {activeTab === 'orgs' && (
        <>
          {orgError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-semibold mb-6 flex items-center gap-3">
              <AlertTriangle size={16} /> {orgError}
            </div>
          )}

          {(pending.length > 0 || actionMsg) && (
            <div className="bg-amber-500/[0.03] border border-amber-500/30 rounded-[2rem] shadow-2xl overflow-hidden mb-8 animate-in fade-in">
              <div className="p-5 border-b border-amber-500/20 bg-amber-500/10 flex items-center gap-3">
                <Clock size={16} className="text-amber-500" />
                <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">Pending Approvals</span>
                <span className="ml-auto text-[10px] font-bold bg-amber-500/20 text-amber-500 px-2.5 py-1 rounded">{pending.length} awaiting review</span>
              </div>
              {actionMsg && <div className="p-4 text-sm text-emerald-400 font-bold bg-emerald-500/10 border-b border-white/5">{actionMsg}</div>}
              {!(pending.length === 0 && actionMsg) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-amber-500/20 bg-black/20">
                        {['User', 'Email', 'Role', 'Company', 'Actions'].map(h => (
                          <th key={h} className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map(u => (
                        <tr key={u.uuid} className="border-b border-amber-500/10 last:border-0 hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 text-sm font-bold text-white">{u.username}</td>
                          <td className="px-6 py-4 text-sm text-white/50">{u.email}</td>
                          <td className="px-6 py-4"><RoleBadge role={u.role} /></td>
                          <td className="px-6 py-4 text-sm text-white/50">{u.company_name || '—'}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button onClick={() => handleApprove(u.uuid, u.username)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
                                <CheckCircle size={14} /> Approve
                              </button>
                              <button onClick={() => handleReject(u.uuid, u.username)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
                                <XCircle size={14} /> Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10 bg-black/20 flex items-center gap-3">
              <Globe size={16} className="text-blue-400" />
              <span className="text-xs font-bold text-white uppercase tracking-widest">Registered Organizations</span>
              <span className="ml-auto text-[10px] font-bold text-white/40 uppercase tracking-widest px-2.5 py-1 border border-white/10 rounded">{companies.length} org{companies.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    {['Organisation', 'Total bugs', 'Critical', 'Resolved', 'Users', 'Model acc.', 'Last active', ''].map(h => (
                      <th key={h} className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingOrgs ? (
                    <tr><td colSpan={8} className="py-16 text-center"><RefreshCw size={24} className="animate-spin text-white/30 mx-auto" /></td></tr>
                  ) : companies.map(co => (
                    <tr key={co.id} onClick={() => setSelected(selected?.id === co.id ? null : co)}
                      className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.04] ${selected?.id === co.id ? 'bg-blue-500/5' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center flex-shrink-0"><Building2 size={14} /></div>
                          <span className="font-bold text-sm text-white truncate max-w-[150px]">{co.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-white font-mono">{(co.total || 0).toLocaleString()}</td>
                      <td className="px-6 py-4"><span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded">{co.critical || 0}</span></td>
                      <td className="px-6 py-4 text-sm text-emerald-400 font-bold">{(co.resolved || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-white/50">{co.users || 0}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full max-w-[60px] overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: (co.model_acc || 0) + '%' }} />
                          </div>
                          <span className="text-xs font-bold text-white font-mono min-w-[36px]">{co.model_acc}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-white/40 whitespace-nowrap">{co.last_active}</td>
                      <td className="px-6 py-4 text-right">
                        <ChevronRight size={16} className={`text-white/40 transition-transform duration-300 ${selected?.id === co.id ? 'rotate-90 text-blue-400' : ''}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selected && (
            <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 mt-8">
              <div className="flex items-center gap-3 mb-8">
                <Building2 size={18} className="text-blue-400" />
                <span className="text-lg font-bold text-white">{selected.name}</span>
                <span className="text-xs text-white/40 ml-auto font-medium">Last active: {selected.last_active}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6 mb-8">
                {[
                  { label: 'Total bugs',      value: (selected.total    || 0).toLocaleString(), color: 'text-white' },
                  { label: 'Critical open',   value: selected.critical  || 0,                   color: 'text-red-400' },
                  { label: 'Resolved',        value: (selected.resolved || 0).toLocaleString(), color: 'text-emerald-400' },
                  { label: 'Active users',    value: selected.users     || 0,                   color: 'text-white' },
                  { label: 'Model accuracy',  value: selected.model_acc + '%',                  color: 'text-blue-400' },
                  { label: 'Resolution rate', value: selected.total ? ((selected.resolved / selected.total) * 100).toFixed(1) + '%' : '—', color: 'text-indigo-400' },
                ].map(s => (
                  <div key={s.label} className="p-5 rounded-2xl bg-white/5 border border-white/5">
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">{s.label}</div>
                    <div className={`text-2xl font-bold font-mono tracking-tight ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2 text-indigo-400">
                  <ShieldCheck size={14} />
                  <span className="text-xs font-bold uppercase tracking-widest">Data isolation confirmed</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed max-w-2xl">
                  This organization's data is scoped to <strong className="text-white font-mono">company_id = {selected.id}</strong>. Their users interact solely with their own telemetry. Row-Level Security enforced at the Supabase persistence layer.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === 'users' && (
        <>
          <div className="mb-6 relative">
            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              placeholder="Search by name, email, role or company…"
              value={userSearch} onChange={e => setUserSearch(e.target.value)}
              className="w-full h-14 bg-white/[0.02] border border-white/10 rounded-2xl pl-14 pr-12 text-white placeholder:text-white/30 focus:border-blue-500/50 focus:bg-white/5 outline-none transition-all text-sm"
            />
            {userSearch && (
              <button onClick={() => setUserSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-2 transition-colors"><X size={16} /></button>
            )}
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left min-w-[700px]">
                <thead>
                  <tr className="bg-black/20 border-b border-white/10">
                    {['User', 'Email', 'Role', 'Company', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers && (
                    <tr><td colSpan={6} className="py-16 text-center">
                      <RefreshCw size={24} className="animate-spin text-white/30 mx-auto mb-4" />
                      <div className="text-sm text-white/40 font-medium">Loading user index…</div>
                    </td></tr>
                  )}
                  {!loadingUsers && filteredUsers.length === 0 && (
                    <tr><td colSpan={6} className="py-16 text-center text-white/40 text-sm">
                      {userSearch ? 'No users match your search.' : 'No users found.'}
                    </td></tr>
                  )}
                  {!loadingUsers && filteredUsers.map((u, idx) => {
                    if (!u || typeof u !== 'object') return null;
                    const isSelf = myUuid && (u.uuid === myUuid);
                    const displayName = u.username || u.email || 'Unknown';
                    const avatarBg = u.role === 'super_admin' ? 'bg-amber-500' : u.role === 'admin' ? 'bg-indigo-500' : 'bg-blue-500';
                    return (
                      <tr key={u.uuid || idx} className={`border-b border-white/5 transition-colors hover:bg-white/[0.03] ${isSelf ? 'opacity-60' : ''} ${u.role === 'super_admin' ? 'bg-amber-500/[0.02]' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0 ${isSelf ? 'bg-white/20' : avatarBg}`}>
                              {(displayName[0] || 'U').toUpperCase()}
                            </div>
                            <div className="text-sm font-bold text-white">
                              {u.username || '—'}
                              {isSelf && <span className="text-[10px] ml-2 text-white/40 font-medium">(you)</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-[200px]"><span className="text-sm text-white/50 truncate block">{u.email || '—'}</span></td>
                        <td className="px-6 py-4"><RoleBadge role={u.role || 'user'} /></td>
                        <td className="px-6 py-4">
                          {u.role === 'super_admin'
                            ? <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500"><Globe size={14} /> System (global)</span>
                            : <span className="text-sm text-white/50 truncate max-w-[150px] inline-block">{u.company_name || '—'}</span>}
                        </td>
                        <td className="px-6 py-4"><StatusBadge status={u.status || 'active'} /></td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2 flex-wrap">
                            {!isSelf && u.role !== 'super_admin' && (
                              <button onClick={() => handlePromote(u)} disabled={actioning === u.uuid}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 ${u.role === 'admin' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'}`}>
                                {u.role === 'admin' ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                                {u.role === 'admin' ? 'Demote' : 'Promote'}
                              </button>
                            )}
                            {!isSelf && u.role !== 'super_admin' && (
                              <button onClick={() => handleToggleStatus(u)} disabled={actioning === u.uuid}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 ${(u.status || 'active') === 'active' ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'}`}>
                                {(u.status || 'active') === 'active' ? <UserMinus size={12} /> : <UserCheck size={12} />}
                                {(u.status || 'active') === 'active' ? 'Deactivate' : 'Reactivate'}
                              </button>
                            )}
                            {!isSelf && (
                              <button onClick={() => setToDelete(u)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">
                                <Trash2 size={12} /> Delete
                              </button>
                            )}
                            {isSelf && <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-2 py-1">(Active Session)</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!loadingUsers && (
              <div className="px-6 py-4 border-t border-white/5 text-xs text-white/40 flex justify-between items-center bg-black/20">
                <span className="font-medium">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}{userSearch ? ' matched' : ' total'}</span>
                <span>Your own account row is disabled for safety</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete confirm modal */}
      {toDelete && createPortal(
        <>
          <div onClick={() => setToDelete(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 w-full max-w-md pointer-events-auto shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-300">
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-2">Delete user?</h3>
              <p className="text-sm text-white/50 text-center mb-6 leading-relaxed">
                Permanently removes <strong className="text-white">{toDelete.username || toDelete.email}</strong> from the system.
              </p>
              <div className="flex flex-col gap-2">
                <button onClick={() => setToDelete(null)} className="py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-all">Cancel</button>
                <button onClick={() => handleDeleteUser(false)} disabled={deleting}
                  className="py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {deleting ? <><RefreshCw size={14} className="animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete user only</>}
                </button>
                {toDelete.company_id && (
                  <button onClick={() => handleDeleteUser(true)} disabled={deleting}
                    className="py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/40 text-red-400 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {deleting ? <><RefreshCw size={14} className="animate-spin" /> Deleting…</> : <><Building2 size={14} /> Delete user + entire company</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Create user modal */}
      {showCreate && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] w-full max-w-md p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30"><UserPlus size={18} /></div>
              <span className="text-lg font-bold text-white">Create User</span>
              <button onClick={() => setShowCreate(false)} className="ml-auto text-white/40 hover:text-white p-1 transition-colors"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateUser}>
              {[
                { label: 'Email', key: 'email', type: 'email', placeholder: 'user@company.com' },
                { label: 'Display Name', key: 'username', type: 'text', placeholder: 'Jane Smith' },
              ].map(f => (
                <div key={f.key} className="mb-5">
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">{f.label}</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all text-sm"
                    type={f.type} required placeholder={f.placeholder}
                    value={createForm[f.key]} onChange={e => setCreateForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="mb-5">
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Role</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 outline-none transition-all text-sm appearance-none"
                  value={createForm.role} onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="user" className="bg-black">User</option>
                  <option value="admin" className="bg-black">Admin</option>
                </select>
              </div>
              <div className="mb-8">
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Company</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 outline-none transition-all text-sm appearance-none"
                  value={createForm.company_id} required onChange={e => setCreateForm(p => ({ ...p, company_id: e.target.value }))}>
                  <option value="" disabled className="bg-black text-white/50">Select a company…</option>
                  {companies.filter(c => c.id).map(c => <option key={c.id} value={c.id} className="bg-black">{c.name}</option>)}
                </select>
              </div>
              {createMsg && (
                <div className={`flex items-center gap-2 mb-6 text-xs font-bold ${createMsg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                  {createMsg.type === 'error' ? <AlertTriangle size={13} /> : <CheckCircle size={13} />}
                  {createMsg.text}
                </div>
              )}
              <button type="submit" disabled={creating} className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {creating ? <><RefreshCw size={16} className="animate-spin" /> Creating…</> : <><UserPlus size={16} /> Create & Send Invite</>}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
