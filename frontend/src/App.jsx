import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import axios from 'axios';
import BugAnalysis  from './Pages/BugAnalysis';
import Overview     from './Pages/Overview';
import Explorer     from './Pages/Explorer';
import SubmitTab    from './Pages/Submit';
import Login        from './Pages/Login';
import Directory    from './Pages/Directory';
import Onboarding   from './Pages/Onboarding';
import Performance  from './Pages/Performance';
import SuperAdmin   from './Pages/SuperAdmin';
import { ShieldCheck, LogOut, Moon, Sun, Crown } from 'lucide-react';
import './App.css';

axios.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) config.headers.Authorization = `Bearer ${session.access_token}`;
  return config;
});

const NAV_TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'submit',      label: 'Severity Analysis' },
  { id: 'performance', label: 'Performance',  adminOnly: true },
  { id: 'analysis',    label: 'Analytics' },
  { id: 'directory',   label: 'Directory' },
  { id: 'database',    label: 'Database' },
  { id: 'superadmin',  label: 'Super Admin', superAdminOnly: true },
];

const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  admin:       { label: 'Admin',       color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  user:        { label: 'User',        color: 'var(--accent)', bg: 'var(--pill-bg)' },
};

function Dashboard({ user, onLogout, theme, toggleTheme }) {
  const [tab, setTab]               = useState('overview');
  const [externalQuery, setExtQ]    = useState('');
  const [submitPrefill, setPrefill] = useState(null);

  const navigate = (targetTab, query = '', prefill = null) => {
    setTab(targetTab); setExtQ(query);
    if (prefill) setPrefill(prefill);
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin      = isSuperAdmin || user?.role === 'admin';
  const role         = ROLE_CONFIG[user?.role] || ROLE_CONFIG.user;

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
              if (t.superAdminOnly && !isSuperAdmin) return null;
              if (t.adminOnly      && !isAdmin)      return null;
              return (
                <button key={t.id}
                  className={`nav-link ${tab === t.id ? 'active' : ''}`}
                  onClick={() => { setTab(t.id); setExtQ(''); }}
                  style={t.superAdminOnly ? { color: tab === t.id ? '#f59e0b' : undefined } : {}}>
                  {t.superAdminOnly && <Crown size={11} style={{ marginRight: 4, opacity: 0.8 }} />}
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
              <div className="user-avatar-sm">{(user?.username || 'U')[0].toUpperCase()}</div>
              <span className="user-name">{user?.username || 'User'}</span>
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: role.bg, color: role.color, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {role.label}
              </span>
            </div>
            <button className="sys-btn outline" onClick={onLogout}
              style={{ padding: '5px 10px', fontSize: 11.5, fontWeight: 600, gap: 5, borderRadius: 99 }}>
              <LogOut size={12} color="var(--text-sec)" /> Sign out
            </button>
          </div>
        </div>
      </nav>
      <main className="main-scroll">
        {tab === 'overview'    && <Overview   user={user} onNavigate={navigate} />}
        {tab === 'submit'      && <SubmitTab  user={user} prefill={submitPrefill} onClearPrefill={() => setPrefill(null)} />}
        {tab === 'performance' && isAdmin      && <Performance user={user} />}
        {tab === 'analysis'    && <BugAnalysis />}
        {tab === 'directory'   && <Directory  onNavigate={navigate} />}
        {tab === 'database'    && <Explorer   user={user} initialQuery={externalQuery} onNavigate={navigate} />}
        {tab === 'superadmin'  && isSuperAdmin && <SuperAdmin user={user} />}
      </main>
    </div>
  );
}

export default function App() {
  const [user,           setUser]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [theme,          setTheme]          = useState(localStorage.getItem('theme') || 'dark');

  const resolveContextRole = (dbRole) => {
    const saved = localStorage.getItem('user_context_role');
    if (dbRole === 'super_admin') {
      return ['user', 'admin', 'super_admin'].includes(saved) ? saved : 'super_admin';
    }
    return dbRole || 'user';
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const initAuth = async (session) => {
      try {
        if (!session) { setUser(null); return; }

        const { data: rows } = await supabase
          .from('users').select('*').eq('uuid', session.user.id);

        if (rows && rows.length > 0) {
          const db = rows[0];
          setUser({
            id: session.user.id, uuid: session.user.id,
            email:    session.user.email || db.email,
            username: db.username || session.user.email?.split('@')[0],
            role:     db.role || 'user',
            context_role: resolveContextRole(db.role || 'user'),
            company_id:           db.company_id,
            is_admin:             db.is_admin || false,
            onboarding_completed: db.onboarding_completed || false,
          });
          setShowOnboarding(!db.company_id || !db.onboarding_completed);
        } else {
          setUser({
            id: session.user.id, uuid: session.user.id,
            email: session.user.email,
            username: session.user.email?.split('@')[0],
            role: 'user', context_role: 'user', company_id: null, onboarding_completed: false,
          });
          setShowOnboarding(true);
        }
      } catch (err) {
        console.error('[App] initAuth:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => initAuth(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION') initAuth(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleOnboardingComplete = async (companyName, displayName) => {
    try {
      const res = await axios.post('/api/onboarding/complete', {
        company_name: companyName,
        username:     displayName || user?.username,
      });
      if (res.data?.user) {
        const u = res.data.user;
        setUser(prev => ({ ...prev, username: u.username, role: u.role, company_id: u.company_id, onboarding_completed: true }));
      }
    } catch (err) {
      console.error('[App] onboarding complete:', err);
      setUser(prev => ({ ...prev, onboarding_completed: true }));
    }
    setShowOnboarding(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user_context_role');
    setUser(null); setShowOnboarding(false);
  };

  const handleLogin = (loginUser, selectedRole) => {
    const contextRole = selectedRole || 'user';
    const enrichedUser = { ...loginUser, role: contextRole, context_role: contextRole };
    localStorage.setItem('user_context_role', contextRole);
    setUser(enrichedUser);
  };

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 13, color: 'var(--text-sec)', fontWeight: 600 }}>Loading ApexOS…</span>
    </div>
  );

  if (!user)          return <Login      onLogin={handleLogin}                theme={theme} toggleTheme={toggleTheme} />;
  if (showOnboarding) return <Onboarding onComplete={handleOnboardingComplete} user={user} />;
  return                     <Dashboard  user={user} onLogout={handleLogout}  theme={theme} toggleTheme={toggleTheme} />;
}