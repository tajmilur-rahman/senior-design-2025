import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import axios from 'axios';
import BugAnalysis     from './Pages/BugAnalysis';
import Overview        from './Pages/Overview';
import Explorer        from './Pages/Explorer';
import SubmitTab       from './Pages/Submit';
import Login           from './Pages/Login';
import Directory       from './Pages/Directory';
import Onboarding      from './Pages/Onboarding';
import Performance     from './Pages/Performance';
import SuperAdmin      from './Pages/SuperAdmin';
import UserManagement  from './Pages/UserManagement';
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
  { id: 'users',       label: 'Users',         adminOnly: true },
  { id: 'superadmin',  label: 'Super Admin',   superAdminOnly: true },
];

const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  admin:       { label: 'Admin',       color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  user:        { label: 'User',        color: 'var(--accent)', bg: 'var(--pill-bg)' },
};

// ── Retry helper ──────────────────────────────────────────────────────────────
// On fresh registration the onAuthStateChange fires before /api/register has
// finished writing the public.users row. We poll up to maxAttempts times with
// a short delay until the row appears.
async function fetchUserRowWithRetry(uuid, maxAttempts = 6, delayMs = 600) {
  for (let i = 0; i < maxAttempts; i++) {
    const { data: rows } = await supabase
      .from('users')
      .select('*')
      .eq('uuid', uuid);

    // Row exists AND has a real role set (not just an auto-provisioned stub)
    if (rows && rows.length > 0 && rows[0].role) {
      return rows[0];
    }

    // Not ready yet — wait and retry
    if (i < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

function Dashboard({ user, onLogout, theme, toggleTheme, initialTab }) {
  const [tab, setTab]               = useState(initialTab || 'overview');
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
                <button
                  key={t.id}
                  className={`nav-link ${tab === t.id ? 'active' : ''}`}
                  onClick={() => { setTab(t.id); setExtQ(''); }}
                  style={t.superAdminOnly ? { color: tab === t.id ? '#f59e0b' : undefined } : {}}
                >
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
              <span style={{
                fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                background: role.bg, color: role.color,
                textTransform: 'uppercase', letterSpacing: 0.4,
              }}>
                {role.label}
              </span>
            </div>
            <button
              className="sys-btn outline"
              onClick={onLogout}
              style={{ padding: '5px 10px', fontSize: 11.5, fontWeight: 600, gap: 5, borderRadius: 99 }}
            >
              <LogOut size={12} color="var(--text-sec)" /> Sign out
            </button>
          </div>
        </div>
      </nav>
      <main className="main-scroll">
        {tab === 'overview'    && <Overview     user={user} onNavigate={navigate} />}
        {tab === 'submit'      && <SubmitTab    user={user} prefill={submitPrefill} onClearPrefill={() => setPrefill(null)} />}
        {tab === 'performance' && isAdmin       && <Performance   user={user} />}
        {tab === 'analysis'    && <BugAnalysis />}
        {tab === 'directory'   && <Directory    onNavigate={navigate} />}
        {tab === 'database'    && <Explorer     user={user} initialQuery={externalQuery} onNavigate={navigate} />}
        {tab === 'users'       && isAdmin       && <UserManagement currentUser={user} />}
        {tab === 'superadmin'  && isSuperAdmin  && <SuperAdmin     user={user} />}
      </main>
    </div>
  );
}

export default function App() {
  const [user,           setUser]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [initialTab,     setInitialTab]     = useState(null);
  const [theme,          setTheme]          = useState(localStorage.getItem('theme') || 'dark');
  const [loginError,     setLoginError]     = useState(null);

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

        const uuid = session.user.id;

        // Use the retry helper — this handles the race condition where
        // onAuthStateChange fires before /api/register finishes writing the
        // public.users row on first registration.
        const db = await fetchUserRowWithRetry(uuid);

        if (db) {
          setUser({
            id:                   uuid,
            uuid:                 uuid,
            email:                session.user.email || db.email,
            username:             db.username || session.user.email?.split('@')[0],
            role:                 db.role || 'user',
            context_role:         resolveContextRole(db.role || 'user'),
            company_id:           db.company_id,
            is_admin:             db.is_admin || false,
            onboarding_completed: db.onboarding_completed || false,
          });
          // Show onboarding only on first ever login
          setShowOnboarding(!db.onboarding_completed);
        } else {
          // Row still not found after all retries — show onboarding
          // which will handle linking the user to a company
          setUser({
            id: uuid, uuid,
            email:    session.user.email,
            username: session.user.email?.split('@')[0],
            role: 'user', context_role: 'user',
            company_id: null, onboarding_completed: false,
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

  const handleOnboardingComplete = async (companyName, displayName, navigateTo = null) => {
    if (navigateTo) setInitialTab(navigateTo);
    if (companyName) {
      try {
        const res = await axios.post('/api/onboarding/complete', {
          company_name: companyName,
          username:     displayName || user?.username,
        });
        if (res.data?.user) {
          const u = res.data.user;
          setUser(prev => ({
            ...prev,
            username:             u.username,
            role:                 u.role,
            company_id:           u.company_id,
            onboarding_completed: true,
          }));
        }
      } catch (err) {
        console.error('[App] onboarding complete:', err);
      }
    }

    // Always mark done in DB so the onboarding never shows again
    try {
      await supabase
        .from('users')
        .update({ onboarding_completed: true })
        .eq('uuid', user?.uuid || user?.id);
    } catch (err) {
      console.error('[App] marking onboarding complete:', err);
    }

    setUser(prev => prev ? { ...prev, onboarding_completed: true } : prev);
    setShowOnboarding(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user_context_role');
    setUser(null); setShowOnboarding(false);
  };

  const handleLogin = async (loginUser, selectedRole) => {
    setLoginError(null);

    // Read the authoritative role from DB — don't trust the JWT claim
    let dbRole = 'user';
    try {
      const db = await fetchUserRowWithRetry(loginUser.id, 3, 300);
      dbRole = db?.role || 'user';
    } catch (err) {
      console.error('[App] handleLogin role fetch:', err);
    }

    const isSuperAdmin = dbRole === 'super_admin';

    // Super admins can context-switch freely
    if (isSuperAdmin) {
      const contextRole = selectedRole || dbRole;
      localStorage.setItem('user_context_role', contextRole);
      setUser({ ...loginUser, role: dbRole, context_role: contextRole });
      return;
    }

    // Non-super-admins: selected context must match DB role
    if (selectedRole && selectedRole !== dbRole) {
      await supabase.auth.signOut();
      setLoginError({ selected: selectedRole, actual: dbRole });
      return;
    }

    localStorage.setItem('user_context_role', dbRole);
    setUser({ ...loginUser, role: dbRole, context_role: dbRole });
  };

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  if (loading) return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)',
      flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: 13, color: 'var(--text-sec)', fontWeight: 600 }}>
        Loading ApexOS…
      </span>
    </div>
  );

  if (!user) return (
    <Login
      onLogin={handleLogin}
      theme={theme}
      toggleTheme={toggleTheme}
      roleError={loginError}
      onClearRoleError={() => setLoginError(null)}
    />
  );
  if (showOnboarding) return (
    <Onboarding onComplete={handleOnboardingComplete} user={user} />
  );
  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
      theme={theme}
      toggleTheme={toggleTheme}
      initialTab={initialTab}
    />
  );
}