import { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle, Mail, Lock, ArrowRight, Activity, Sun, Moon, Eye, EyeOff, Building2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import axios from 'axios';

function PasswordInput({ value, onChange, placeholder, required = true }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-group">
      <Lock size={18} className="input-icon" style={{ opacity: 0.5 }} />
      <input className="sys-input login-input" type={visible ? 'text' : 'password'}
        placeholder={placeholder || 'Password'} value={value} onChange={onChange}
        required={required} style={{ paddingRight: 44 }} />
      <button type="button" onClick={() => setVisible(v => !v)} tabIndex={-1}
        style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)', display: 'flex', padding: 4, borderRadius: 4 }}>
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default function Login({ onLogin, theme, toggleTheme }) {
  const [mode, setMode]                     = useState('login');
  const [viewState, setViewState]           = useState('form');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName]       = useState('');
  const [username, setUsername]             = useState('');
  const [mfaCode, setMfaCode]               = useState('');
  const [msg, setMsg]                       = useState('');
  const [isLoading, setIsLoading]           = useState(false);
  const [isRecovery, setIsRecovery]         = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset'); setViewState('form'); setIsRecovery(true);
        if (session?.user?.email) setEmail(session.user.email);
        setMsg('Recovery session active. Please enter your new password.');
      }
    });
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setMsg(''); setIsLoading(true);

    if ((mode === 'register' || isRecovery) && password !== confirmPassword) {
      setMsg("Passwords don't match."); setIsLoading(false); return;
    }
    if (mode === 'register' && !companyName.trim()) {
      setMsg("Please enter a company name."); setIsLoading(false); return;
    }
    if (mode === 'register' && !username.trim()) {
      setMsg("Please enter a username."); setIsLoading(false); return;
    }

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: factors } = await supabase.auth.mfa.listFactors();
        if (factors?.totp?.length > 0) {
          setViewState('mfa_challenge');
        } else {
          onLogin(data.user);
        }

      } else if (mode === 'register') {
        // Step 1: Supabase Auth signup
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email, password,
          options: { data: { username: username.trim(), company_name: companyName.trim(), is_admin: true } },
        });
        if (signUpErr) throw signUpErr;

        const authUuid = signUpData?.user?.id;
        if (!authUuid) throw new Error("Signup succeeded but no UUID returned.");

        // Step 2: Create company + users row in our DB
        try {
          await axios.post('/api/register', {
            company_name: companyName.trim(),
            username:     username.trim(),
            email:        email.trim(),
            uuid:         authUuid,
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
      onLogin(user);
    } catch { setMsg('Invalid verification code. Please try again.'); }
    finally { setIsLoading(false); }
  };

  const switchTo = (newMode) => {
    setMode(newMode); setViewState('form'); setIsRecovery(false);
    setMsg(''); setEmail(''); setPassword(''); setConfirmPassword('');
    setCompanyName(''); setUsername(''); setMfaCode('');
  };

  const headings    = { login: 'Welcome back', register: 'Create your account', reset: isRecovery ? 'Set a new password' : 'Reset your password' };
  const subheadings = { login: 'Sign in to access your dashboard.', register: 'Set up your organisation and get started.', reset: isRecovery ? 'Choose a strong password.' : "Enter your email and we'll send a reset link." };
  const buttonLabels = { login: 'Sign In', register: 'Create Account', reset: isRecovery ? 'Update Password' : 'Send Reset Link' };

  return (
    <div className="login-backdrop-enterprise">
      <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>
      <div className="login-card-enterprise fade-in-up">
        <div className="login-brand-side">
          <div className="floating-shape shape-1" /><div className="floating-shape shape-2" /><div className="floating-shape shape-3" />
          <div className="brand-content">
            <div className="logo-box-large"><ShieldCheck size={44} color="white" /></div>
            <h1>Apex<span style={{ color: '#3b82f6' }}>OS</span></h1>
            <p>Machine-learning bug triage that learns from your team — classify, prioritise, and track defects in one place.</p>
            <div className="brand-stat-ent"><Activity size={14} /> System operational</div>
          </div>
        </div>
        <div className="login-form-side">
          {viewState === 'success' ? (
            <div className="fade-in form-content-wrapper" style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle size={32} color="#10b981" />
              </div>
              <h2 className="login-title" style={{ marginBottom: 8 }}>Account created</h2>
              <p className="login-sub" style={{ marginBottom: 10 }}>Your account for <strong>{companyName}</strong> is ready.</p>
              <p className="login-sub" style={{ marginBottom: 28, fontSize: 13 }}>Check your inbox to confirm your email, then sign in.</p>
              <button className="sys-btn full" onClick={() => switchTo('login')}>Go to Sign In <ArrowRight size={16} /></button>
            </div>
          ) : viewState === 'mfa_challenge' ? (
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
          ) : (
            <div className="fade-in form-content-wrapper">
              <h2 className="login-title">{headings[mode]}</h2>
              <p className="login-sub">{subheadings[mode]}</p>
              <form onSubmit={handleAuth} className="modern-form">
                <div className="input-group">
                  <Mail size={18} className="input-icon" style={{ opacity: 0.5 }} />
                  <input className="sys-input login-input" type="email" placeholder="Work email"
                    value={email} onChange={e => setEmail(e.target.value)} required disabled={isRecovery} autoComplete="email" />
                </div>
                {(mode !== 'reset' || isRecovery) && (
                  <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder={isRecovery ? 'New password' : 'Password'} />
                )}
                {(mode === 'register' || isRecovery) && (
                  <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password" />
                )}
                {mode === 'register' && (
                  <>
                    <div className="input-group fade-in">
                      <Building2 size={18} className="input-icon" style={{ opacity: 0.5 }} />
                      <input className="sys-input login-input" placeholder="Company name" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                    </div>
                    <div className="input-group fade-in">
                      <ShieldCheck size={18} className="input-icon" style={{ opacity: 0.5 }} />
                      <input className="sys-input login-input" placeholder="Your name / username" value={username} onChange={e => setUsername(e.target.value)} required />
                    </div>
                  </>
                )}
                <button className="sys-btn full login-btn-ent" type="submit" disabled={isLoading} style={{ opacity: isLoading ? 0.7 : 1 }}>
                  {isLoading ? 'Please wait…' : buttonLabels[mode]}
                  {!isLoading && <ArrowRight size={16} />}
                </button>
              </form>
              {msg && (
                <div className={`msg-banner ${msg.includes('sent') || msg.includes('success') || msg.includes('updated') || msg.includes('inbox') ? 'success' : 'error'}`}>{msg}</div>
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