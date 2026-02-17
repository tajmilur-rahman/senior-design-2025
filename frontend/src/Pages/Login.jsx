import { useState } from 'react';
import axios from 'axios';
import { ShieldCheck, CheckCircle, User, Lock, ArrowRight, Activity } from 'lucide-react';
import { Background } from '../Components/LayoutUtils';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // login | register | reset
  const [viewState, setViewState] = useState('form');

  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [cp, setCp] = useState('');
  const [cn, setCn] = useState('');
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
        
        // --- [FIX] TOKEN STORAGE ---
        // We save the token so Overview.jsx can use it for Authorization headers
        // Check if your backend sends it as 'access_token' or just 'token'
        const token = r.data.access_token || r.data.token;
        if (token) {
            localStorage.setItem("token", token);
        }
        
        onLogin(r.data);

      } else if(mode === 'register'){
        await axios.post(`${API_URL}/users`, {
            username: u, password: p, role: 'admin', company_name: cn
        });
        setViewState('success');

      } else if(mode === 'reset'){
         await axios.put(`${API_URL}/users`, {
             username: u, new_password: p
         });
         setMsg("Password reset successfully. Please login.");
         setTimeout(() => switchTo('login'), 2000);
      }

    } catch (err) {
        console.error("Auth Error:", err);
        setMsg(err.response?.data?.detail || "Action failed.");
    }
  }

  const switchTo = (newMode) => {
      setMode(newMode);
      setViewState('form');
      setMsg("");
      setU(""); setP(""); setCp(""); setCn("");
  }

  return (
    <div className="login-backdrop">
      <div className="login-card-modern">

         {/* LEFT SIDE: BRANDING */}
         <div className="login-brand-side">
            <div className="brand-content">
                <div className="logo-box"><ShieldCheck size={32} color="white"/></div>
                <h1>BUG PRIORITY <span style={{color:'#60a5fa'}}>OS</span></h1>
                <p>AI-Powered Defect Intelligence & Classification System.</p>
                <div className="brand-stat">
                    <Activity size={16} /> <span>System Operational</span>
                </div>
            </div>
         </div>

         {/* RIGHT SIDE: FORM */}
         <div className="login-form-side">
             {viewState === 'success' ? (
                 <div className="fade-in center-content">
                     <div className="success-icon"><CheckCircle size={40} color="#16a34a"/></div>
                     <h2>Welcome Aboard!</h2>
                     <p>Your account has been created.</p>
                     <button className="sys-btn full" onClick={() => switchTo('login')}>PROCEED TO LOGIN</button>
                 </div>
             ) : (
                 <div className="fade-in">
                     <div className="mobile-brand"><ShieldCheck size={24} color="var(--accent)"/> BUG PRIORITY</div>

                     <h2 className="login-title">
                        {mode === 'login' && 'Welcome Back'}
                        {mode === 'register' && 'Create Account'}
                        {mode === 'reset' && 'Reset Password'}
                     </h2>
                     <p className="login-sub">
                        {mode === 'login' && 'Enter your credentials to access the dashboard.'}
                        {mode === 'register' && 'Setup your organization profile.'}
                        {mode === 'reset' && 'Enter your username and new password.'}
                     </p>

                     <form onSubmit={handleAuth} className="modern-form">
                        <div className="input-group">
                            <User size={18} className="input-icon"/>
                            <input placeholder="Username" value={u} onChange={e=>setU(e.target.value)} required/>
                        </div>

                        <div className="input-group">
                            <Lock size={18} className="input-icon"/>
                            <input type="password" placeholder={mode === 'reset' ? "New Password" : "Password"} value={p} onChange={e=>setP(e.target.value)} required/>
                        </div>

                        {(mode === 'register' || mode === 'reset') && (
                            <div className="input-group fade-in">
                                <Lock size={18} className="input-icon"/>
                                <input type="password" placeholder="Confirm Password" value={cp} onChange={e=>setCp(e.target.value)} required/>
                            </div>
                        )}

                        {mode === 'register' && (
                            <div className="input-group fade-in">
                                <ShieldCheck size={18} className="input-icon"/>
                                <input placeholder="Company Name" value={cn} onChange={e=>setCn(e.target.value)} required/>
                            </div>
                        )}

                        <button className="sys-btn full login-btn">
                            {mode==='login' ? 'SIGN IN' : mode==='register' ? 'REGISTER' : 'UPDATE PASSWORD'}
                            <ArrowRight size={16}/>
                        </button>
                     </form>

                     {msg && <div className={`msg-banner ${msg.includes('success')?'success':'error'}`}>{msg}</div>}

                     <div className="login-links">
                        {mode==='login' ? (
                            <>
                                <span onClick={()=>switchTo('reset')}>Forgot Password?</span>
                                <span className="dot">•</span>
                                <span onClick={()=>switchTo('register')} className="accent-link">Create Account</span>
                            </>
                        ) : (
                            <span onClick={()=>switchTo('login')} className="back-link">← Back to Login</span>
                        )}
                     </div>
                 </div>
             )}
         </div>
      </div>
    </div>
  )
}