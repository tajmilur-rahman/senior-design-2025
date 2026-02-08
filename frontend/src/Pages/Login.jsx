import { useState } from 'react';
import axios from 'axios';
import { ShieldCheck, CheckCircle } from 'lucide-react';
import { Background } from '../Components/LayoutUtils';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
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
      if(mode==='login'){
        // Note: Using localhost 127.0.0.1 for now
        const r = await axios.post('http://127.0.0.1:8000/api/login',{username:u,password:p});
        onLogin(r.data);
      } else if(mode==='register'){
        await axios.post('http://127.0.0.1:8000/api/users',{req:{username:u,password:p,role:'admin'},company_name:cn});
        setViewState('success');
      } else if(mode==='reset'){
        await axios.post('http://127.0.0.1:8000/api/reset-password',{username:u,password:p});
        setViewState('success');
      } else if(mode==='delete'){
        await axios.delete('http://127.0.0.1:8000/api/users', { data: { username: u, password: p } });
        setMsg("Account deleted.");
        setU(""); setP(""); setMode('login');
      }
    } catch { setMsg("Authentication failed."); }
  }

  const getTitle = () => {
    if (mode === 'login') return 'BUG SYSTEM LOGIN';
    if (mode === 'register') return 'NEW ACCOUNT';
    if (mode === 'reset') return 'RESET PASSWORD';
    if (mode === 'delete') return 'DELETE ACCOUNT';
  };

  const switchTo = (newMode) => {
      setMode(newMode);
      setViewState('form');
      setMsg("");
      setU(""); setP(""); setCp(""); setCn("");
  }

  return (
    <div className="login-backdrop">
      <Background />
      <div className="login-window">
         {viewState === 'success' ? (
             <div className="fade-in">
                 <div style={{width:64, height:64, background:'#dcfce7', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px'}}>
                     <CheckCircle size={32} color="#16a34a"/>
                 </div>
                 <h2 style={{fontSize:22, fontWeight:800, marginBottom:10, color:'#1e293b'}}>
                     {mode === 'register' ? 'Account Created!' : 'Password Updated'}
                 </h2>
                 <p style={{color:'#64748b', fontSize:14, marginBottom:30}}>
                     {mode === 'register' ? 'Your profile has been successfully set up.' : 'You can now access your dashboard with your new credentials.'}
                 </p>
                 <button className="sys-btn full" onClick={() => switchTo('login')}>
                     BACK TO LOGIN
                 </button>
             </div>
         ) : (
             <div className="fade-in">
                 <div className="login-brand-icon">
                    <ShieldCheck size={32} color="white"/>
                 </div>
                 <h1 style={{fontSize:22, fontWeight:800, marginBottom:32, letterSpacing:-0.5, color:'#1e293b'}}>{getTitle()}</h1>
                 <form onSubmit={handleAuth}>
                    <input className="sys-input" placeholder="Username" value={u} onChange={e=>setU(e.target.value)} required/>
                    <input className="sys-input" type="password" placeholder="Password" value={p} onChange={e=>setP(e.target.value)} required/>
                    {(mode === 'register' || mode === 'reset') && (
                        <input className="sys-input" type="password" placeholder="Re-enter Password" value={cp} onChange={e=>setCp(e.target.value)} required/>
                    )}
                    {mode==='register' && <input className="sys-input" placeholder="Company name" value={cn} onChange={e=>setCn(e.target.value)} required/>}
                    <button className="sys-btn full" style={{marginTop:16, background: mode==='delete'?'var(--danger)':'var(--text-main)'}}>
                        {mode==='login'?'ACCESS DASHBOARD':mode==='register'?'CREATE PROFILE':mode==='reset'?'RESET PASSWORD':'CONFIRM DELETE'}
                    </button>
                 </form>
                 {msg && <div style={{marginTop:20, fontSize:13, fontWeight:600, color:msg.includes('fail')||msg.includes('match')?'var(--danger)':'var(--success)'}}>{msg}</div>}
                 <div className="login-footer">
                    {mode==='login' ? (
                        <>
                            <span onClick={()=>switchTo('register')} style={{color:'var(--accent)'}}>Create Account</span>
                            <span onClick={()=>switchTo('reset')}>Forgot Password?</span>
                            <span onClick={()=>switchTo('delete')} style={{color:'var(--danger)'}}>Delete</span>
                        </>
                    ) : (
                        <span onClick={()=>switchTo('login')} style={{color:'var(--text-main)'}}>Back to Login</span>
                    )}
                 </div>
             </div>
         )}
      </div>
    </div>
  )
}