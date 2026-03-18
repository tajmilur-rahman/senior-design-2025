import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import BugAnalysis from './Pages/BugAnalysis';
import Overview from './Pages/Overview';
import Explorer from './Pages/Explorer';
import SubmitTab from './Pages/Submit';
import Login from './Pages/Login';
import Directory from './Pages/Directory';
import Onboarding from './Pages/Onboarding';
import Performance from './Pages/Performance';
import { ShieldCheck, LogOut, Moon, Sun } from 'lucide-react';
import './App.css';
import axios from 'axios';

axios.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) config.headers.Authorization = `Bearer ${session.access_token}`;
  return config;
});

const NAV_TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'submit', label: 'Severity Analysis' },
  { id: 'performance', label: 'Performance', adminOnly: true },
  { id: 'analysis',    label: 'Analytics' },
  { id: 'directory',   label: 'Directory' },
  { id: 'database',    label: 'Database' },
];

// Role badge colours and labels
const ROLE_CONFIG = {
  admin:  { label: 'Admin',  color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  user:   { label: 'User',   color: 'var(--accent)', bg: 'var(--pill-bg)' },
};

function Dashboard({ user, onLogout, theme, toggleTheme }) {
  const [tab, setTab] = useState('overview');
  const [externalQuery, setExternalQuery] = useState('');
  const [submitPrefill, setSubmitPrefill] = useState(null);

  const handleNavigation = (targetTab, query = '', prefill = null) => {
    setTab(targetTab); setExternalQuery(query);
    if (prefill) setSubmitPrefill(prefill);
  };

  const role = ROLE_CONFIG[user?.role] || ROLE_CONFIG.user;

  return (
    <div className="app-container">
      <nav className="sys-nav">
        <div className="nav-content">
          <div className="nav-logo">
            <div style={{ width: 30, height: 30, background: 'var(--accent)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={17} color="white" />
            </div>
            Apex<span style={{ color: 'var(--accent)' }}>OS</span>
          </div>

          <div className="nav-center">
            {NAV_TABS.map(t => {
              if (t.adminOnly && user?.role !== 'admin') return null;
              return (
                <button key={t.id} className={`nav-link ${tab === t.id ? 'active' : ''}`} onClick={() => { setTab(t.id); setExternalQuery(''); }}>
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="nav-right">
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <div className="user-pill">
              <div className="user-avatar-sm">{user?.username?.[0]?.toUpperCase() || 'U'}</div>
              <span className="user-name">{user?.username || 'User'}</span>
              {/* Role badge */}
              <span style={{
                fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                background: role.bg, color: role.color,
                textTransform: 'uppercase', letterSpacing: 0.4,
              }}>
                {role.label}
              </span>
            </div>
            <button className="sys-btn outline" onClick={onLogout} style={{ padding: '5px 10px', fontSize: 11.5, fontWeight: 600, gap: 5, borderRadius: 99 }} title="Sign out">
              <LogOut size={12} color="var(--text-sec)" /> Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="main-scroll">
        {tab === 'overview'    && <Overview user={user} onNavigate={handleNavigation} />}
        {tab === 'submit'      && <SubmitTab user={user} prefill={submitPrefill} onClearPrefill={() => setSubmitPrefill(null)} />}
        {tab === 'performance' && user?.role === 'admin' && <Performance user={user} />}
        {tab === 'analysis'    && <BugAnalysis />}
        {tab === 'directory'   && <Directory onNavigate={handleNavigation} />}
        {tab === 'database'    && <Explorer user={user} initialQuery={externalQuery} onNavigate={handleNavigation} />}
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
    const initAuth = async (session) => {
      try {
        if (session) {
          const { data: dbUserList } = await supabase.from('users').select('*').eq('uuid', session.user.id);
          if (dbUserList?.length > 0) {
            const dbUser = dbUserList[0];
            setUser({ id: session.user.id, email: session.user.email, username: dbUser.username || session.user.email.split('@')[0], role: dbUser.role, company_id: dbUser.company_id });
          } else {
            setUser({ id: session.user.id, email: session.user.email, username: session.user.email.split('@')[0], role: 'user' });
          }
        } else { setUser(null); }
      } catch (err) { console.error('Auth error:', err); setUser(null); }
      finally { setLoading(false); }
    };

    supabase.auth.getSession().then(({ data: { session } }) => initAuth(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION') initAuth(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleOnboardingComplete = async () => {
    await supabase.from('users').update({ onboarding_completed: true }).eq('uuid', user.id);
    await supabase.auth.updateUser({ data: { onboarding_completed: true } });
    setShowOnboarding(false);
  };

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-sec)', fontSize: 13, gap: 10 }}>
      <ShieldCheck size={18} color="var(--accent)" /> Loading ApexOS…
    </div>
  );

  if (!user) return <Login onLogin={setUser} theme={theme} toggleTheme={toggleTheme} />;
  if (showOnboarding) return <Onboarding onComplete={handleOnboardingComplete} />;
  return <Dashboard user={user} onLogout={() => supabase.auth.signOut()} theme={theme} toggleTheme={toggleTheme} />;
}