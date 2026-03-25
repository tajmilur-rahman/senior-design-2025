import { useState, useEffect, useRef } from 'react';
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
import SuperAdmin        from './Pages/SuperAdmin';
import UserManagement    from './Pages/UserManagement';
import ResolutionSupport from './Pages/ResolutionSupport';
import PendingApproval   from './Pages/PendingApproval';
import CodeWall          from './Pages/CodeWall';
import ProfileSettings   from './Pages/ProfileSettings';
import CompanyProfile    from './Pages/CompanyProfile';
import { ShieldCheck, LogOut, Moon, Sun, Crown, Users, ChevronDown, UserCog } from 'lucide-react';
import './App.css';

axios.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) config.headers.Authorization = `Bearer ${session.access_token}`;
  return config;
});

const NAV_TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'submit',      label: 'Severity Analysis' },
  { id: 'performance', label: 'Performance', adminOnly: true },
  { id: 'analysis',    label: 'Analytics' },
  { id: 'directory',   label: 'Directory' },
  { id: 'database',    label: 'Database' },
  { id: 'resolution',  label: 'Resolution' },
  { id: 'company',     label: 'Company',     adminOnly: true },
];

const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  admin:       { label: 'Admin',       color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  user:        { label: 'User',        color: 'var(--accent)', bg: 'var(--pill-bg)' },
};

async function fetchUserRowWithRetry(uuid, maxAttempts = 6, delayMs = 600) {
  for (let i = 0; i < maxAttempts; i++) {
    const { data: rows } = await supabase.from('users').select('*').eq('uuid', uuid);
    if (rows && rows.length > 0 && rows[0].role) return rows[0];
    if (i < maxAttempts - 1) await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  try {
    await axios.get('/api/users/me/profile');
    await new Promise(resolve => setTimeout(resolve, 400));
    const { data: rows } = await supabase.from('users').select('*').eq('uuid', uuid);
    if (rows && rows.length > 0 && rows[0].role) return rows[0];
  } catch { /* ignore */ }
  return null;
}

function Dashboard({ user, onLogout, theme, toggleTheme, initialTab, onUpdateUser }) {
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
              const label = (t.id === 'company' && isSuperAdmin) ? 'System' : t.label;
              return (
                <button
                  key={t.id}
                  className={`nav-link ${tab === t.id ? 'active' : ''}`}
                  onClick={() => { setTab(t.id); setExtQ(''); }}
                  style={t.superAdminOnly ? { color: tab === t.id ? '#f59e0b' : undefined } : {}}
                >
                  {t.superAdminOnly && <Crown size={11} style={{ marginRight: 4, opacity: 0.8 }} />}
                  {label}
                </button>
              );
            })}
          </div>
          <div className="nav-right">
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <div className="user-pill-wrapper">
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
                <ChevronDown size={13} style={{ color: 'var(--text-sec)', marginLeft: 2 }} />
              </div>
              <div className="user-dropdown">
                <div className="user-dropdown-inner">
                  <button className="user-dropdown-item" onClick={() => setTab('profile')}>
                    <UserCog size={14} /> Profile Settings
                  </button>
                  {isAdmin && (
                    <button className="user-dropdown-item" onClick={() => setTab('users')}>
                      <Users size={14} /> Admin Panel
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button className="user-dropdown-item" onClick={() => setTab('superadmin')}
                      style={{ color: '#f59e0b' }}>
                      <Crown size={14} /> Super Admin Panel
                    </button>
                  )}
                  <div className="user-dropdown-divider" />
                  <button className="user-dropdown-item danger" onClick={onLogout}>
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="main-scroll">
        {tab === 'overview'    && <Overview     user={user} onNavigate={navigate} />}
        {tab === 'submit'      && <SubmitTab    user={user} prefill={submitPrefill} onClearPrefill={() => setPrefill(null)} />}
        {tab === 'performance' && isAdmin       && <Performance   user={user} />}
        {tab === 'analysis'    && <BugAnalysis />}
        {tab === 'directory'   && <Directory    onNavigate={navigate} user={user} />}
        {tab === 'database'    && <Explorer     user={user} initialQuery={externalQuery} onNavigate={navigate} />}
        {tab === 'resolution'  && <ResolutionSupport />}
        {tab === 'users'       && isAdmin       && <UserManagement currentUser={user} />}
        {tab === 'superadmin'  && isSuperAdmin  && <SuperAdmin     user={user} />}
        {tab === 'profile'                      && <ProfileSettings user={user} onUpdate={onUpdateUser} />}
        {tab === 'company'     && isAdmin       && <CompanyProfile  user={user} />}
      </main>
    </div>
  );
}

export default function App() {
  const [user,           setUser]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [forceRecoveryReset, setForceRecoveryReset] = useState(
    () => window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery')
  );
  const [initialTab,     setInitialTab]     = useState(null);
  const onboardingShownRef = useRef(false);
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
    const initAuth = async (session, opts = {}) => {
      const { event = null, fromInitialSession = false } = opts;
      try {
        if (!session) {
          setUser(null);
          setShowOnboarding(false);
          onboardingShownRef.current = false;
          return;
        }

        const uuid = session.user.id;
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
            status:               db.status || 'active',
          });
          const isCompanyAdmin = db.role === 'admin';
          if (!fromInitialSession && event === 'SIGNED_IN') {
            if (isCompanyAdmin && !db.onboarding_completed && !onboardingShownRef.current) {
              onboardingShownRef.current = true;
              setShowOnboarding(true);
            } else {
              setShowOnboarding(false);
            }
          } else {
            setShowOnboarding(false);
          }
        } else {
          setUser({
            id: uuid, uuid,
            email:    session.user.email,
            username: session.user.email?.split('@')[0],
            role: 'user', context_role: 'user',
            company_id: null, onboarding_completed: false,
          });
          setShowOnboarding(false);
        }
      } catch (err) {
        console.error('[App] initAuth:', err);
        setUser(null);
        setShowOnboarding(false);
      } finally {
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) =>
      initAuth(session, { fromInitialSession: true })
    );
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setForceRecoveryReset(true);
      }
      if (event !== 'INITIAL_SESSION') {
        initAuth(session, { event, fromInitialSession: false });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleOnboardingComplete = async (companyName, displayName, navigateTo = null, skipped = false) => {
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

    if (!skipped) {
      try {
        await supabase
          .from('users')
          .update({ onboarding_completed: true })
          .eq('uuid', user?.uuid || user?.id);
      } catch (err) {
        console.error('[App] marking onboarding complete:', err);
      }
      setUser(prev => prev ? { ...prev, onboarding_completed: true } : prev);
    }
    setShowOnboarding(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user_context_role');
    setUser(null); setShowOnboarding(false);
  };

  const handleLogin = async (loginUser) => {
    let db = null;
    try {
      db = await fetchUserRowWithRetry(loginUser.id, 3, 300);
    } catch (err) {
      console.error('[App] handleLogin DB fetch:', err);
    }

    const dbRole   = db?.role   || 'user';
    const dbStatus = db?.status || 'active';
    localStorage.setItem('user_context_role', dbRole);
    setUser({
      ...loginUser,
      id:                   loginUser.id,
      uuid:                 loginUser.id,
      username:             db?.username || loginUser.email?.split('@')[0],
      role:                 dbRole,
      context_role:         resolveContextRole(dbRole),
      status:               dbStatus,
      company_id:           db?.company_id   ?? null,
      is_admin:             db?.is_admin     ?? false,
      onboarding_completed: db?.onboarding_completed ?? false,
    });
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
      forceResetRecovery={forceRecoveryReset}
      onResetDone={() => setForceRecoveryReset(false)}
    />
  );
  if (forceRecoveryReset) return (
    <Login
      onLogin={handleLogin}
      theme={theme}
      toggleTheme={toggleTheme}
      forceResetRecovery={true}
      onResetDone={() => setForceRecoveryReset(false)}
    />
  );
  if (['pending', 'inactive', 'invite_requested'].includes(user.status)) return (
    <PendingApproval user={user} onLogout={handleLogout} status={user.status} />
  );
  if (user.status === 'pending_code') return (
    <CodeWall
      user={user}
      onLogout={handleLogout}
      onVerified={async () => {
        const db = await fetchUserRowWithRetry(user.uuid || user.id, 4, 400);
        if (db) {
          setUser(prev => ({ ...prev, ...db, status: db.status || 'active' }));
        } else {
          setUser(prev => ({ ...prev, status: 'active' }));
        }
      }}
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
      onUpdateUser={u => setUser(prev => ({ ...prev, ...u }))}
    />
  );
}
