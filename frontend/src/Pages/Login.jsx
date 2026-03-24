import { useState, useEffect } from 'react';
import {
  ShieldCheck, CheckCircle, Mail, Lock, ArrowRight,
  Activity, Sun, Moon, Eye, EyeOff, Building2,
  AlertTriangle, User
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import axios from 'axios';


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

export default function Login({ onLogin, theme, toggleTheme }) {
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

  // Request-access state
  const [reqCompanyId, setReqCompanyId]         = useState('');
  const [companies, setCompanies]               = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset'); setViewState('form'); setIsRecovery(true);
        if (session?.user?.email) setEmail(session.user.email);
        setMsg('Recovery session active. Please enter your new password.');
      }
    });
  }, []);

  // Load companies list whenever we're on the user register form
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
    setMsg(''); setIsLoading(true);

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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: factors } = await supabase.auth.mfa.listFactors();
        if (factors?.totp?.length > 0) {
          setViewState('mfa_challenge');
        } else {
          onLogin(data.user);
        }

      } else if (mode === 'register') {
        // Only admins reach handleAuth for registration — users go to handleRequestAccess
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email, password,
          options: {
            data: {
              username:     username.trim(),
              company_name: companyName.trim(),
              is_admin:     true,
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
            company_name: companyName.trim(),
            username:     username.trim(),
            email:        email.trim(),
            uuid:         authUuid,
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
    } catch {
      setMsg('Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestAccess = async (e) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password || !reqCompanyId) {
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
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password });
      if (signUpErr) throw signUpErr;
      if (signUpData?.user?.identities?.length === 0) {
        throw new Error('This email already has an account. Try signing in instead.');
      }
      const authUuid = signUpData?.user?.id;

      await axios.post('/api/invite/request', {
        username:   username.trim(),
        email:      email.trim().toLowerCase(),
        company_id: parseInt(reqCompanyId, 10),
        uuid:       authUuid || '',
      });
      setViewState('request_sent');
    } catch (err) {
      setMsg(err.response?.data?.detail || err.message || 'Failed to submit request. Please try again.');
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

          {/* Request sent confirmation */}
          {viewState === 'request_sent' && (
            <div className="fade-in form-content-wrapper" style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: 'rgba(99,102,241,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Mail size={32} color="#6366f1" />
              </div>
              <h2 className="login-title" style={{ marginBottom: 8 }}>Request submitted</h2>
              <p className="login-sub" style={{ marginBottom: 10 }}>
                Your access request has been sent to <strong>{companies.find(c => String(c.id) === String(reqCompanyId))?.name || 'your company'}</strong>'s admin.
              </p>
              <p className="login-sub" style={{ marginBottom: 28, fontSize: 13 }}>
                Once approved, you'll receive an email at <strong>{email}</strong> with an invite code. Log in with your email and password, then enter the code when prompted.
              </p>
              <button className="sys-btn full" onClick={() => switchTo('login')}>
                Back to Sign In <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Admin registration submitted (pending super admin approval) */}
          {viewState === 'success' && (
            <div className="fade-in form-content-wrapper" style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: 'rgba(245,158,11,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle size={32} color="#f59e0b" />
              </div>
              <h2 className="login-title" style={{ marginBottom: 8 }}>Registration submitted</h2>
              <p className="login-sub" style={{ marginBottom: 10 }}>
                Your admin account for <strong>{companyName}</strong> is pending review.
              </p>
              <p className="login-sub" style={{ marginBottom: 28, fontSize: 13 }}>
                A super admin will approve your registration. You'll receive an email with a link to access your workspace once approved.
              </p>
              <button className="sys-btn full" onClick={() => switchTo('login')}>
                Back to Sign In <ArrowRight size={16} />
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

              <form onSubmit={mode === 'register' && registerRole === 'user' ? handleRequestAccess : handleAuth} className="modern-form">

                {/* REGISTER: role toggle */}
                {mode === 'register' && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 10, textTransform: 'uppercase' }}>
                      I am registering as
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { value: 'user',  icon: <User size={20} />,        label: 'Regular User',  sub: 'Request access to join' },
                        { value: 'admin', icon: <ShieldCheck size={20} />, label: 'Company Admin',  sub: 'Create a new company' },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => {
                          setRegisterRole(opt.value);
                          setReqCompanyId('');
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
                      <div className="fade-in">
                        <div className="input-group">
                          <Building2 size={18} className="input-icon" style={{ opacity: 0.5 }} />
                          <input className="sys-input login-input" placeholder="Company name" value={companyName}
                            onChange={e => setCompanyName(e.target.value)} required />
                        </div>
                        {companyName && /[<>"';&|`\\{}]/.test(companyName) && (
                          <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>
                            Company name contains invalid characters.
                          </p>
                        )}
                        {companyName && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(companyName) && (
                          <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>
                            Company name cannot be an email address.
                          </p>
                        )}
                        <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.5 }}>
                          A super admin will review and approve your registration.
                        </p>
                      </div>
                    )}

                    {/* Regular user: company dropdown */}
                    {registerRole === 'user' && (
                      <div className="fade-in">
                        <div className="input-group">
                          <Building2 size={18} className="input-icon" style={{ opacity: 0.5 }} />
                          <select
                            className="sys-input login-input"
                            value={reqCompanyId}
                            onChange={e => setReqCompanyId(e.target.value)}
                            required
                            style={{ paddingLeft: 40 }}
                          >
                            <option value="">{loadingCompanies ? 'Loading…' : 'Select your company'}</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.5 }}>
                          Once your admin approves you, you'll receive an email with an invite code.
                        </p>
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
                  {isLoading ? 'Please wait…' : (
                    mode === 'register' && registerRole === 'user'
                      ? 'Request Access'
                      : buttonLabels[mode]
                  )}
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
