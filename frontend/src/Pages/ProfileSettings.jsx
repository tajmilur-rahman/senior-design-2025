import { useState } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import { User, Lock, Save, CheckCircle, AlertTriangle, Building2, ShieldCheck } from 'lucide-react';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin:       'Company Admin',
  user:        'User',
};

const STATUS_CFG = {
  active:   { label: 'Active',   color: 'var(--success)' },
  pending:  { label: 'Pending',  color: '#f59e0b' },
  inactive: { label: 'Inactive', color: 'var(--text-sec)' },
};

export default function ProfileSettings({ user, onUpdate }) {
  const [username,        setUsername]        = useState(user?.username || '');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile,   setSavingProfile]   = useState(false);
  const [savingPassword,  setSavingPassword]  = useState(false);
  const [profileMsg,      setProfileMsg]      = useState(null);  // { type, text }
  const [passwordMsg,     setPasswordMsg]     = useState(null);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await axios.patch('/api/users/me', { username: username.trim() });
      setProfileMsg({ type: 'success', text: 'Display name updated.' });
      if (onUpdate) onUpdate({ username: res.data?.username || username });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.detail || 'Update failed.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: "Passwords don't match." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMsg({ type: 'success', text: 'Password updated successfully.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Password update failed.' });
    } finally {
      setSavingPassword(false);
    }
  };

  const statusCfg = STATUS_CFG[user?.status] || STATUS_CFG.active;

  return (
    <div className="page-content fade-in" style={{ maxWidth: 620 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <User size={22} color="var(--accent)" /> Profile Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: 0 }}>
          Manage your personal information and password.
        </p>
      </div>

      {/* Read-only info */}
      <div className="sys-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 16 }}>Account Info</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'Email',   value: user?.email   || '—' },
            { label: 'Role',    value: ROLE_LABELS[user?.role] || user?.role || '—' },
            { label: 'Company', value: user?.company_id ? `ID ${user.company_id}` : '—',
              icon: <Building2 size={13} style={{ marginRight: 5, opacity: 0.6 }} /> },
            { label: 'Status',  value: statusCfg.label, color: statusCfg.color },
          ].map(f => (
            <div key={f.label} style={{ padding: '12px 14px', background: 'var(--hover-bg)', borderRadius: 9, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: f.color || 'var(--text-main)', display: 'flex', alignItems: 'center' }}>
                {f.icon}{f.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Display name */}
      <div className="sys-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 16 }}>Display Name</div>
        <form onSubmit={handleSaveProfile}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 6 }}>Name</label>
            <input
              className="sys-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Your display name"
              maxLength={60}
              style={{ fontSize: 14 }}
            />
          </div>
          {profileMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: profileMsg.type === 'error' ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
              {profileMsg.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
              {profileMsg.text}
            </div>
          )}
          <button
            type="submit"
            disabled={savingProfile || !username.trim() || username.trim() === user?.username}
            className="sys-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: (savingProfile || !username.trim() || username.trim() === user?.username) ? 0.5 : 1 }}
          >
            <Save size={14} /> {savingProfile ? 'Saving…' : 'Save Name'}
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="sys-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 16 }}>Change Password</div>
        <form onSubmit={handleChangePassword}>
          {[
            { label: 'New password',     value: newPassword,     setter: setNewPassword },
            { label: 'Confirm password', value: confirmPassword, setter: setConfirmPassword },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 6 }}>{f.label}</label>
              <input
                className="sys-input"
                type="password"
                value={f.value}
                onChange={e => f.setter(e.target.value)}
                placeholder="••••••••"
                style={{ fontSize: 14 }}
              />
            </div>
          ))}
          {passwordMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: passwordMsg.type === 'error' ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
              {passwordMsg.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
              {passwordMsg.text}
            </div>
          )}
          <button
            type="submit"
            disabled={savingPassword || !newPassword || !confirmPassword}
            className="sys-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: (savingPassword || !newPassword || !confirmPassword) ? 0.5 : 1 }}
          >
            <Lock size={14} /> {savingPassword ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
