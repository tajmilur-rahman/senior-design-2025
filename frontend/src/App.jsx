import { useState, useEffect } from 'react';
import axios from 'axios';
import BugAnalysis from './Pages/BugAnalysis';
import Overview from './Pages/Overview';
import Explorer from "./Pages/Explorer";
import SubmitTab from "./Pages/Submit";
import Login from "./Pages/Login";
import Directory from "./Pages/Directory";
import Onboarding from "./Pages/Onboarding";
import Performance from "./Pages/Performance";
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

  // Base nav tabs visible to all users
  const baseTabs = ['Overview', 'Directory', 'Database', 'Analysis', 'Submit'];

  return (
    <div className="app-container">
      <nav className="sys-nav">
        <div className="nav-content">
          <div className="nav-logo">
            <div style={{width:32, height:32, background:'var(--accent)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center'}}>
              <ShieldCheck size={20} color="white"/>
            </div>
            APEX<span style={{color:'var(--accent)'}}>SYSTEM</span>
          </div>
          <div className="nav-center">
            {/* Standard tabs — visible to all users */}
            {baseTabs.map(t => (
              <button
                key={t}
                className={`nav-link ${tab === t.toLowerCase() ? 'active' : ''}`}
                onClick={() => { setTab(t.toLowerCase()); setExternalQuery(""); }}
              >
                {t}
              </button>
            ))}
            {/* Performance tab — admin only */}
            {user.role === 'admin' && (
              <button
                className={`nav-link ${tab === 'performance' ? 'active' : ''}`}
                onClick={() => { setTab('performance'); setExternalQuery(""); }}
              >
                Performance
              </button>
            )}
          </div>
          <div className="nav-right">
            <button className="icon-btn" onClick={toggleTheme} style={{marginRight: 10}}>
              {theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}
            </button>
            <div className="user-pill">
              <div className="user-avatar-sm">{user.username[0].toUpperCase()}</div>
              <span className="user-name">{user.username}</span>
            </div>
            <button
              className="sys-btn outline"
              onClick={onLogout}
              style={{padding:'6px 12px', fontSize:12, fontWeight:700, gap:6, borderRadius:99}}
            >
              <LogOut size={14} color="var(--text-sec)"/> EXIT
            </button>
          </div>
        </div>
      </nav>
      <main className="main-scroll">
        {tab === 'overview'     && <Overview user={user} onNavigate={handleNavigation}/>}
        {tab === 'directory'    && <Directory onNavigate={handleNavigation}/>}
        {tab === 'database'     && <Explorer user={user} initialQuery={externalQuery} onNavigate={handleNavigation}/>}
        {tab === 'analysis'     && <BugAnalysis />}
        {tab === 'submit'       && <SubmitTab user={user} prefill={submitPrefill} onClearPrefill={() => setSubmitPrefill(null)}/>}
        {/* Performance only renders if user is admin — double protection */}
        {tab === 'performance'  && user.role === 'admin' && <Performance user={user}/>}
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Called when login succeeds — checks onboarding_completed from login response
  const handleLogin = (userData) => {
    setUser(userData);
    // Show onboarding only if this user has never completed it
    if (!userData.onboarding_completed) {
      setShowOnboarding(true);
    }
  };

  // Called when user finishes or skips onboarding
  const handleOnboardingComplete = async () => {
    try {
      // Flip onboarding_completed = true in the database
      await axios.post('/api/users/complete_onboarding');
    } catch (err) {
      console.error("Could not save onboarding status:", err);
    }
    // Always proceed to dashboard even if the API call fails
    setShowOnboarding(false);
  };

  // Three possible states: not logged in → onboarding → dashboard
  if (!user) {
    return <Login onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />;
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <Dashboard
      user={user}
      onLogout={() => { setUser(null); setShowOnboarding(false); }}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
}