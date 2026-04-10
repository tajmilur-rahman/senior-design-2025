import { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import { User, Lock, Save, CheckCircle, AlertTriangle, Building2, Bug, ShieldCheck } from 'lucide-react';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin:       'Company Admin',
  user:        'User',
};

const STATUS_CFG = {
  active:   { label: 'Active',   color: 'text-emerald-400' },
  pending:  { label: 'Pending',  color: 'text-amber-500' },
  inactive: { label: 'Inactive', color: 'text-white/40' },
};

export default function ProfileSettings({ user, onUpdate }) {
  const [username,        setUsername]        = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile,   setSavingProfile]   = useState(false);
  const [savingPassword,  setSavingPassword]  = useState(false);
  const [profileMsg,      setProfileMsg]      = useState(null);
  const [passwordMsg,     setPasswordMsg]     = useState(null);
  const [profileData,     setProfileData]     = useState(null);

  useEffect(() => {
    axios.get('/api/users/me/profile').then(res => setProfileData(res.data)).catch(() => {});
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true); setProfileMsg(null);
    try {
      const res = await axios.patch('/api/users/me', { username: username.trim() });
      setProfileMsg({ type: 'success', text: 'Display name updated.' });
      if (onUpdate) onUpdate({ username: res.data?.username || username });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.detail || 'Update failed.' });
    } finally { setSavingProfile(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) { setPasswordMsg({ type: 'error', text: 'Please enter your current password.' }); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg({ type: 'error', text: "Passwords don't match." }); return; }
    if (newPassword.length < 8) { setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters.' }); return; }
    setSavingPassword(true); setPasswordMsg(null);
    try {
      // Verify current password before allowing update
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user?.email, password: currentPassword });
      if (signInError) { setPasswordMsg({ type: 'error', text: 'Current password is incorrect.' }); setSavingPassword(false); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      // Sync bcrypt hash in users table so legacy systems stay consistent
      await axios.post('/api/users/me/sync-password-hash', { password: newPassword }).catch(() => {});
      setPasswordMsg({ type: 'success', text: 'Password updated successfully.' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Password update failed.' });
    } finally { setSavingPassword(false); }
  };

  const statusCfg = STATUS_CFG[user?.status] || STATUS_CFG.active;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-400">
              <User size={12} className="text-blue-500" />
              <span className="text-[10px] font-bold tracking-widest uppercase">Personal Config</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Profile <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Settings</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            Manage your personal identity, security credentials, and view your organizational access level.
          </p>
        </div>
        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-blue-500/20 via-white/5 to-transparent" />
      </div>

      {/* Account Info Grid */}
      <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden mb-6">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-6">
          <ShieldCheck size={14} className="text-white/40" /> Account Context
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(user?.role === 'super_admin' ? [
            { label: 'Email',        value: user?.email || '—' },
            { label: 'Role',         value: ROLE_LABELS[user?.role] || user?.role || '—' },
            { label: 'Organization', value: 'System', icon: <Building2 size={14} className="mr-2 opacity-50" /> },
            { label: 'Status',       value: statusCfg.label, color: statusCfg.color },
            { label: 'Bugs in DB',   value: profileData != null ? (profileData.bug_count ?? 0).toLocaleString() : '…', icon: <Bug size={14} className="mr-2 opacity-50" /> },
          ] : [
            { label: 'Email',    value: user?.email || '—' },
            { label: 'Role',     value: ROLE_LABELS[user?.role] || user?.role || '—' },
            { label: 'Company',  value: profileData?.company_name || (user?.company_id ? `Company ${user.company_id}` : '—'), icon: <Building2 size={14} className="mr-2 opacity-50" /> },
            { label: 'Status',   value: statusCfg.label, color: statusCfg.color },
            { label: 'Bugs in DB', value: profileData != null ? (profileData.bug_count ?? 0).toLocaleString() : '…', icon: <Bug size={14} className="mr-2 opacity-50" /> },
            { label: 'Onboarding', value: profileData?.onboarding_completed ? 'Completed ✓' : 'Setup Pending', color: profileData?.onboarding_completed ? 'text-emerald-400' : 'text-amber-500' },
          ]).map(f => (
            <div key={f.label} className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">{f.label}</div>
              <div className={`text-sm font-bold flex items-center ${f.color || 'text-white'}`}>{f.icon}{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Display Name */}
        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50" />
          <div className="text-xs font-bold text-white uppercase tracking-widest mb-6">Display Name</div>
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
            <div>
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Name</label>
              <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all text-sm" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your display name" maxLength={60} />
            </div>
            <div>
              {profileMsg && (
                <div className={`flex items-center gap-2 mb-4 text-xs font-bold ${profileMsg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                  {profileMsg.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                  {profileMsg.text}
                </div>
              )}
              <button type="submit" disabled={savingProfile || !username.trim() || username.trim() === user?.username}
                className={`w-full font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  savingProfile || !username.trim() || username.trim() === user?.username
                    ? 'bg-white/5 text-white/25 border border-white/[0.08] cursor-not-allowed'
                    : 'bg-white text-black hover:bg-zinc-200 cursor-pointer shadow-sm'
                }`}>
                <Save size={16} /> {savingProfile ? 'Saving…' : 'Save Name'}
              </button>
              {!savingProfile && username.trim() === user?.username && (
                <p className="text-[10px] text-white/25 text-center mt-2 font-medium">Change your name above to enable</p>
              )}
            </div>
          </form>
        </div>

        {/* Password */}
        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-50" />
          <div className="text-xs font-bold text-white uppercase tracking-widest mb-6">Change Password</div>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-6">
            <div className="space-y-4">
              {[
                { label: 'Current password', value: currentPassword, setter: setCurrentPassword },
                { label: 'New password',     value: newPassword,     setter: setNewPassword },
                { label: 'Confirm password', value: confirmPassword, setter: setConfirmPassword },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">{f.label}</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:border-purple-500/50 focus:bg-white/10 outline-none transition-all text-sm tracking-widest" type="password" value={f.value} onChange={e => f.setter(e.target.value)} placeholder="••••••••" />
                </div>
              ))}
            </div>
            <div>
              {passwordMsg && (
                <div className={`flex items-center gap-2 mb-4 text-xs font-bold ${passwordMsg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                  {passwordMsg.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                  {passwordMsg.text}
                </div>
              )}
              <button type="submit" disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                className={`w-full font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  savingPassword || !currentPassword || !newPassword || !confirmPassword
                    ? 'bg-white/5 text-white/25 border border-white/[0.08] cursor-not-allowed'
                    : 'bg-white text-black hover:bg-zinc-200 cursor-pointer shadow-sm'
                }`}>
                <Lock size={16} /> {savingPassword ? 'Updating…' : 'Update Password'}
              </button>
              {!savingPassword && (!currentPassword || !newPassword || !confirmPassword) && (
                <p className="text-[10px] text-white/25 text-center mt-2 font-medium">Fill all three fields above to enable</p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
