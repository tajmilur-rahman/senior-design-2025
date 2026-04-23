import { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import {
  User, Lock, Save, CheckCircle, AlertTriangle, Building2, Bug, ShieldCheck,
  BrainCircuit, Database
} from 'lucide-react';
import { motion } from 'framer-motion';
import { LiquidButton as Button } from '../liquid-glass-button';
import { BentoCard } from '../bento-card';

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
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user?.email, password: currentPassword });
      if (signInError) { setPasswordMsg({ type: 'error', text: 'Current password is incorrect.' }); setSavingPassword(false); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await axios.post('/api/users/me/sync-password-hash', { password: newPassword }).catch(() => {});
      setPasswordMsg({ type: 'success', text: 'Password updated successfully.' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Password update failed.' });
    } finally { setSavingPassword(false); }
  };

  const statusCfg = STATUS_CFG[user?.status] || STATUS_CFG.active;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-5xl mx-auto p-6 lg:px-8 lg:py-12 font-sans relative z-10"
    >

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
        <div className="relative z-10 flex items-center gap-6">
          <div
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 ring-2 ring-white/20"
            style={{ background: '#3b82f6' }}
            aria-label={user?.username || 'User'}
          >
            {(user?.username || user?.email || 'U')[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-medium tracking-[0.06em] uppercase px-2.5 py-1 rounded-full border text-indigo-400 bg-indigo-500/10 border-indigo-500/20">
                <User size={10} className="inline mr-1" /> Your Profile
              </span>
              <span className={`text-[11px] font-medium tracking-[0.06em] uppercase ${statusCfg.color}`}>• {statusCfg.label}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">{user?.username || 'Profile'}</h1>
          <p className="text-white/50 text-sm mt-1">{user?.email}</p>
          </div>
        </div>
        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-white/20 via-white/5 to-transparent" />
      </div>

      {/* Activity stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <BentoCard className="p-5 hover:-translate-y-1 hover:shadow-xl hover:!bg-white/[0.04]">
          <div className="flex items-center gap-2 mb-3">
            <Bug size={14} className="text-indigo-500" />
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-widest">Bugs in DB</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">{profileData?.bug_count?.toLocaleString() ?? '…'}</div>
          <div className="text-[11px] text-white/30 mt-1">Total workspace records</div>
        </BentoCard>
        <BentoCard className="p-5 hover:-translate-y-1 hover:shadow-xl hover:!bg-white/[0.04]">
          <div className="flex items-center gap-2 mb-3">
            <BrainCircuit size={14} className="text-purple-400" />
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-widest">Active Model</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {profileData?.has_own_model ? 'Custom' : 'Universal'}
          </div>
          <div className="text-[11px] text-white/30 mt-1">
            {profileData?.has_own_model ? 'Company-specific weights' : 'Firefox baseline dataset'}
          </div>
        </BentoCard>
        <BentoCard className="p-5 hover:-translate-y-1 hover:shadow-xl hover:!bg-white/[0.04]">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={14} className="text-emerald-400" />
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-widest">Tenant Space</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white truncate">
            {user?.role === 'super_admin' ? 'System' : (profileData?.company_name || '—')}
          </div>
          <div className="text-[11px] text-white/30 mt-1">
            {user?.role === 'super_admin' ? 'Global administration' : 'Dedicated environment'}
          </div>
        </BentoCard>
        <BentoCard className="p-5 hover:-translate-y-1 hover:shadow-xl hover:!bg-white/[0.04]">
          <div className="flex items-center gap-2 mb-3">
            <Database size={14} className="text-amber-400" />
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-widest">Data Isolation</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {user?.role === 'super_admin' ? 'Global' : 'Tenant'}
          </div>
          <div className="text-[11px] text-white/30 mt-1">
            {user?.role === 'super_admin' ? 'Cross-workspace visibility' : 'Row-level security active'}
          </div>
        </BentoCard>
      </div>

      {/* Account context */}
      <BentoCard className="p-6 lg:p-8 shadow-2xl mb-6">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-6">
          <ShieldCheck size={14} className="text-white/60" /> Account Context
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(user?.role === 'super_admin' ? [
            { label: 'Email',        value: user?.email || '—' },
            { label: 'Role',         value: ROLE_LABELS[user?.role] || user?.role || '—' },
            { label: 'Organization', value: 'System' },
          ] : [
            { label: 'Email',   value: user?.email || '—' },
            { label: 'Role',    value: ROLE_LABELS[user?.role] || user?.role || '—' },
            { label: 'Company', value: profileData?.company_name || '—', icon: <Building2 size={13} className="mr-1.5 opacity-50" /> },
            { label: 'Onboarding', value: profileData?.onboarding_completed ? 'Completed ✓' : 'Setup Pending', color: profileData?.onboarding_completed ? 'text-emerald-400' : 'text-amber-500' },
          ]).map(f => (
            <div key={f.label} className="p-4 rounded-xl bg-white/5 border border-white/5 min-w-0">
              <div className="text-[11px] font-bold text-white/60 uppercase tracking-widest mb-1.5">{f.label}</div>
              <div className={`text-sm font-bold flex items-center ${f.color || 'text-white'}`} title={typeof f.value === 'string' ? f.value : ''}>
                {f.icon}
                <span className="truncate">{f.value}</span>
              </div>
            </div>
          ))}
        </div>
      </BentoCard>

      {/* Name + Password */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BentoCard className="p-6 lg:p-8 shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)' }} />
          <div className="text-xs font-bold text-white uppercase tracking-widest mb-6">Display Name</div>
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
            <div>
              <label className="block text-[11px] font-bold text-white/60 uppercase tracking-widest mb-2">Name</label>
              <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/50 focus:border-indigo-500/50 focus:bg-white/10 outline-none transition-all text-sm" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your display name" maxLength={60} />
            </div>
            <div>
              {profileMsg && (
                <div className={`flex items-center gap-2 mb-4 text-xs font-bold ${profileMsg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                  {profileMsg.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                  {profileMsg.text}
                </div>
              )}
              <Button type="submit" disabled={savingProfile || !username.trim() || username.trim() === user?.username}
                className="w-full font-bold py-3"
              >
                <Save size={16} /> {savingProfile ? 'Saving…' : 'Save Name'}
              </Button>
            </div>
          </form>
        </BentoCard>

        <BentoCard className="p-6 lg:p-8 shadow-2xl">
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
                  <label className="block text-[11px] font-bold text-white/60 uppercase tracking-widest mb-2">{f.label}</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/50 focus:border-purple-500/50 focus:bg-white/10 outline-none transition-all text-sm tracking-widest" type="password" value={f.value} onChange={e => f.setter(e.target.value)} placeholder="••••••••" />
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
              <Button type="submit" disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="w-full font-bold py-3"
              >
                <Lock size={16} /> {savingPassword ? 'Updating…' : 'Update Password'}
              </Button>
            </div>
          </form>
        </BentoCard>
      </div>
    </motion.div>
  );
}
