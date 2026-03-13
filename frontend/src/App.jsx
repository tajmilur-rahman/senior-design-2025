import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
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
import axios from 'axios';

// Axios Interceptor for Backend Auth
axios.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

function Dashboard({ user, onLogout, theme, toggleTheme }) {
  const [tab, setTab] = useState('overview');
  const [externalQuery, setExternalQuery] = useState("");
  const [submitPrefill, setSubmitPrefill] = useState(null);

  console.log("Current User Role:", user?.role);

  const handleNavigation = (targetTab, query = "", prefill = null) => {
    setTab(targetTab);
    setExternalQuery(query);
    if (prefill) setSubmitPrefill(prefill);
  };

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
            {baseTabs.map(t => (
              <button
                key={t}
                className={`nav-link ${tab === t.toLowerCase() ? 'active' : ''}`}
                onClick={() => { setTab(t.toLowerCase()); setExternalQuery(""); }}
              >
                {t}
              </button>
            ))}
            {/* Safe Role Check */}
            {user?.role === 'admin' && (
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
              {/* FIX: Optional chaining added here to prevent 'undefined' crash */}
              <div className="user-avatar-sm">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="user-name">{user?.username || 'User'}</span>
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
        {tab === 'performance'  && user?.role === 'admin' && <Performance user={user}/>}
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      console.log("DEBUG: Checking DB for UUID:", session.user.id);

      const { data: dbUserList, error } = await supabase
        .from('users')
        .select('*')
        .eq('uuid', session.user.id);

      if (error) console.error("DB Error:", error.message);

      if (dbUserList && dbUserList.length > 0) {
        const dbUser = dbUserList[0];
        console.log("DEBUG: Found User in DB! Role is:", dbUser.role);

        const currentUser = {
          id: session.user.id,
          email: session.user.email,
          username: dbUser.username || session.user.email.split('@')[0], 
          role: dbUser.role // THIS must be 'admin'
        };
        setUser(currentUser);
      } else {
        console.log("DEBUG: No row found in 'users' table for this UUID.");
        // Fallback for new users
        setUser({
          id: session.user.id,
          email: session.user.email,
          username: session.user.email.split('@')[0],
          role: 'user'
        });
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  });
  return () => subscription.unsubscribe();
}, []);

  const handleOnboardingComplete = async () => {
    // 1. Update DB
    await supabase.from('users').update({ onboarding_completed: true }).eq('uuid', user.id);
    // 2. Update Auth Metadata
    await supabase.auth.updateUser({
      data: { onboarding_completed: true }
    });
    setShowOnboarding(false);
  };

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  if (loading) return <div className="loading-screen">INITIALIZING APEX OS...</div>;

  if (!user) {
    return <Login onLogin={setUser} theme={theme} toggleTheme={toggleTheme} />;
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <Dashboard
      user={user}
      onLogout={() => supabase.auth.signOut()}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
}