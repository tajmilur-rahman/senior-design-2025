import { useState } from 'react';
import axios from 'axios';
import { ShieldCheck, CheckCircle, User, Lock, ArrowRight, Activity, Sun, Moon, Users } from 'lucide-react';

export default function Login({ onLogin, theme, toggleTheme }) {
  const [mode, setMode] = useState('login');
  const [viewState, setViewState] = useState('form');

  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [cp, setCp] = useState('');
  const [cn, setCn] = useState('');
  const [role, setRole] = useState('user');
  const [msg, setMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setMsg("");
    if ((mode === 'register' || mode === 'reset') && p !== cp) {
        setMsg("Passwords do not match.");
        return;
    }

    try {
      const API_URL = '/api';

      if(mode === 'login'){
        const r = await axios.post(`${API_URL}/login`, { username: u, password: p });
        const token = r.data.access_token || r.data.token;
        if (token) localStorage.setItem("token", token);
        onLogin(r.data);
      } else if(mode === 'register'){
        await axios.post(`${API_URL}/users`, { username: u, password: p, role: role, company_name: cn });
        setViewState('success');
      } else if(mode === 'reset'){
         await axios.put(`${API_URL}/users`, { username: u, new_password: p });
         setMsg("Password reset successfully. Please login.");
         setTimeout(() => switchTo('login'), 2000);
      }
    } catch (err) {
        setMsg(err.response?.data?.detail || "Action failed.");
    }
  }

  const switchTo = (newMode) => {
      setMode(newMode); setViewState('form'); setMsg(""); setU(""); setP(""); setCp(""); setCn(""); setRole('user');
  }

  return (
    <div className="login-backdrop-enterprise">
      <button className="theme-toggle-btn" onClick={toggleTheme}>
          {theme === 'light' ? <Moon size={20}/> : <Sun size={20}/>}
      </button>

      <div className="login-card-enterprise fade-in-up">
         <div className="login-brand-side">
            <div className="floating-shape shape-1"></div>
            <div className="floating-shape shape-2"></div>
            <div className="floating-shape shape-3"></div>
            <div className="brand-content">
                <div className="logo-box-large"><ShieldCheck size={48} color="white"/></div>
                <h1>BUG PRIORITY <span style={{color:'#3b82f6'}}>OS</span></h1>
                <p>Enterprise-grade AI infrastructure for defect classification, automated triage, and intelligent telemetry routing.</p>
                <div className="brand-stat-ent">
                    <Activity size={16} /> <span>System Operational</span>
                </div>
            </div>
         </div>

         <div className="login-form-side">
             {viewState === 'success' ? (
                 <div className="fade-in center-content">
                     <div className="success-icon-large"><CheckCircle size={48} color="#10b981"/></div>
                     <h2 className="login-title">Welcome Aboard!</h2>
                     <p className="login-sub">Your enterprise profile has been securely generated.</p>
                     <button className="sys-btn full" onClick={() => switchTo('login')} style={{marginTop: 20}}>PROCEED TO DASHBOARD</button>
                 </div>
             ) : (
                 <div className="fade-in form-content-wrapper">
                     <h2 className="login-title">
                        {mode === 'login' && 'Welcome Back'}
                        {mode === 'register' && 'Create Profile'}
                        {mode === 'reset' && 'Reset Password'}
                     </h2>
                     <p className="login-sub">
                        {mode === 'login' && 'Authenticate to access the intelligence dashboard.'}
                        {mode === 'register' && 'Deploy a new organization instance.'}
                        {mode === 'reset' && 'Enter your username and new password.'}
                     </p>

                     <form onSubmit={handleAuth} className="modern-form">
                        <div className="input-group">
                            <User size={20} className="input-icon"/>
                            <input className="sys-input login-input" placeholder="Username" value={u} onChange={e=>setU(e.target.value)} required/>
                        </div>

                        <div className="input-group">
                            <Lock size={20} className="input-icon"/>
                            <input className="sys-input login-input" type="password" placeholder={mode === 'reset' ? "New Password" : "Password"} value={p} onChange={e=>setP(e.target.value)} required/>
                        </div>

                        {(mode === 'register' || mode === 'reset') && (
                            <div className="input-group fade-in">
                                <Lock size={20} className="input-icon"/>
                                <input className="sys-input login-input" type="password" placeholder="Confirm Password" value={cp} onChange={e=>setCp(e.target.value)} required/>
                            </div>
                        )}

                        {mode === 'register' && (
                            <>
                                <div className="input-group fade-in">
                                    <ShieldCheck size={20} className="input-icon"/>
                                    <input className="sys-input login-input" placeholder="Company Name" value={cn} onChange={e=>setCn(e.target.value)} required/>
                                </div>
                                <div className="input-group fade-in">
                                    <Users size={20} className="input-icon" style={{zIndex: 1}}/>
                                    <select className="sys-input login-input" value={role} onChange={e=>setRole(e.target.value)} required>
                                        <option value="user">Standard User</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                </div>
                            </>
                        )}

                        <button className="sys-btn full login-btn-ent">
                            {mode==='login' ? 'AUTHENTICATE' : mode==='register' ? 'INITIALIZE ACCOUNT' : 'UPDATE RECORD'}
                            <ArrowRight size={18}/>
                        </button>
                     </form>

                     {msg && <div className={`msg-banner ${msg.includes('success')?'success':'error'}`}>{msg}</div>}

                     <div className="login-links-ent">
                        {mode==='login' ? (
                            <>
                                <span onClick={()=>switchTo('reset')}>Forgot Password?</span>
                                <span style={{opacity:0.3}}>•</span>
                                <span onClick={()=>switchTo('register')} className="accent-link">Create Account</span>
                            </>
                        ) : (
                            <span onClick={()=>switchTo('login')} className="back-link">← Return to Login</span>
                        )}
                     </div>
                 </div>
             )}
         </div>
      </div>
    </div>
  )
}