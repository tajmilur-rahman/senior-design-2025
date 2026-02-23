import { useState, useEffect } from 'react';
import axios from 'axios';
import BugAnalysis from './Pages/BugAnalysis';
import Overview from './Pages/Overview';
import Explorer from "./Pages/Explorer";
import SubmitTab from "./Pages/Submit";
import Login from "./Pages/Login";
import Directory from "./Pages/Directory";

import { ShieldCheck, LogOut, Moon, Sun } from 'lucide-react';
import './App.css';

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function Dashboard({ user, onLogout, theme, toggleTheme }) {
  const [tab, setTab] = useState('overview');
  const [externalQuery, setExternalQuery] = useState("");
  const [submitPrefill, setSubmitPrefill] = useState(null);

  const handleNavigation = (targetTab, query = "", prefill = null) => {
      setTab(targetTab);
      setExternalQuery(query);
      if (prefill) setSubmitPrefill(prefill);
  };

  return (
    <div className="app-container">
      <nav className="sys-nav">
        <div className="nav-content">
          <div className="nav-logo">
             <div style={{width:32, height:32, background:'var(--accent)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center'}}>
                <ShieldCheck size={20} color="white"/>
             </div>
             BUG<span style={{color:'var(--accent)'}}>PRIORITY</span>
          </div>
          <div className="nav-center">
             {['Overview', 'Directory', 'Database', 'Analysis', 'Submit'].map(t => (
                 <button key={t} className={`nav-link ${tab===t.toLowerCase()?'active':''}`} onClick={()=>{ setTab(t.toLowerCase()); setExternalQuery(""); }}>
                    {t}
                 </button>
             ))}
          </div>
          <div className="nav-right">
             <button className="icon-btn" onClick={toggleTheme} style={{marginRight: 10}}>
                 {theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}
             </button>
             <div className="user-pill">
                <div className="user-avatar-sm">{user.username[0].toUpperCase()}</div>
                <span className="user-name">{user.username}</span>
             </div>
             <button className="sys-btn outline" onClick={onLogout} style={{padding:'6px 12px', fontSize:12, fontWeight:700, gap:6, borderRadius:99}}>
                 <LogOut size={14} color="var(--text-sec)"/> EXIT
             </button>
          </div>
        </div>
      </nav>
      <main className="main-scroll">
         {tab === 'overview' && <Overview user={user} onNavigate={handleNavigation}/>}
         {tab === 'directory' && <Directory onNavigate={handleNavigation}/>}
         {tab === 'database' && <Explorer user={user} initialQuery={externalQuery} onNavigate={handleNavigation}/>}
         {tab === 'analysis' && <BugAnalysis />}
         {tab === 'submit' && <SubmitTab user={user} prefill={submitPrefill} onClearPrefill={() => setSubmitPrefill(null)}/>}
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  if (!user) return <Login onLogin={(u) => setUser(u)} theme={theme} toggleTheme={toggleTheme} />;
  return <Dashboard user={user} onLogout={() => setUser(null)} theme={theme} toggleTheme={toggleTheme} />;
}