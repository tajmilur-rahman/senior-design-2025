import { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, CheckCircle, Mail, Lock, ArrowRight,
  Activity, Eye, EyeOff, Building2, User, ChevronDown
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import axios from 'axios';
import { Beams } from './Landing';

function CustomSelect({ value, onChange, options, placeholder, disabled = false, ariaLabel, triggerClassName, dropUp = false }) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);
  const listId = useRef(`sf-listbox-${Math.random().toString(36).slice(2, 9)}`).current;
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const selectedIdx = options.findIndex(o => String(o.value) === String(value));
  const selected = selectedIdx >= 0 ? options[selectedIdx] : null;
  useEffect(() => { if (!open) return; setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0); }, [open]);
  const openAnd = (idx) => { if (disabled) return; setOpen(true); setActiveIdx(idx); };
  const commit = (idx) => { if (idx < 0 || idx >= options.length) return; onChange(options[idx].value); setOpen(false); };
  const onKeyDown = (e) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter': case ' ': e.preventDefault(); if (!open) openAnd(selectedIdx >= 0 ? selectedIdx : 0); else commit(activeIdx); break;
      case 'ArrowDown': e.preventDefault(); if (!open) openAnd(selectedIdx >= 0 ? selectedIdx : 0); else setActiveIdx(i => Math.min(options.length - 1, i + 1)); break;
      case 'ArrowUp': e.preventDefault(); if (!open) openAnd(Math.max(0, selectedIdx)); else setActiveIdx(i => Math.max(0, i - 1)); break;
      case 'Escape': if (open) { e.preventDefault(); setOpen(false); } break;
      case 'Tab': setOpen(false); break;
      default: break;
    }
  };
  return (
    <div ref={ref} className={`relative select-none w-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div role="combobox" tabIndex={disabled ? -1 : 0} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-disabled={disabled} aria-label={ariaLabel || placeholder} onClick={() => { if (!disabled) setOpen(o => !o); }} onKeyDown={onKeyDown}
        className={triggerClassName || `h-12 flex items-center justify-between px-4 border rounded-xl cursor-pointer text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-blue-500/40 ${open ? 'border-blue-500/50 bg-white/10 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20'}`}>
        <span className={`truncate pr-2 ${selected ? 'text-white' : ''}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div id={listId} role="listbox" ref={listRef} aria-label={ariaLabel || placeholder} className={`absolute z-[9999] w-full bg-[#1a1d27] border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] overflow-hidden py-1.5 ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
          <div className="max-h-52 overflow-y-auto custom-scrollbar">
            {options.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              return (<div key={opt.value} role="option" aria-selected={isSelected} onClick={() => commit(i)} onMouseEnter={() => setActiveIdx(i)} className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors mx-1.5 rounded-xl ${isSelected ? 'bg-blue-500/20 text-blue-400' : i === activeIdx ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>{opt.label}</div>);
            })}
          </div>
        </div>
      )}
    </div>
  );
}



function PasswordInput({ value, onChange, placeholder, required = true }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-colors focus-within:border-white/30 focus-within:bg-white/10 flex items-center">
      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
      <input
        className="w-full bg-transparent px-4 py-4 pl-11 pr-12 text-white placeholder:text-white/40 focus:outline-none text-sm"
        type={visible ? 'text' : 'password'}
        placeholder={placeholder || 'Password'}
        value={value}
        onChange={onChange}
        required={required}
      />
      <button type="button" onClick={() => setVisible(v => !v)} tabIndex={-1}
        className="absolute right-4 text-white/50 hover:text-white transition-colors p-1.5 rounded flex items-center justify-center">
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default function Login({ onLogin, forceResetRecovery = false, onResetDone = null, onBack = null, forceInviteSetup = false, onInviteSetupDone = null }) {
  const [mode, setMode]                       = useState('login');
  const [viewState, setViewState]             = useState('form');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName]         = useState('');
  const [username, setUsername]               = useState('');
  const [registerRole, setRegisterRole]       = useState('user');
  const [mfaCode, setMfaCode]                 = useState('');
  const [msg, setMsg]                         = useState('');
  const [isLoading, setIsLoading]             = useState(false);
  const [isRecovery, setIsRecovery]           = useState(false);
  const [inviteViewState, setInviteViewState] = useState('form'); // 'form' | 'success'

  const [reqCompanyId, setReqCompanyId]         = useState('');
  const [companies, setCompanies]               = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode('reset');
        setViewState('form');
        setIsRecovery(true);
        if (session?.user?.email) setEmail(session.user.email);
        setMsg("Recovery session active. Please enter your new password.");
      }
    });
  }, []);

  useEffect(() => {
    if (!forceResetRecovery) return;
    setMode('reset');
    setViewState('form');
    setIsRecovery(true);
    setMsg('Recovery session active. Please enter your new password.');
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setEmail(data.user.email);
    }).catch(() => {});
  }, [forceResetRecovery]);

  useEffect(() => {
    if (!forceInviteSetup) return;
    // Pre-fill email from the current invite session
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setEmail(data.user.email);
    }).catch(() => {});
  }, [forceInviteSetup]);

  useEffect(() => {
    if (mode !== 'register' || registerRole !== 'user') return;
    if (companies.length > 0) return;
    setLoadingCompanies(true);
    axios.get('/api/invite/companies')
      .then(r => setCompanies(r.data || []))
      .catch(() => setCompanies([]))
      .finally(() => setLoadingCompanies(false));
  }, [mode, registerRole]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setMsg("");

    if ((mode === 'register' || isRecovery) && password !== confirmPassword) {
      setMsg("Passwords don't match."); setIsLoading(false); return;
    }
    if (mode === 'register' && registerRole === 'admin' && !companyName.trim()) {
      setMsg("Please enter a company name."); setIsLoading(false); return;
    }
    if (mode === 'register' && !username.trim()) {
      setMsg("Please enter a display name."); setIsLoading(false); return;
    }

    try {
      if (mode === 'login') {
        const normalizedEmail = email.trim().toLowerCase();
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;

        const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
        if (factorError) throw factorError;

        if (factors?.totp?.length > 0) {
          setViewState('mfa_challenge');
        } else {
          onLogin(data.user);
        }

      } else if (mode === 'register') {
        const normalizedEmail = email.trim().toLowerCase();

        try {
          await axios.post('/api/register', {
            company_name: companyName.trim(),
            username:     username.trim(),
            email:        normalizedEmail,
            uuid:         "",
            role:         'admin',
            invite_code:  '',
            password:     password,
          });
        } catch (regErr) {
          const detail = regErr.response?.data?.detail || '';
          if (!detail.includes('Already registered') && !detail.includes('already taken')) {
            console.warn('[register] backend note:', detail);
          }
        }

        setViewState('success');

      } else if (mode === 'reset') {
        if (isRecovery) {
          const { error } = await supabase.auth.updateUser({ password: password });
          if (error) throw error;
          setMsg("Password updated successfully!");
          setIsRecovery(false);
          setTimeout(() => {
            if (onResetDone) onResetDone();
            switchTo('login');
          }, 3000);
        } else {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
          });
          if (error) throw error;
          setMsg("Reset link sent to your email.");
          setTimeout(() => switchTo('login'), 4000);
        }
      }
    } catch (err) {
      const errMsg = err?.message || 'Something went wrong. Please try again.';
      if (mode === 'login' && /invalid login credentials/i.test(errMsg)) {
        setMsg('Invalid email or password. If your account was recently approved, check your email for an invite link to set your password.');
      } else {
        setMsg(errMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const verifyMfa = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factorId = factors.totp[0].id;

      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: mfaCode,
      });

      if (error) throw error;
      
      const { data: { user } } = await supabase.auth.getUser();
      onLogin(user);
    } catch {
      setMsg('Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestAccess = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!username.trim() || !normalizedEmail || !password || !reqCompanyId) {
      setMsg('Please fill in all fields.'); return;
    }
    if (password !== confirmPassword) {
      setMsg("Passwords don't match."); return;
    }
    if (password.length < 6) {
      setMsg('Password must be at least 6 characters.'); return;
    }
    setIsLoading(true); setMsg('');
    try {
      await axios.post('/api/invite/request', {
        username:   username.trim(),
        email:      normalizedEmail,
        company_id: parseInt(reqCompanyId, 10),
        uuid:       "",
      });
      setViewState('request_sent');
    } catch (err) {
      setMsg(err.response?.data?.detail || err.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteSetPassword = async (e) => {
    e.preventDefault();
    setMsg('');
    if (password !== confirmPassword) { setMsg("Passwords don't match."); return; }
    if (password.length < 6) { setMsg('Password must be at least 6 characters.'); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password, data: { needs_password_setup: false } });
      if (error) throw error;
      await axios.post('/api/users/me/sync-password-hash', { password }).catch(() => {});
      setInviteViewState('success');
      setTimeout(async () => {
        const { data } = await supabase.auth.getUser();
        if (onInviteSetupDone) onInviteSetupDone();
        if (data?.user && onLogin) onLogin(data.user);
      }, 2000);
    } catch (err) {
      setMsg(err?.message || 'Failed to set password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchTo = (newMode) => {
    setMode(newMode); setViewState('form'); setIsRecovery(false);
    setMsg(''); setEmail(''); setPassword(''); setConfirmPassword('');
    setCompanyName(''); setUsername(''); setMfaCode('');
    setRegisterRole('user');
    setReqCompanyId('');
  };

  const headings = {
    login:    'Welcome back',
    register: 'Create your account',
    reset:    isRecovery ? 'Set a new password' : 'Reset your password',
  };
  const subheadings = {
    login:    'Sign in to access your dashboard.',
    register: 'Choose your role and get started.',
    reset:    isRecovery ? 'Choose a strong password.' : "Enter your email and we'll send a reset link.",
  };
  const buttonLabels = {
    login:    'Sign In',
    register: 'Create Account',
    reset:    isRecovery ? 'Update Password' : 'Send Reset Link',
  };

  const submitDisabled = isLoading || (
    mode === 'register' && registerRole === 'user' && (!reqCompanyId || !password || !confirmPassword)
  );

  return (
    <div className="login-root relative min-h-screen w-full flex items-center justify-center font-sans overflow-hidden bg-black" data-theme="dark">
      {/* Full Bleed Beams Background */}
      <div className="absolute inset-0 z-0">
        <Beams beamWidth={2.5} beamHeight={18} beamNumber={15} lightColor="#ffffff" speed={2.5} noiseIntensity={2} scale={0.15} rotation={43} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/90 pointer-events-none" />
      </div>

      {/* Back Button */}
      {onBack && (
        <button onClick={onBack} className="absolute top-6 left-6 z-50 text-white/70 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors bg-white/5 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/10 shadow-lg">
          ← Back to Home
        </button>
      )}

      {/* Centered Liquid Glass Card */}
      <div className="login-card relative z-10 w-full max-w-[480px] p-8 sm:p-12 mx-4 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col my-12 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 mb-10 mx-auto">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
             <ShieldCheck size={22} className="text-black" />
          </div>
          <span className="font-bold text-2xl tracking-tight text-white">Spot<span className="text-white/50 font-medium">fixes</span></span>
        </div>

        {/* ── Invite set-password flow ── */}
        {forceInviteSetup && (
          <div className="w-full flex flex-col justify-center animate-in fade-in duration-500">
            {inviteViewState === 'success' ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={28} className="text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Password set!</h2>
                <p className="text-white/50 text-sm">Taking you to your workspace…</p>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-5">
                    <ShieldCheck size={12} /> Workspace Invite
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Set your password</h2>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Your account has been approved. Choose a password to secure your workspace.
                  </p>
                  {email && (
                    <p className="mt-3 text-xs text-white/30 font-mono">{email}</p>
                  )}
                </div>
                <form onSubmit={handleInviteSetPassword} className="flex flex-col gap-4">
                  <PasswordInput
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="New password"
                  />
                  <PasswordInput
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                  />
                  {msg && (
                    <div className="p-4 text-sm rounded-2xl border text-center bg-red-500/10 border-red-500/20 text-red-400">
                      {msg}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading || !password || !confirmPassword}
                    className="w-full mt-2 bg-white text-black hover:bg-zinc-200 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Setting password…' : (
                      <><Lock size={16} /> Set Password & Enter Workspace</>
                    )}
                  </button>
                </form>
                <p className="mt-6 text-center text-xs text-white/30 leading-relaxed">
                  By setting a password you agree to keep it confidential. You can change it later from your profile settings.
                </p>
              </>
            )}
          </div>
        )}

        {!forceInviteSetup && (
        <div className="w-full flex flex-col justify-center">
          {viewState === 'request_sent' && (
            <div className="w-full max-w-[420px] mx-auto text-center animate-in fade-in duration-500">
              <div className="w-16 h-16 bg-foreground/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
                <Mail size={28} className="text-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Request submitted</h2>
              <p className="text-muted-foreground text-sm mb-3">
                Your access request has been sent to <strong className="text-foreground">{companies.find(c => String(c.id) === String(reqCompanyId))?.name || 'your company'}</strong>'s admin.
              </p>
              <p className="text-muted-foreground/80 text-xs leading-relaxed mb-8">
                Once approved, you'll receive an email at <strong className="text-white">{email}</strong> with an invite code. Log in with your email and password, then enter the code when prompted.
              </p>
              <button className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 mt-4" onClick={() => switchTo('login')}>
                Back to Sign In <ArrowRight size={16} />
              </button>
            </div>
          )}

          {viewState === 'success' && (
            <div className="w-full max-w-[420px] mx-auto text-center animate-in fade-in duration-500">
              <div className="w-16 h-16 bg-foreground/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
                <CheckCircle size={28} className="text-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Registration submitted</h2>
              <p className="text-muted-foreground text-sm mb-3">
                Your admin account for <strong className="text-foreground">{companyName}</strong> is pending review.
              </p>
              <p className="text-muted-foreground/80 text-xs leading-relaxed mb-8">
                A super admin will approve your registration. You'll receive an email to access your workspace once approved.
              </p>
              <button className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 mt-4" onClick={() => switchTo('login')}>
                Back to Sign In <ArrowRight size={16} />
              </button>
            </div>
          )}

          {viewState === 'mfa_challenge' && (
            <div className="w-full max-w-[420px] mx-auto text-center animate-in fade-in duration-500">
              <div className="w-16 h-16 bg-foreground/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
                <Lock size={28} className="text-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Two-factor verification</h2>
              <p className="text-muted-foreground text-sm mb-8">Enter the 6-digit code from your authenticator app.</p>
              <input className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-5 text-white text-center text-3xl tracking-[0.5em] focus:border-white/30 focus:bg-white/10 outline-none transition-all mb-6" placeholder="000000" maxLength="6" value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                autoComplete="one-time-code" />
              <button className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50" onClick={verifyMfa} disabled={isLoading || mfaCode.length < 6}>
                {isLoading ? 'Verifying…' : 'Verify'} {!isLoading && <ArrowRight size={16} />}
              </button>
              {msg && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">{msg}</div>}
            </div>
          )}

          {viewState === 'form' && (
            <div className="w-full mx-auto animate-in fade-in duration-500">
              <h2 className="text-3xl font-bold mb-3 tracking-tight text-white text-center">{headings[mode]}</h2>
              <p className="text-white/60 mb-8 text-sm text-center">{subheadings[mode]}</p>

              <form onSubmit={mode === 'register' && registerRole === 'user' ? handleRequestAccess : handleAuth} className="flex flex-col gap-4 w-full">
                {mode === 'register' && (
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-white/60 mb-3 text-center">
                      I am registering as
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'user',  icon: <User size={20} />,        label: 'Company User',  sub: 'Request access to join' },
                        { value: 'admin', icon: <ShieldCheck size={20} />, label: 'Company Admin',  sub: 'Create a new company' },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => {
                          setRegisterRole(opt.value);
                          setReqCompanyId('');
                        }}
                          className={`flex flex-col items-center gap-1.5 p-4 rounded-xl cursor-pointer text-center transition-all ${
                             registerRole === opt.value 
                               ? 'border-2 border-white/30 bg-white/10' 
                               : 'border-2 border-transparent bg-white/5 hover:bg-white/10'
                          }`}>
                          <span className={registerRole === opt.value ? 'text-white' : 'text-white/40'}>{opt.icon}</span>
                          <span className={`text-sm font-bold ${registerRole === opt.value ? 'text-white' : 'text-white/60'}`}>{opt.label}</span>
                          <span className="text-[10px] text-muted-foreground leading-tight">{opt.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <div className="relative w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-colors focus-within:border-white/30 focus-within:bg-white/10 flex items-center">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input className="w-full bg-transparent px-4 py-4 pl-11 text-foreground placeholder:text-muted-foreground focus:outline-none text-sm" type="email" placeholder="Work email" value={email}
                      onChange={e => setEmail(e.target.value)} required disabled={isRecovery} autoComplete="email" />
                  </div>
                </div>

                {(mode !== 'reset' || isRecovery) && (
                  <PasswordInput
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={isRecovery ? "New Password" : "Password"}
                  />
                )}

                {(mode === 'register' || isRecovery) && (
                  <PasswordInput
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm Password"
                  />
                )}

                {mode === 'register' && (
                  <>
                    {registerRole === 'admin' && (
                      <div className="animate-in fade-in duration-300 w-full flex flex-col gap-1.5">
                        <div className="relative w-full rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-primary/50 focus-within:bg-foreground/10 flex items-center">
                          <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                          <input className="w-full bg-transparent px-4 py-4 pl-11 text-foreground placeholder:text-muted-foreground focus:outline-none text-sm" placeholder="Company name" value={companyName}
                            onChange={e => setCompanyName(e.target.value)} required />
                        </div>
                        {companyName && /[<>"';&|`\\{}]/.test(companyName) && (
                          <p className="mt-1 text-xs text-red-400 font-semibold">
                            Company name contains invalid characters.
                          </p>
                        )}
                        {companyName && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(companyName) && (
                          <p className="mt-1 text-xs text-red-400 font-semibold">
                            Company name cannot be an email address.
                          </p>
                        )}
                        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                          A super admin will review your registration. Once approved, you'll receive an email and can sign in with the password you set here.
                        </p>
                      </div>
                    )}

                    {registerRole === 'user' && (
                      <div className="animate-in fade-in duration-300 w-full flex flex-col gap-1.5">
                        <div className="relative w-full flex items-center">
                          <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                          <CustomSelect
                            value={reqCompanyId}
                            onChange={v => setReqCompanyId(v)}
                            options={companies.map(c => ({ value: c.id, label: c.name }))}
                            placeholder={loadingCompanies ? 'Loading…' : 'Select your company'}
                            triggerClassName={`w-full h-[54px] flex items-center justify-between pl-11 pr-4 border rounded-2xl cursor-pointer text-sm transition-all outline-none focus:ring-2 focus:ring-white/30 bg-white/5 backdrop-blur-sm ${reqCompanyId ? 'border-white/30 text-white' : 'border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white hover:border-white/30'}`}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                          Once your admin approves you, you'll receive an email with an invite code.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 animate-in fade-in duration-300 w-full">
                      <div className="relative w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-colors focus-within:border-white/30 focus-within:bg-white/10 flex items-center">
                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input className="w-full bg-transparent px-4 py-4 pl-11 text-foreground placeholder:text-muted-foreground focus:outline-none text-sm" placeholder="Your display name" value={username}
                          onChange={e => setUsername(e.target.value)} required />
                      </div>
                    </div>
                  </>
                )}

                <button className="w-full mt-4 bg-white text-black hover:bg-zinc-200 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" type="submit"
                  disabled={submitDisabled}
                >
                  {isLoading ? 'Please wait…' : (
                    mode === 'register' && registerRole === 'user'
                      ? 'Request Access'
                      : buttonLabels[mode]
                  )}
                  {!isLoading && <ArrowRight size={16} />}
                </button>
              </form>

              {msg && (
                <div className={`mt-6 p-4 text-sm rounded-2xl border text-center ${
                   msg.includes('sent') || msg.includes('success') || msg.includes('updated') || msg.includes('inbox') 
                   ? 'bg-primary/10 border-primary/20 text-primary' 
                   : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                  {msg}
                </div>
              )}

              {mode === 'login' ? (
                <div className="mt-8 text-center text-sm text-white/50 flex flex-col gap-3">
                  <p>New to our platform? <a href="#" onClick={(e) => { e.preventDefault(); switchTo('register'); }} className="text-white hover:underline transition-colors font-medium">Create Account</a></p>
                  <p><a href="#" onClick={(e) => { e.preventDefault(); switchTo('reset'); }} className="hover:underline transition-colors">Forgot password?</a></p>
                </div>
              ) : (
                <p className="mt-8 text-center text-sm text-white/50">
                  <a href="#" onClick={(e) => { e.preventDefault(); switchTo('login'); }} className="hover:underline transition-colors">← Back to sign in</a>
                </p>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
