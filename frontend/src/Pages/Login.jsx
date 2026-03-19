import { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, CheckCircle, Mail, Lock, ArrowRight,
  Activity, Sun, Moon, Eye, EyeOff, Building2,
  AlertTriangle, User, KeyRound, Loader
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import axios from 'axios';

const ROLE_LABELS = {
  user:        'Regular user',
  admin:       'Company admin',
  super_admin: 'System super admin',
};

function PasswordInput({ value, onChange, placeholder, required = true }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-group">
      <Lock size={18} className="input-icon" style={{ opacity: 0.5 }} />
      <input
        className="sys-input login-input"
        type={visible ? 'text' : 'password'}
        placeholder={placeholder || 'Password'}
        value={value}
        onChange={onChange}
        required={required}
        style={{ paddingRight: 44 }}
      />
      <button type="button" onClick={() => setVisible(v => !v)} tabIndex={-1}
        style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)', display: 'flex', padding: 4, borderRadius: 4 }}>
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function RoleMismatchBanner({ roleError, onDismiss }) {
  if (!roleError) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 18, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 9, fontSize: 13, color: '#f59e0b', lineHeight: 1.6 }}>
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <strong style={{ display: 'block', marginBottom: 3, color: '#f59e0b' }}>Access context mismatch</strong>
        You selected <strong>"{ROLE_LABELS[roleError.selected] || roleError.selected}"</strong> but
        your account has role <strong>"{ROLE_LABELS[roleError.actual] || roleError.actual}"</strong>.
        {roleError.actual === 'super_admin'
          ? ' Super admins can use any context — try signing in again.'
          : ' Please select the correct context and sign in again.'}
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: 2, flexShrink: 0, fontSize: 16, lineHeight: 1 }} aria-label="Dismiss">×</button>
    </div>
  );
}

// ── Invite code input with live validation ────────────────────────────────────
function InviteCodeInput({ value, onChange, validationState }) {
  // validationState: null | 'checking' | { valid: true, company_name } | { valid: false }
  const borderColor = validationState?.valid === true
    ? 'rgba(16,185,129,0.6)'
    : validationState?.valid === false
    ? 'rgba(239,68,68,0.5)'
    : 'var(--border)';

  return (
    <div>
      <div className="input-group" style={{ position: 'relative' }}>
        <KeyRound size={18} className="input-icon" style={{ opacity: 0.5 }} />
        <input
          className="sys-input login-input"
          placeholder="Company invite code (e.g. AB12CD34)"
          value={value}
          onChange={e => onChange(e.target.value.toUpperCase())}
          required
          maxLength={12}
          style={{
            paddingRight: 40,
            border: `1.5px solid ${borderColor}`,
            fontFamily: 'var(--font-mono)',
            letterSpacing: value ? 2 : 0,
            textTransform: 'uppercase',
            transition: 'border-color 0.2s',
          }}
        />
        {/* Status indicator on the right */}
        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
          {validationState === 'checking' && <Loader size={14} color="var(--text-sec)" className="spin" />}
          {validationState?.valid === true  && <CheckCircle size={14} color="var(--success)" />}
          {validationState?.valid === false && <AlertTriangle size={14} color="var(--danger)" />}
        </div>
      </div>

      {/* Live feedback below the field */}
      {validationState?.valid === true && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
          <Building2 size={12} />
          Joining: <strong>{validationState.company_name}</strong>
        </div>
      )}
      {validationState?.valid === false && value.length >= 4 && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>
          Invalid code — check with your company admin.
        </div>
      )}
      {!validationState && (
        <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.5 }}>
          Ask your company admin for this code. It controls which company you join.
        </p>
      )}
    </div>
  );
}

export default function Login({ onLogin, theme, toggleTheme, roleError, onClearRoleError }) {
  const [mode, setMode]                       = useState('login');
  const [viewState, setViewState]             = useState('form');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName]         = useState('');
  const [username, setUsername]               = useState('');
  const [registerRole, setRegisterRole]       = useState('user');
  const [inviteCode, setInviteCode]           = useState('');
  const [inviteValidation, setInviteValidation] = useState(null);
  const [mfaCode, setMfaCode]                 = useState('');
  const [selectedRole, setSelectedRole]       = useState(localStorage.getItem('user_context_role') || 'user');
  const [msg, setMsg]                         = useState('');
  const [isLoading, setIsLoading]             = useState(false);
  const [isRecovery, setIsRecovery]           = useState(false);
  const inviteDebounceRef                     = useRef(null);

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset'); setViewState('form'); setIsRecovery(true);
        if (session?.user?.email) setEmail(session.user.email);
        setMsg('Recovery session active. Please enter your new password.');
      }
    });
  }, []);

  // Live invite code validation with debounce
  useEffect(() => {
    if (registerRole !== 'user' || !inviteCode || inviteCode.length < 4) {
      setInviteValidation(null);
      return;
    }
    setInviteValidation('checking');
    clearTimeout(inviteDebounceRef.current);
    inviteDebounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/invite/validate?code=${encodeURIComponent(inviteCode)}`);
        setInviteValidation(res.data);
      } catch {
        setInviteValidation({ valid: false });
      }
    }, 500);
    return () => clearTimeout(inviteDebounceRef.current);
  }, [inviteCode, registerRole]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setMsg(''); setIsLoading(true);

    if ((mode === 'register' || isRecovery) && password !== confirmPassword) {
      setMsg("Passwords don't match."); setIsLoading(false); return;
    }
    if (mode === 'register' && registerRole === 'admin' && !companyName.trim()) {
      setMsg("Please enter a company name."); setIsLoading(false); return;
    }
    if (mode === 'register' && registerRole === 'user' && inviteValidation?.valid !== true) {
      setMsg("Please enter a valid invite code before continuing."); setIsLoading(false); return;
    }
    if (mode === 'register' && !username.trim()) {
      setMsg("Please enter a display name."); setIsLoading(false); return;
    }

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: factors } = await supabase.auth.mfa.listFactors();
        if (factors?.totp?.length > 0) {
          setViewState('mfa_challenge');
        } else {
          onLogin(data.user, selectedRole);
        }

      } else if (mode === 'register') {
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email, password,
          options: {
            data: {
              username:     username.trim(),
              company_name: registerRole === 'admin' ? companyName.trim() : '',
              is_admin:     registerRole === 'admin',
            },
          },
        });

        if (signUpErr) throw signUpErr;

        if (signUpData?.user && signUpData.user.identities?.length === 0) {
          throw new Error('This email already exists. Please sign in instead.');
        }

        const authUuid = signUpData?.user?.id;
        if (!authUuid) throw new Error('Signup succeeded but no UUID returned.');

        try {
          await axios.post('/api/register', {
            company_name: registerRole === 'admin' ? companyName.trim() : '',
            username:     username.trim(),
            email:        email.trim(),
            uuid:         authUuid,
            role:         registerRole,
            invite_code:  registerRole === 'user' ? inviteCode.trim() : '',
          });
        } catch (regErr) {
          const detail = regErr.response?.data?.detail || '';
          // Surface invite code errors to the user — these are meaningful
          if (detail.toLowerCase().includes('invite') || detail.toLowerCase().includes('invalid')) {
            throw new Error(detail);
          }
          if (!detail.includes('Already registered') && !detail.includes('already taken')) {
            console.warn('[register] backend note:', detail);
          }
        }

        // Re-fetch DB row to confirm correct role before showing success
        try {
          const { data: rows } = await supabase.from('users').select('role').eq('uuid', authUuid);
          if (rows && rows.length > 0 && rows[0].role) {
            // Role confirmed from DB — good to show success
          }
        } catch { /* non-fatal */ }

        setViewState('success');

      } else if (mode === 'reset') {
        if (isRecovery) {
          const { error } = await supabase.auth.updateUser({ password });
          if (error) throw error;
          setMsg('Password updated successfully.');
          setIsRecovery(false);
          setTimeout(() => switchTo('login'), 3000);
        } else {
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
          if (error) throw error;
          setMsg('Check your inbox — a reset link is on its way.');
          setTimeout(() => switchTo('login'), 4000);
        }
      }
    } catch (err) {
      setMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyMfa = async () => {
    setIsLoading(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factorId = factors.totp[0].id;
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: mfaCode });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      onLogin(user, selectedRole);
    } catch {
      setMsg('Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchTo = (newMode) => {
    setMode(newMode); setViewState('form'); setIsRecovery(false);
    setMsg(''); setEmail(''); setPassword(''); setConfirmPassword('');
    setCompanyName(''); setUsername(''); setMfaCode('');
    setInviteCode(''); setInviteValidation(null);
    setSelectedRole('user'); setRegisterRole('user');
    if (onClearRoleError) onClearRoleError();
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

  // Disable submit if user registration and invite not yet valid
  const submitDisabled = isLoading ||
    (mode === 'register' && registerRole === 'user' && inviteValidation?.valid !== true);

  return (
    <div className="login-backdrop-enterprise" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", boxSizing: "border-box", overflowY: "auto" }}>
      <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>
      <div className="login-card-enterprise fade-in-up" style={{ width: "100%", maxWidth: "1100px", minHeight: "clamp(520px, 70vh, 720px)", display: "flex", overflow: "hidden", margin: "auto", boxShadow: "var(--glow)", borderRadius: "20px" }}>
        <div className="login-brand-side" style={{ flex: 1, padding: "4rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div className="floating-shape shape-1" /><div className="floating-shape shape-2" /><div className="floating-shape shape-3" />
          <div className="brand-content">
            <div className="logo-box-large"><ShieldCheck size={44} color="white" /></div>
            <h1>Apex<span style={{ color: '#3b82f6' }}>OS</span></h1>
            <p>Machine-learning bug triage that learns from your team — classify, prioritise, and track defects in one place.</p>
            <div className="brand-stat-ent"><Activity size={14} /> System operational</div>
          </div>
        </div>

        <div className="login-form-side" style={{ flex: 1, padding: "4rem", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: "600px", background: "var(--card-bg)" }}>

          {/* Success */}
          {viewState === 'success' && (
            <div className="fade-in form-content-wrapper" style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle size={32} color="#10b981" />
              </div>
              <h2 className="login-title" style={{ marginBottom: 8 }}>Account created</h2>
              <p className="login-sub" style={{ marginBottom: 10 }}>
                {registerRole === 'admin'
                  ? <>Your admin account for <strong>{companyName}</strong> is ready.</>
                  : <>You've joined <strong>{inviteValidation?.company_name || 'your company'}</strong>.</>}
              </p>
              <p className="login-sub" style={{ marginBottom: 28, fontSize: 13 }}>
                Check your inbox to confirm your email, then sign in.
              </p>
              <button className="sys-btn full" onClick={() => switchTo('login')}>
                Go to Sign In <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* MFA */}
          {viewState === 'mfa_challenge' && (
            <div className="fade-in form-content-wrapper" style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: 'var(--pill-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Lock size={28} color="var(--accent)" />
              </div>
              <h2 className="login-title" style={{ marginBottom: 8 }}>Two-factor verification</h2>
              <p className="login-sub" style={{ marginBottom: 28 }}>Enter the 6-digit code from your authenticator app.</p>
              <input className="sys-input login-input" placeholder="000 000" maxLength="6" value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                style={{ textAlign: 'center', fontSize: 22, letterSpacing: 10, marginBottom: 16 }} autoComplete="one-time-code" />
              <button className="sys-btn full" onClick={verifyMfa} disabled={isLoading || mfaCode.length < 6}>
                {isLoading ? 'Verifying…' : 'Verify'} {!isLoading && <ArrowRight size={16} />}
              </button>
              {msg && <div className="msg-banner error" style={{ marginTop: 14 }}>{msg}</div>}
            </div>
          )}

          {/* Main form */}
          {viewState === 'form' && (
            <div className="fade-in form-content-wrapper">
              <h2 className="login-title">{headings[mode]}</h2>
              <p className="login-sub">{subheadings[mode]}</p>

              <RoleMismatchBanner roleError={roleError} onDismiss={onClearRoleError} />

              <form onSubmit={handleAuth} className="modern-form">

                {/* LOGIN: access context */}
                {mode === 'login' && (
                  <div className="input-group fade-in" style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 8, textTransform: 'uppercase' }}>
                      Access Context
                    </label>
                    <div style={{ position: 'relative' }}>
                      <ShieldCheck size={18} className="input-icon" style={{ opacity: 0.5 }} />
                      <select className="sys-input login-input" value={selectedRole}
                        onChange={e => { setSelectedRole(e.target.value); if (onClearRoleError) onClearRoleError(); }}
                        style={{ appearance: 'auto', paddingLeft: 40, cursor: 'pointer' }}>
                        <option value="user">Regular User</option>
                        <option value="admin">Company Admin</option>
                        <option value="super_admin">System Super Admin</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* REGISTER: role toggle */}
                {mode === 'register' && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 10, textTransform: 'uppercase' }}>
                      I am registering as
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { value: 'user',  icon: <User size={20} />,        label: 'Regular User',  sub: 'Join with invite code' },
                        { value: 'admin', icon: <ShieldCheck size={20} />, label: 'Company Admin',  sub: 'Create a new company' },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => {
                          setRegisterRole(opt.value);
                          setInviteCode('');
                          setInviteValidation(null);
                        }}
                          style={{
                            padding: '14px 12px', borderRadius: 10, cursor: 'pointer',
                            textAlign: 'center',
                            border: `2px solid ${registerRole === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                            background: registerRole === opt.value ? 'var(--pill-bg)' : 'var(--hover-bg)',
                            transition: 'all 0.15s', fontFamily: 'var(--font-head)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          }}>
                          <span style={{ color: registerRole === opt.value ? 'var(--accent)' : 'var(--text-sec)' }}>{opt.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: registerRole === opt.value ? 'var(--accent)' : 'var(--text-main)' }}>{opt.label}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.3 }}>{opt.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="input-group">
                  <Mail size={18} className="input-icon" style={{ opacity: 0.5 }} />
                  <input className="sys-input login-input" type="email" placeholder="Work email" value={email}
                    onChange={e => setEmail(e.target.value)} required disabled={isRecovery} autoComplete="email" />
                </div>

                {(mode !== 'reset' || isRecovery) && (
                  <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder={isRecovery ? 'New password' : 'Password'} />
                )}
                {(mode === 'register' || isRecovery) && (
                  <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password" />
                )}

                {/* Register-only fields */}
                {mode === 'register' && (
                  <>
                    {/* Admin: company name */}
                    {registerRole === 'admin' && (
                      <div className="input-group fade-in">
                        <Building2 size={18} className="input-icon" style={{ opacity: 0.5 }} />
                        <input className="sys-input login-input" placeholder="Company name" value={companyName}
                          onChange={e => setCompanyName(e.target.value)} required />
                      </div>
                    )}

                    {/* Regular user: invite code with live validation */}
                    {registerRole === 'user' && (
                      <div className="fade-in">
                        <InviteCodeInput
                          value={inviteCode}
                          onChange={setInviteCode}
                          validationState={inviteValidation}
                        />
                      </div>
                    )}

                    {/* Display name */}
                    <div className="input-group fade-in">
                      <User size={18} className="input-icon" style={{ opacity: 0.5 }} />
                      <input className="sys-input login-input" placeholder="Your display name" value={username}
                        onChange={e => setUsername(e.target.value)} required />
                    </div>
                  </>
                )}

                <button className="sys-btn full login-btn-ent" type="submit"
                  disabled={submitDisabled}
                  style={{ opacity: submitDisabled ? 0.5 : 1 }}>
                  {isLoading ? 'Please wait…' : buttonLabels[mode]}
                  {!isLoading && <ArrowRight size={16} />}
                </button>
              </form>

              {msg && (
                <div className={`msg-banner ${msg.includes('sent') || msg.includes('success') || msg.includes('updated') || msg.includes('inbox') ? 'success' : 'error'}`}>
                  {msg}
                </div>
              )}

              <div className="login-links-ent" style={{ marginTop: 24 }}>
                {mode === 'login' ? (
                  <>
                    <span onClick={() => switchTo('reset')} style={{ cursor: 'pointer' }}>Forgot password?</span>
                    <span style={{ opacity: 0.25 }}>·</span>
                    <span onClick={() => switchTo('register')} style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 600 }}>Create account</span>
                  </>
                ) : (
                  <span onClick={() => switchTo('login')} style={{ cursor: 'pointer' }}>← Back to sign in</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}