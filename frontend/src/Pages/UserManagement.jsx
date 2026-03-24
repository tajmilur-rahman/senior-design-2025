import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Users, Trash2, RefreshCw, UserX, Building2,
  AlertTriangle, CheckCircle, X, Crown, Globe,
  KeyRound, Copy, RotateCcw, Eye, EyeOff,
  ShieldCheck, UserMinus, UserCheck, ArrowUpCircle, ArrowDownCircle,
  Mail, Send, UserPlus
} from 'lucide-react';

function RoleBadge({ role }) {
  const map = {
    super_admin: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Super Admin' },
    admin:       { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: 'Admin' },
    user:        { color: 'var(--accent)', bg: 'var(--pill-bg)',  label: 'User' },
  };
  const s = map[role] || map.user;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: 0.4 }}>
      {role === 'super_admin' && <Crown size={10} />}
      {s.label}
    </span>
  );
}

function CompanyCell({ user }) {
  if (user.role === 'super_admin') {
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#f59e0b' }}><Globe size={13} /> System (global)</span>;
  }
  return <span style={{ fontSize: 13, color: 'var(--text-sec)' }}>{user.company_name || '—'}</span>;
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

  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 2000 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 460, zIndex: 2001, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}>
        <div style={{ width: 52, height: 52, background: 'rgba(239,68,68,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <UserX size={24} color="#ef4444" />
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', textAlign: 'center', margin: '0 0 8px' }}>Delete user?</h3>
        <p style={{ fontSize: 13, color: 'var(--text-sec)', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.6 }}>
          Permanently removes <strong style={{ color: 'var(--text-main)' }}>{user.username || user.email}</strong> from both the authentication system and the database.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 9, marginBottom: isSuperAdmin ? 16 : 24 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {((user.username || user.email || 'U')[0] || 'U').toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username || '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-sec)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email || '—'}</div>
          </div>
          <RoleBadge role={user.role} />
        </div>

        {isSuperAdmin && user.company_id && user.role !== 'super_admin' && (
          <div style={{ marginBottom: 24 }}>
            {loadingInfo ? (
              <div style={{ padding: '12px 14px', background: 'var(--hover-bg)', borderRadius: 9, fontSize: 13, color: 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={13} className="spin" /> Checking company…
              </div>
            ) : companyInfo && (
              <div style={{ padding: '12px 14px', borderRadius: 9, background: companyCanBeDeleted ? 'rgba(239,68,68,0.05)' : 'var(--hover-bg)', border: `1px solid ${companyCanBeDeleted ? 'rgba(239,68,68,0.2)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Building2 size={15} color={companyCanBeDeleted ? '#ef4444' : 'var(--text-sec)'} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 3 }}>{companyInfo.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: companyCanBeDeleted ? 10 : 0 }}>
                      {companyCanBeDeleted
                        ? 'Last user in this company — you can delete the company too.'
                        : `${companyInfo.user_count} user${companyInfo.user_count !== 1 ? 's' : ''} remain — company will not be deleted.`}
                    </div>
                    {companyCanBeDeleted && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#ef4444', fontFamily: 'var(--font-head)' }}>
                        <input type="checkbox" checked={deleteCompany} onChange={e => setDeleteCompany(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#ef4444', cursor: 'pointer' }} />
                        Also delete company "{companyInfo.name}"
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px 0', background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-head)' }}>Cancel</button>
          <button onClick={() => onConfirm(deleteCompany)} disabled={loading} style={{ flex: 1, padding: '11px 0', background: '#ef4444', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: 'white', fontFamily: 'var(--font-head)', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            {loading ? <><RefreshCw size={13} className="spin" /> Deleting…</> : <><Trash2 size={13} /> {deleteCompany ? 'Delete user & company' : 'Delete user'}</>}
          </button>
        </div>
      </div>
    </>
  );
}

function Toast({ msg, onClose }) {
  if (!msg?.text) return null;
  const isError = msg.type === 'error';
  return (
    <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: isError ? 'var(--danger)' : '#0f172a', color: 'white', padding: '12px 24px', borderRadius: 50, boxShadow: '0 20px 40px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 12, zIndex: 9999, fontWeight: 600, fontSize: 13, border: `1px solid ${isError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`, whiteSpace: 'nowrap' }}>
      {isError ? <AlertTriangle size={15} /> : <CheckCircle size={15} color="#10b981" />}
      {msg.text}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 0, marginLeft: 6, display: 'flex' }}><X size={13} /></button>
    </div>
  );
}

// ── Invite Code Panel (shown to admins only, not super_admin) ─────────────────
function InviteCodePanel() {
  const [inviteData,    setInviteData]    = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [regenerating,  setRegenerating]  = useState(false);
  const [showCode,      setShowCode]      = useState(false);
  const [copied,        setCopied]        = useState(false);

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
    } catch { /* ignore */ }
    finally { setRegenerating(false); }
  };

  const handleCopy = () => {
    if (!inviteData?.invite_code) return;
    navigator.clipboard.writeText(inviteData.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return null;
  if (!inviteData) return null;

  return (
    <div className="sys-card" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <KeyRound size={16} color="var(--accent)" />
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>Company invite code</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-sec)' }}>{inviteData.company_name}</span>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: '0 0 14px', lineHeight: 1.6 }}>
        Share this code with new team members when they register as a Regular User.
        Without it, no one can join your company.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Code display */}
        <div style={{
          flex: 1, padding: '10px 16px',
          background: 'var(--hover-bg)', border: '1.5px solid var(--border)',
          borderRadius: 8, fontFamily: 'var(--font-mono)',
          fontSize: 18, fontWeight: 800, letterSpacing: 4,
          color: showCode ? 'var(--text-main)' : 'transparent',
          textShadow: showCode ? 'none' : '0 0 12px var(--text-sec)',
          userSelect: showCode ? 'text' : 'none',
          filter: showCode ? 'none' : 'blur(6px)',
          transition: 'filter 0.2s',
        }}>
          {inviteData.invite_code}
        </div>

        {/* Toggle visibility */}
        <button
          onClick={() => setShowCode(s => !s)}
          title={showCode ? 'Hide code' : 'Reveal code'}
          style={{ padding: '10px 12px', background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-sec)', transition: 'all 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>

        {/* Copy */}
        <button
          onClick={handleCopy}
          title="Copy to clipboard"
          style={{ padding: '10px 12px', background: copied ? 'rgba(16,185,129,0.1)' : 'var(--hover-bg)', border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', color: copied ? 'var(--success)' : 'var(--text-sec)', transition: 'all 0.15s' }}
        >
          {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
        </button>

        {/* Regenerate */}
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          title="Rotate invite code (invalidates current code)"
          style={{ padding: '10px 12px', background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 8, cursor: regenerating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-sec)', opacity: regenerating ? 0.6 : 1, transition: 'all 0.15s' }}
          onMouseEnter={e => { if (!regenerating) { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; } }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-sec)'; }}
        >
          <RotateCcw size={16} className={regenerating ? 'spin' : ''} />
        </button>
      </div>

      <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.5 }}>
        The rotate button generates a new code and immediately invalidates the old one — useful if a code was shared accidentally.
      </p>
    </div>
  );
}

function AccessRequestsPanel({ showToast }) {
  const [requests, setRequests]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [actioning, setActioning] = useState(null); // id being approved/rejected

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/invite_requests');
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false); }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (req) => {
    setActioning(req.id);
    try {
      const res = await axios.post(`/api/admin/invite_requests/${req.id}/approve`);
      const code = res.data?.invite_code;
      const msg  = code
        ? `${req.username} approved! Invite code: ${code} — sent to ${req.email}.`
        : (res.data?.message || `Invite sent to ${req.email}.`);
      showToast(msg);
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
    <div className="sys-card" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: requests.length ? 14 : 0 }}>
        <UserPlus size={16} color="#6366f1" />
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>Access Requests</span>
        {requests.length > 0 && (
          <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
            {requests.length}
          </span>
        )}
        <button onClick={fetchRequests} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)', display: 'flex', padding: 4 }}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {requests.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: 0 }}>
          No pending access requests. When someone requests to join your company, they'll appear here.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requests.map(req => (
            <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 9 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                {(req.username?.[0] || 'U').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.username}</div>
                <div style={{ fontSize: 12, color: 'var(--text-sec)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Mail size={11} /> {req.email}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => handleApprove(req)}
                  disabled={actioning === req.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 7, cursor: actioning === req.id ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--success)', fontFamily: 'var(--font-head)', opacity: actioning === req.id ? 0.6 : 1 }}
                >
                  <Send size={11} /> Send Invite
                </button>
                <button
                  onClick={() => handleReject(req)}
                  disabled={actioning === req.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, cursor: actioning === req.id ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-head)', opacity: actioning === req.id ? 0.6 : 1 }}
                >
                  <X size={11} /> Reject
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
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [toast,    setToast]    = useState({ text: '', type: '' });
  const [search,   setSearch]   = useState('');
  const [actioning, setActioning] = useState(null); // uuid of user being acted on

  const myUuid       = currentUser?.uuid || currentUser?.id || null;
  const myRole       = currentUser?.role || 'user';
  const isSuperAdmin = myRole === 'super_admin';
  const isAdmin      = myRole === 'admin';

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: '', type: '' }), 4000);
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
      const newStatus = isActive ? 'inactive' : 'active';
      setUsers(prev => prev.map(x => x.uuid === u.uuid ? { ...x, status: newStatus } : x));
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
    .sort((a, b) => ({ super_admin: 0, admin: 1, user: 2 }[a.role] ?? 2) - ({ super_admin: 0, admin: 1, user: 2 }[b.role] ?? 2));

  return (
    <div className="page-content fade-in">
      <Toast msg={toast} onClose={() => setToast({ text: '', type: '' })} />
      {toDelete && (
        <DeleteConfirmModal
          user={toDelete}
          isSuperAdmin={isSuperAdmin}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setToDelete(null)}
          loading={deleting}
        />
      )}

      {/* Header */}
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

      {/* Invite code panel — only for company admins, not super_admin */}
      {isAdmin && !isSuperAdmin && <InviteCodePanel />}

      {/* Access requests — pending email-based join requests */}
      {isAdmin && !isSuperAdmin && <AccessRequestsPanel showToast={showToast} />}

      {error && (
        <div style={{ padding: '14px 18px', marginBottom: 20, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} />{error}
          <button onClick={fetchUsers} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, fontWeight: 700, textDecoration: 'underline', fontFamily: 'var(--font-head)' }}>Retry</button>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 16, position: 'relative' }}>
        <input className="sys-input" placeholder="Search by name, email, role or company…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 14, height: 42, fontSize: 13 }} />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)', display: 'flex', padding: 4 }}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="sys-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr style={{ background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)' }}>
                {['User', 'Email', 'Role', isSuperAdmin ? 'Company' : null, 'Status', 'Actions']
                  .filter(Boolean).map(h => (
                    <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={isSuperAdmin ? 6 : 5} style={{ padding: '48px 0', textAlign: 'center' }}>
                  <RefreshCw size={20} color="var(--text-sec)" className="spin" style={{ margin: '0 auto', display: 'block' }} />
                  <div style={{ fontSize: 13, color: 'var(--text-sec)', marginTop: 10 }}>Loading users…</div>
                </td></tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr><td colSpan={isSuperAdmin ? 6 : 5} style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-sec)', fontSize: 13 }}>
                  {search ? 'No users match your search.' : 'No users found.'}
                </td></tr>
              )}
              {!loading && filtered.map((u, idx) => {
                if (!u || typeof u !== 'object') return null;
                const isSelf = myUuid && (u.uuid === myUuid || u.id === myUuid);
                const displayName = u.username || u.email || 'Unknown';
                const avatarBg = u.role === 'super_admin' ? '#f59e0b' : u.role === 'admin' ? '#6366f1' : 'var(--accent)';

                return (
                  <tr key={u.uuid || u.id || idx}
                    style={{ borderBottom: '1px solid var(--border)', opacity: isSelf ? 0.55 : 1, background: u.role === 'super_admin' ? 'rgba(245,158,11,0.03)' : 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = u.role === 'super_admin' ? 'rgba(245,158,11,0.03)' : 'transparent'}
                  >
                    <td style={{ padding: '13px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: isSelf ? 'var(--text-sec)' : avatarBg, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          {(displayName[0] || 'U').toUpperCase()}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                          {u.username || '—'}
                          {isSelf && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--text-sec)', fontWeight: 500 }}>(you)</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 18px', maxWidth: 220 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-sec)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{u.email || '—'}</span>
                    </td>
                    <td style={{ padding: '13px 18px' }}><RoleBadge role={u.role || 'user'} /></td>
                    {isSuperAdmin && <td style={{ padding: '13px 18px' }}><CompanyCell user={u} /></td>}
                    <td style={{ padding: '13px 18px' }}>
                      {(() => {
                        const st = u.status || 'active';
                        const cfg = {
                          active:   { label: 'Active',   color: 'var(--success)', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
                          pending:  { label: 'Pending',  color: '#f59e0b',         bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
                          inactive: { label: 'Inactive', color: 'var(--text-sec)', bg: 'var(--hover-bg)',      border: 'var(--border)' },
                        }[st] || { label: st, color: 'var(--text-sec)', bg: 'var(--hover-bg)', border: 'var(--border)' };
                        return (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                            {cfg.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '13px 18px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {/* Promote / Demote — only for admin managing non-super-admin, non-self */}
                        {!isSelf && u.role !== 'super_admin' && (
                          <button
                            onClick={() => handlePromote(u)}
                            disabled={actioning === u.uuid}
                            title={u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: u.role === 'admin' ? 'rgba(245,158,11,0.07)' : 'rgba(99,102,241,0.07)', border: `1px solid ${u.role === 'admin' ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'}`, borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: u.role === 'admin' ? '#f59e0b' : '#6366f1', fontFamily: 'var(--font-head)' }}
                          >
                            {u.role === 'admin' ? <ArrowDownCircle size={11} /> : <ArrowUpCircle size={11} />}
                            {u.role === 'admin' ? 'Demote' : 'Promote'}
                          </button>
                        )}
                        {/* Deactivate / Reactivate */}
                        {!isSelf && u.role !== 'super_admin' && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={actioning === u.uuid}
                            title={(u.status || 'active') === 'active' ? 'Deactivate user' : 'Reactivate user'}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: (u.status || 'active') === 'active' ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.07)', border: `1px solid ${(u.status || 'active') === 'active' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.3)'}`, borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: (u.status || 'active') === 'active' ? '#ef4444' : 'var(--success)', fontFamily: 'var(--font-head)' }}
                          >
                            {(u.status || 'active') === 'active' ? <UserMinus size={11} /> : <UserCheck size={11} />}
                            {(u.status || 'active') === 'active' ? 'Deactivate' : 'Reactivate'}
                          </button>
                        )}
                        {/* Delete */}
                        {!isSelf && (
                          <button
                            onClick={() => setToDelete(u)}
                            title={`Delete ${displayName}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-head)' }}
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        )}
                        {isSelf && <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>(you)</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && !error && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-sec)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{filtered.length} user{filtered.length !== 1 ? 's' : ''}{search ? ' matched' : ' total'}</span>
            <span>Your own account row is disabled for safety</span>
          </div>
        )}
      </div>
    </div>
  );
}