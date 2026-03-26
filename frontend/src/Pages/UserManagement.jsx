import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Users, Trash2, RefreshCw, UserX, Building2,
  AlertTriangle, CheckCircle, X, Crown, Globe,
  KeyRound, Copy, RotateCcw, Eye, EyeOff, Search,
  UserMinus, UserCheck, ArrowUpCircle, ArrowDownCircle,
  Mail, Send, UserPlus
} from 'lucide-react';

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

function CompanyCell({ user }) {
  if (user.role === 'super_admin') {
    return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500"><Globe size={14} /> System (global)</span>;
  }
  return <span className="text-sm text-white/50 truncate max-w-[150px] inline-block">{user.company_name || '—'}</span>;
}

function DeleteConfirmModal({ user, isSuperAdmin, onConfirm, onCancel, loading }) {
  const [deleteCompany, setDeleteCompany] = useState(false);
  const [companyInfo, setCompanyInfo]     = useState(null);
  const [loadingInfo, setLoadingInfo]     = useState(false);

  useEffect(() => {
    if (!isSuperAdmin || !user?.company_id) return;
    setLoadingInfo(true);
    axios.get(`/api/superadmin/company_detail/${user.company_id}`)
      .then(r => setCompanyInfo(r.data))
      .catch(() => setCompanyInfo(null))
      .finally(() => setLoadingInfo(false));
  }, [user, isSuperAdmin]);

  if (!user) return null;
  const companyCanBeDeleted = companyInfo && companyInfo.user_count <= 1;

  return createPortal(
    <>
      <div onClick={onCancel} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
      <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 w-full max-w-md pointer-events-auto shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-300">
        <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <UserX size={24} className="text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-white text-center mb-2">Delete user?</h3>
        <p className="text-sm text-white/50 text-center mb-6 leading-relaxed">
          Permanently removes <strong className="text-white">{user.username || user.email}</strong> from both the authentication system and the database.
        </p>
        <div className={`flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl ${isSuperAdmin ? 'mb-4' : 'mb-8'}`}>
          <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
            {((user.username || user.email || 'U')[0] || 'U').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-white truncate">{user.username || '—'}</div>
            <div className="text-xs text-white/50 truncate">{user.email || '—'}</div>
          </div>
          <RoleBadge role={user.role} />
        </div>

        {isSuperAdmin && user.company_id && user.role !== 'super_admin' && (
          <div className="mb-6">
            {loadingInfo ? (
              <div className="p-4 bg-white/5 rounded-2xl text-sm text-white/50 flex items-center gap-3">
                <RefreshCw size={14} className="animate-spin" /> Checking company…
              </div>
            ) : companyInfo && (
              <div className={`p-4 rounded-2xl border ${companyCanBeDeleted ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-start gap-3">
                  <Building2 size={18} className={companyCanBeDeleted ? 'text-red-400 mt-0.5' : 'text-white/40 mt-0.5'} />
                  <div className="flex-1">
                    <div className="font-bold text-white mb-1">{companyInfo.name}</div>
                    <div className={`text-xs mb-3 ${companyCanBeDeleted ? 'text-red-400/80' : 'text-white/50'}`}>
                      {companyCanBeDeleted
                        ? 'Last user in this company — you can delete the company too.'
                        : `${companyInfo.user_count} user${companyInfo.user_count !== 1 ? 's' : ''} remain — company will not be deleted.`}
                    </div>
                    {companyCanBeDeleted && (
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-red-400">
                        <input type="checkbox" checked={deleteCompany} onChange={e => setDeleteCompany(e.target.checked)} className="w-4 h-4 rounded border-red-500/30 text-red-500 bg-black/40 focus:ring-red-500/50 cursor-pointer" />
                        Also delete company "{companyInfo.name}"
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-all">Cancel</button>
          <button onClick={() => onConfirm(deleteCompany)} disabled={loading} className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><RefreshCw size={14} className="animate-spin" /> Deleting…</> : <><Trash2 size={14} /> {deleteCompany ? 'Delete All' : 'Delete user'}</>}
          </button>
        </div>
      </div>
      </div>
    </>
  , document.body);
}

function Toast({ msg, onClose }) {
  if (!msg?.text) return null;
  const isError = msg.type === 'error';
  return (
    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl flex items-center gap-3 z-[9999] text-sm font-bold shadow-2xl border animate-in slide-in-from-bottom-5 backdrop-blur-md max-w-[calc(100vw-2rem)] text-center ${isError ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
      {isError ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
      {msg.text}
      <button onClick={onClose} className="ml-2 text-white/50 hover:text-white transition-colors"><X size={14} /></button>
    </div>
  );
}

function InviteCodePanel() {
  const [inviteData,   setInviteData]   = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [showCode,     setShowCode]     = useState(false);
  const [copied,       setCopied]       = useState(false);

  const fetchCode = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/invite_code');
      setInviteData(res.data);
    } catch { setInviteData(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCode(); }, [fetchCode]);

  const handleRegenerate = async () => {
    if (!window.confirm('Regenerate invite code? The current code will stop working immediately.')) return;
    setRegenerating(true);
    try {
      const res = await axios.post('/api/admin/invite_code/regenerate');
      setInviteData(prev => ({ ...prev, invite_code: res.data.invite_code }));
      setShowCode(true);
    } catch { }
    finally { setRegenerating(false); }
  };

  const handleCopy = () => {
    if (!inviteData?.invite_code) return;
    navigator.clipboard.writeText(inviteData.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading || !inviteData) return null;

  return (
    <div className="bg-blue-500/[0.03] border border-blue-500/20 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden mb-6 group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="flex items-center gap-2 mb-4 relative z-10">
        <KeyRound size={16} className="text-blue-400" />
        <span className="text-xs font-bold text-white uppercase tracking-widest">Invite Code</span>
        <span className="ml-auto text-[10px] font-bold text-blue-400/60 uppercase tracking-widest border border-blue-400/20 px-2 py-1 rounded hidden sm:block">{inviteData.company_name}</span>
      </div>
      <p className="text-sm text-white/50 mb-6 leading-relaxed relative z-10">
        Share this code with new team members when they register as a Regular User. Without it, no one can join your company.
      </p>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10">
        <div className={`flex-1 p-4 bg-black/40 border border-blue-500/20 rounded-xl font-mono text-2xl font-bold tracking-[0.3em] text-center shadow-inner transition-all ${showCode ? 'text-blue-400' : 'text-white/20 select-none'}`}>
          {showCode ? inviteData.invite_code : '•'.repeat(inviteData.invite_code?.length || 8)}
        </div>
        <div className="flex gap-2">
        <button onClick={() => setShowCode(s => !s)} title={showCode ? 'Hide code' : 'Reveal code'} className="flex-1 sm:flex-none p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-xl text-white/50 hover:text-white transition-all flex items-center justify-center">
          {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button onClick={handleCopy} title="Copy to clipboard" className={`flex-1 sm:flex-none p-4 rounded-xl border transition-all flex items-center justify-center ${copied ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/50 hover:text-white'}`}>
          {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
        </button>
        <button onClick={handleRegenerate} disabled={regenerating} title="Rotate invite code" className="flex-1 sm:flex-none p-4 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 rounded-xl text-white/50 hover:text-red-400 transition-all flex items-center justify-center disabled:opacity-50">
          <RotateCcw size={16} className={regenerating ? 'spin' : ''} />
        </button>
        </div>
      </div>
    </div>
  );
}

function AccessRequestsPanel({ showToast }) {
  const [requests,  setRequests]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [actioning, setActioning] = useState(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/invite_requests');
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (req) => {
    setActioning(req.id);
    try {
      const res = await axios.post(`/api/admin/invite_requests/${req.id}/approve`);
      const code = res.data?.invite_code;
      showToast(code ? `${req.username} approved! Invite code: ${code} — sent to ${req.email}.` : (res.data?.message || `Invite sent to ${req.email}.`));
      setRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to send invite.', 'error');
    } finally { setActioning(null); }
  };

  const handleReject = async (req) => {
    if (!window.confirm(`Reject access request from ${req.username} (${req.email})?`)) return;
    setActioning(req.id);
    try {
      await axios.delete(`/api/admin/invite_requests/${req.id}`);
      showToast(`Request from ${req.username} rejected.`);
      setRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to reject request.', 'error');
    } finally { setActioning(null); }
  };

  if (loading) return null;

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden mb-6">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-50" />
      <div className="flex items-center gap-2 mb-6 relative z-10">
        <UserPlus size={16} className="text-indigo-400" />
        <span className="text-xs font-bold text-white uppercase tracking-widest">Access Requests</span>
        {requests.length > 0 && (
          <span className="ml-2 px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-[10px] font-bold">{requests.length}</span>
        )}
        <button onClick={fetchRequests} className="ml-auto text-white/40 hover:text-white transition-colors p-1">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {requests.length === 0 ? (
        <div className="text-center py-6 text-white/30 text-sm font-medium border border-dashed border-white/10 rounded-2xl">
          No pending access requests at this time.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map(req => (
            <div key={req.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold flex-shrink-0 border border-indigo-500/30">
                {(req.username?.[0] || 'U').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-white truncate">{req.username}</div>
                <div className="text-xs text-white/50 truncate flex items-center gap-2 mt-1">
                  <Mail size={12} /> {req.email}
                </div>
              </div>
              <div className="flex gap-2 sm:flex-shrink-0">
                <button onClick={() => handleApprove(req)} disabled={actioning === req.id} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
                  <Send size={12} /> Approve
                </button>
                <button onClick={() => handleReject(req)} disabled={actioning === req.id} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
                  <X size={12} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UserManagement({ currentUser }) {
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [deleting,  setDeleting]  = useState(false);
  const [toDelete,  setToDelete]  = useState(null);
  const [toast,     setToast]     = useState({ text: '', type: '' });
  const [search,    setSearch]    = useState('');
  const [actioning, setActioning] = useState(null);

  const myUuid       = currentUser?.uuid || currentUser?.id || null;
  const myRole       = currentUser?.role || 'user';
  const isSuperAdmin = myRole === 'super_admin';
  const isAdmin      = myRole === 'admin';

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: '', type: '' }), 4000);
  };

  const STATUS_STYLE = {
    active:   { label: 'Active',   text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    pending:  { label: 'Pending',  text: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
    inactive: { label: 'Inactive', text: 'text-white/40',    bg: 'bg-white/5',        border: 'border-white/10' },
  };
  const StatusBadge = (st) => {
    const cfg = STATUS_STYLE[st] || { label: st, color: 'var(--text-sec)', bg: 'var(--hover-bg)', border: 'var(--border)' };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${cfg.bg} ${cfg.text} ${cfg.border}`}>
        {cfg.label}
      </span>
    );
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const endpoint = isSuperAdmin ? '/api/superadmin/users' : '/api/admin/users';
      const res = await axios.get(endpoint);
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load users.');
      setUsers([]);
    } finally { setLoading(false); }
  }, [isSuperAdmin]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handlePromote = async (u) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    const label   = newRole === 'admin' ? 'promote to Admin' : 'demote to User';
    if (!window.confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${u.username}?`)) return;
    setActioning(u.uuid);
    try {
      await axios.patch(`/api/admin/users/${u.uuid}`, { role: newRole });
      setUsers(prev => prev.map(x => x.uuid === u.uuid ? { ...x, role: newRole, is_admin: newRole === 'admin' } : x));
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

  const handleDeleteConfirm = async (deleteCompany) => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const params = deleteCompany ? '?delete_company=true' : '';
      const res = await axios.delete(`/api/admin/users/${toDelete.uuid}${params}`);
      setUsers(prev => prev.filter(u => u.uuid !== toDelete.uuid));
      let message = `${toDelete.username || toDelete.email} deleted.`;
      if (res.data?.company_deleted) message += ' Company also removed.';
      if (res.data?.company_warning)  message += ` Note: ${res.data.company_warning}`;
      showToast(message, res.data?.warning ? 'error' : 'success');
      setToDelete(null);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed. Please try again.', 'error');
    } finally { setDeleting(false); }
  };

  const ROLE_ORDER = { super_admin: 0, admin: 1, user: 2 };
  const filtered = users
    .filter(u => {
      if (!u) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (u.username     || '').toLowerCase().includes(q) ||
        (u.email        || '').toLowerCase().includes(q) ||
        (u.role         || '').toLowerCase().includes(q) ||
        (u.company_name || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 2) - (ROLE_ORDER[b.role] ?? 2));

  return (
    <div className="page-content fade-in">
      <Toast msg={toast} onClose={() => setToast({ text: '', type: '' })} />
      {toDelete && (
        <DeleteConfirmModal
          user={toDelete} isSuperAdmin={isSuperAdmin}
          onConfirm={handleDeleteConfirm} onCancel={() => setToDelete(null)}
          loading={deleting}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 9 }}>
            <Users size={22} color="var(--accent)" /> User Management
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: '4px 0 0' }}>
            {isSuperAdmin ? 'All users across every organisation.' : 'Users in your organisation.'}
            {' '}Deleting removes from both the database and authentication system.
          </p>
        </div>
        <button onClick={fetchUsers} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-sec)', fontFamily: 'var(--font-head)' }}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {isAdmin && !isSuperAdmin && <InviteCodePanel />}
      {isAdmin && !isSuperAdmin && <AccessRequestsPanel showToast={showToast} />}

      {error && (
        <div className="p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-semibold flex items-center gap-3">
          <AlertTriangle size={16} /> {error}
          <button onClick={fetchUsers} className="ml-auto underline hover:text-red-300">Retry</button>
        </div>
      )}

      <div className="mb-6 relative">
        <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        <input placeholder="Search by name, email, role or company…" value={search} onChange={e => setSearch(e.target.value)} 
          className="w-full h-14 bg-white/[0.02] border border-white/10 rounded-2xl pl-14 pr-12 text-white placeholder:text-white/30 focus:border-blue-500/50 focus:bg-white/5 outline-none transition-all text-sm shadow-inner" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-2 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left min-w-[600px]">
            <thead>
              <tr className="bg-black/20 border-b border-white/10">
                {['User', 'Email', 'Role', isSuperAdmin ? 'Company' : null, 'Status', 'Actions']
                  .filter(Boolean).map(h => (
                    <th key={h} className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={isSuperAdmin ? 6 : 5} className="py-16 text-center">
                  <RefreshCw size={24} className="animate-spin text-white/30 mx-auto mb-4" />
                  <div className="text-sm text-white/40 font-medium">Loading user index…</div>
                </td></tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr><td colSpan={isSuperAdmin ? 6 : 5} className="py-16 text-center text-white/40 text-sm">
                  {search ? 'No users match your search.' : 'No users found.'}
                </td></tr>
              )}
              {!loading && filtered.map((u, idx) => {
                if (!u || typeof u !== 'object') return null;
                const isSelf = myUuid && (u.uuid === myUuid || u.id === myUuid);
                const displayName = u.username || u.email || 'Unknown';
                const avatarBg = u.role === 'super_admin' ? 'bg-amber-500' : u.role === 'admin' ? 'bg-indigo-500' : 'bg-blue-500';

                return (
                  <tr key={u.uuid || u.id || idx} className={`border-b border-white/5 transition-colors hover:bg-white/[0.03] ${isSelf ? 'opacity-60' : ''} ${u.role === 'super_admin' ? 'bg-amber-500/[0.02]' : ''}`}>
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
                    <td className="px-6 py-4 max-w-[200px]">
                      <span className="text-sm text-white/50 truncate block">{u.email || '—'}</span>
                    </td>
                    <td className="px-6 py-4"><RoleBadge role={u.role || 'user'} /></td>
                    {isSuperAdmin && <td className="px-6 py-4"><CompanyCell user={u} /></td>}
                    <td className="px-6 py-4">{StatusBadge(u.status || 'active')}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 flex-wrap">
                        {!isSelf && u.role !== 'super_admin' && (
                          <button onClick={() => handlePromote(u)} disabled={actioning === u.uuid} title={u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 ${u.role === 'admin' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'}`}>
                            {u.role === 'admin' ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                            {u.role === 'admin' ? 'Demote' : 'Promote'}
                          </button>
                        )}
                        {!isSelf && u.role !== 'super_admin' && (
                          <button onClick={() => handleToggleStatus(u)} disabled={actioning === u.uuid} title={(u.status || 'active') === 'active' ? 'Deactivate user' : 'Reactivate user'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 ${(u.status || 'active') === 'active' ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'}`}>
                            {(u.status || 'active') === 'active' ? <UserMinus size={12} /> : <UserCheck size={12} />}
                            {(u.status || 'active') === 'active' ? 'Deactivate' : 'Reactivate'}
                          </button>
                        )}
                        {!isSelf && (
                          <button onClick={() => setToDelete(u)} title={`Delete ${displayName}`}
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
        {!loading && !error && (
          <div className="px-6 py-4 border-t border-white/5 text-xs text-white/40 flex justify-between items-center bg-black/20">
            <span className="font-medium">{filtered.length} user{filtered.length !== 1 ? 's' : ''}{search ? ' matched' : ' total'}</span>
            <span>Your own account row is disabled for safety</span>
          </div>
        )}
      </div>
    </div>
  );
}
