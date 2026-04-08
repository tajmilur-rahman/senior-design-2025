import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import axios from 'axios';
import BugAnalysis     from './Pages/BugAnalysis';
import Overview        from './Pages/Overview';
import Explorer        from './Pages/Explorer';
import SubmitTab       from './Pages/Submit';
import Login           from './Pages/Login';
import Directory       from './Pages/Directory';
import Landing         from './Pages/Landing';
import Onboarding      from './Pages/Onboarding';
import Performance     from './Pages/Performance';
import SuperAdmin        from './Pages/SuperAdmin';
import UserManagement    from './Pages/UserManagement';
import ResolutionSupport from './Pages/ResolutionSupport';
import PendingApproval   from './Pages/PendingApproval';
import CodeWall          from './Pages/CodeWall';
import ProfileSettings   from './Pages/ProfileSettings';
import CompanyProfile    from './Pages/CompanyProfile';
import { LogOut, Crown, Users, ChevronDown, ChevronLeft, UserCog, BrainCircuit, CheckCircle, X, AlertTriangle, Bell, Sun, Moon } from 'lucide-react';
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


async function fetchUserRowWithRetry(uuid, maxAttempts = 6, delayMs = 600) {
  for (let i = 0; i < maxAttempts; i++) {
    const { data: rows } = await supabase.from('users').select('*').eq('uuid', uuid);
    if (rows && rows.length > 0 && rows[0].role) {
      let apiProfile = {};
      try {
        const res = await axios.get('/api/users/me/profile');
        apiProfile = res.data || {};
      } catch {}
      return { ...rows[0], _apiProfile: apiProfile };
    }
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

// ── Global training status banner ────────────────────────────────────────────
function TrainingBanner({ job, onDismiss, onViewResults }) {
  if (!job.key) return null;
  const isDone  = job.done && !job.error;
  const isError = job.done && job.error;
  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[9998] w-full max-w-md mx-auto px-4`}>
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl text-sm font-semibold transition-all
        ${isDone  ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
        : isError ? 'bg-red-950/90 border-red-500/30 text-red-300'
                  : 'bg-[#0d0d1a]/95 border-blue-500/30 text-white'}`}>
        {/* Icon */}
        {isDone  ? <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
        : isError ? <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                  : <BrainCircuit size={16} className="text-blue-400 flex-shrink-0 animate-pulse" />}
        {/* Text + bar */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <span className="truncate">
              {isDone  ? 'Model training complete'
              : isError ? `Training failed: ${job.error}`
                        : job.step || 'Training in progress…'}
            </span>
            {!job.done && <span className="text-white/50 font-mono text-xs ml-2 flex-shrink-0">{job.pct}%</span>}
          </div>
          {!job.done && (
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${job.pct}%` }} />
            </div>
          )}
        </div>
        {/* Actions */}
        {isDone && (
          <button onClick={onViewResults}
            className="flex-shrink-0 px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-xs font-bold text-emerald-300 transition-all">
            View Results
          </button>
        )}
        {job.done && (
          <button onClick={onDismiss} className="flex-shrink-0 text-white/30 hover:text-white transition-colors ml-1">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function Dashboard({ user, onLogout, initialTab, onUpdateUser }) {
  const [tab, setTab]               = useState(initialTab || 'overview');
  const [previousTab, setPreviousTab] = useState(null);
  const [externalQuery, setExtQ]    = useState('');
  const [submitPrefill, setPrefill] = useState(null);
  const [extFilters,    setExtFilters] = useState(null);
  const [trainingJob,   setTrainingJob] = useState({ key: null, step: '', pct: 0, done: false, error: null });
  const [perfRefreshKey, setPerfRefreshKey] = useState(0);
  const pollRef = useRef(null);

  const [theme, setTheme] = useState(() => localStorage.getItem('spotfixes_theme') || 'dark');
  const toggleTheme = () => setTheme(t => {
    const next = t === 'dark' ? 'light' : 'dark';
    localStorage.setItem('spotfixes_theme', next);
    return next;
  });

  // Sync to document.body so createPortal elements (modals, inspector) also get themed
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    return () => document.body.removeAttribute('data-theme'); // cleanup on logout
  }, [theme]);

  const navigate = (targetTab, query = '', prefill = null, filters = null) => {
    setTab(prev => { setPreviousTab(prev); return targetTab; });
    setExtQ(query);
    if (prefill) setPrefill(prefill);
    setExtFilters(filters || null);
  };

  const goBack = () => {
    if (previousTab) {
      const dest = previousTab;
      setPreviousTab(null);
      setTab(dest);
      setExtQ('');
      setExtFilters(null);
    }
  };

  // Start global polling when a training key is registered
  const handleTrainStart = useCallback((key) => {
    setTrainingJob({ key, step: 'Initializing…', pct: 0, done: false, error: null });
  }, []);

  useEffect(() => {
    if (!trainingJob.key || trainingJob.done) return;
    let elapsed = 0;
    pollRef.current = setInterval(async () => {
      elapsed += 1;
      if (elapsed > 600) {
        clearInterval(pollRef.current);
        setTrainingJob(j => ({ ...j, done: true, error: 'Timed out after 10 minutes.' }));
        return;
      }
      try {
        const s = await axios.get(`/api/admin/model/train/status?stream_key=${trainingJob.key}`);
        const d = s.data;
        if (d.done) {
          clearInterval(pollRef.current);
          if (!d.error) setPerfRefreshKey(k => k + 1);
        }
        setTrainingJob(j => ({ ...j, step: d.step || j.step, pct: d.pct || j.pct,
          done: d.done, error: d.done && d.error ? d.error : null }));
      } catch { /* transient — keep polling */ }
    }, 1000);
    return () => clearInterval(pollRef.current);
  }, [trainingJob.key, trainingJob.done]);

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin      = isSuperAdmin || user?.role === 'admin';

  // Pending approval notifications
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    const fetchPending = async () => {
      try {
        const endpoint = isSuperAdmin ? '/api/superadmin/pending' : '/api/admin/users/pending';
        const res = await axios.get(endpoint);
        const data = res.data || [];
        setPendingCount(Array.isArray(data) ? data.length : 0);
      } catch { setPendingCount(0); }
    };
    fetchPending();
    const iv = setInterval(fetchPending, 30000);
    return () => clearInterval(iv);
  }, [isAdmin, isSuperAdmin]);

  return (
    <div className="app-container bg-black text-white min-h-screen selection:bg-white/20 font-sans relative overflow-hidden" data-theme={theme}>
      {/* Ambient Dashboard Background Glow */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-black to-black pointer-events-none" />
      
      <nav className="fixed top-0 left-0 right-0 z-50 w-full bg-black/10 backdrop-blur-xl border-b border-white/10 transition-all">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">

          {/* Brand — left */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={goBack}
              disabled={!previousTab}
              className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all ${
                previousTab
                  ? 'bg-white/5 border-white/10 hover:bg-white/15 hover:border-white/20 cursor-pointer'
                  : 'bg-transparent border-white/5 cursor-not-allowed opacity-30'
              }`}
              title={previousTab ? `Back to ${previousTab}` : 'No previous page'}
            >
              <ChevronLeft size={15} className="text-white/70" />
            </button>
            <div className="flex items-center cursor-pointer" onClick={() => navigate('overview')}>
              <span className="text-xl font-bold tracking-tight text-white">
                Spot<span className="text-zinc-500">fixes</span>
              </span>
            </div>
          </div>

          {/* Nav pills — flex-1 center column, pills themselves centered inside */}
          <div className="flex-1 flex justify-center">
            <div className="hidden md:flex items-center gap-0.5 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 p-1">
              {NAV_TABS.map(t => {
                if (t.superAdminOnly && !isSuperAdmin) return null;
                if (t.adminOnly      && !isAdmin)      return null;
                const label = (t.id === 'company' && isSuperAdmin) ? 'System' : t.label;
                return (
                  <button
                    key={t.id}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 flex items-center whitespace-nowrap ${
                      tab === t.id
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                    onClick={() => navigate(t.id)}
                  >
                    {t.superAdminOnly && <Crown size={11} className="mr-1.5 opacity-80" />}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User pill — right */}
          <div className="flex-shrink-0 flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {/* Notification bell — admins only */}
            {isAdmin && (
              <button
                onClick={() => navigate(isSuperAdmin ? 'superadmin' : 'users')}
                className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                title={pendingCount > 0 ? `${pendingCount} pending approval${pendingCount > 1 ? 's' : ''}` : 'Notifications'}
              >
                <Bell size={15} className={pendingCount > 0 ? 'text-amber-400' : 'text-white/50'} />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[9px] font-bold text-black flex items-center justify-center">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>
            )}
            <div className="group relative">
              <div className="flex items-center gap-2 px-1 pr-3 py-1 bg-white/5 border border-white/10 rounded-full cursor-pointer hover:bg-white/10 transition-all">
                <div className="w-7 h-7 bg-white text-black text-xs font-bold flex items-center justify-center rounded-full">
                  {(user?.username || 'U')[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium text-white hidden sm:block truncate max-w-[8rem]">
                  {user?.username || 'User'}
                </span>
                <ChevronDown size={14} className="text-white/50" />
              </div>
              
              <div className="absolute right-0 top-full pt-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50">
                <div className="w-56 max-w-[calc(100vw-1rem)] bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-1">
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white rounded-xl transition-colors" onClick={() => navigate('profile')}>
                    <UserCog size={14} /> Profile Settings
                  </button>
                  {isAdmin && !isSuperAdmin && (
                    <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white rounded-xl transition-colors" onClick={() => navigate('users')}>
                      <Users size={14} /> Admin Panel
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-amber-500 hover:bg-white/10 rounded-xl transition-colors" onClick={() => navigate('superadmin')}>
                      <Crown size={14} /> Super Admin Panel
                    </button>
                  )}
                  <div className="h-px bg-white/10 my-1 mx-2" />
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-colors" onClick={onLogout}>
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </nav>
      <main className="main-scroll pt-24 relative z-10">
        {tab === 'overview'    && <Overview     user={user} onNavigate={navigate} />}
        {tab === 'submit'      && <SubmitTab    user={user} prefill={submitPrefill} onClearPrefill={() => setPrefill(null)} />}
        {tab === 'performance' && isAdmin       && <Performance key={`perf-${perfRefreshKey}`} user={user} onTrainStart={handleTrainStart} />}
        {tab === 'analysis'    && <BugAnalysis  user={user} />}
        {tab === 'directory'   && <Directory    onNavigate={navigate} user={user} />}
        {tab === 'database'    && <Explorer     user={user} initialQuery={externalQuery} initialFilters={extFilters} onNavigate={navigate} />}
        {tab === 'resolution'  && <ResolutionSupport />}
        {tab === 'users'       && isAdmin       && <UserManagement currentUser={user} />}
        {tab === 'superadmin'  && isSuperAdmin  && <SuperAdmin     user={user} />}
        {tab === 'profile'                      && <ProfileSettings user={user} onUpdate={onUpdateUser} />}
        {tab === 'company'     && isAdmin       && <CompanyProfile  user={user} />}
      </main>

      <TrainingBanner
        job={trainingJob}
        onDismiss={() => setTrainingJob({ key: null, step: '', pct: 0, done: false, error: null })}
        onViewResults={() => { 
          navigate('performance'); 
          setPerfRefreshKey(k => k + 1);
          setTrainingJob(j => ({ ...j, key: null })); 
        }}
      />
    </div>
  );
}

export default function App() {
  const [user,           setUser]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [forceRecoveryReset, setForceRecoveryReset] = useState(
    () => window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery')
  );
  const [showLogin,      setShowLogin]      = useState(false);
  const [initialTab,     setInitialTab]     = useState(null);

  const resolveContextRole = (dbRole) => {
    const saved = localStorage.getItem('user_context_role');
    if (dbRole === 'super_admin') {
      return ['user', 'admin', 'super_admin'].includes(saved) ? saved : 'super_admin';
    }
    return dbRole || 'user';
  };

  useEffect(() => {
    const initAuth = async (session, opts = {}) => {
      const { event = null, fromInitialSession = false } = opts;
      try {
        if (!session) {
          setUser(null);
          return;
        }

        // On the initial page load, only auto-login if the user explicitly
        // logged in during this browser session (tab hasn't been closed/reopened).
        // This prevents the app from jumping straight to Dashboard after a
        // server restart or when a user first opens the app.
        if (fromInitialSession && !sessionStorage.getItem('apex_session_active')) {
          setUser(null);
          setLoading(false);
          return;
        }

        const uuid = session.user.id;
        const db = await fetchUserRowWithRetry(uuid);

        let companyName = db?._apiProfile?.company_name || null;
        let dataTable = null;
        if (db && db.company_id) {
          try {
            const { data: co } = await supabase.from('companies').select('name, data_table').eq('id', db.company_id).single();
            if (co) {
              companyName = co.name || companyName;
              dataTable = co.data_table;
            }
          } catch {}
        }

        if (db) {
          setUser({
            id:                   uuid,
            uuid:                 uuid,
            email:                session.user.email || db.email,
            username:             db.username || session.user.email?.split('@')[0],
            company_name:         companyName,
            data_table:           dataTable,
            role:                 db.role || 'user',
            context_role:         resolveContextRole(db.role || 'user'),
            company_id:           db.company_id,
            is_admin:             db.is_admin || false,
            onboarding_completed: db.onboarding_completed || false,
            status:               db.status || 'active',
          });
          if (event === 'SIGNED_IN') {
            sessionStorage.setItem('apex_session_active', 'true');
          }
        } else {
          setUser({
            id: uuid, uuid,
            email:    session.user.email,
            username: session.user.email?.split('@')[0],
            role: 'user', context_role: 'user',
            company_id: null, onboarding_completed: false,
            company_name: null,
            data_table: null,
          });
        }
      } catch (err) {
        console.error('[App] initAuth:', err);
        setUser(null);
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
    // Persist locally so it never re-shows, even if DB lags or session re-reads
    const localKey = `sf_onboarded_${user?.uuid || user?.id}`;
    localStorage.setItem(localKey, '1');
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
            company_name:         companyName || prev?.company_name,
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
        
        setUser(prev => prev ? { ...prev, onboarding_completed: true } : prev);
      } catch (err) {
        console.error('[App] marking onboarding complete:', err);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user_context_role');
    sessionStorage.removeItem('apex_session_active');
    setUser(null);
  };

  const handleLogin = async (loginUser) => {
    let db = null;
    try {
      // Increased retry delay to gracefully handle the DB role assignment lag during first-time registration
      db = await fetchUserRowWithRetry(loginUser.id, 6, 500);
    } catch (err) {
      console.error('[App] handleLogin DB fetch:', err);
    }

    let companyName = db?._apiProfile?.company_name || null;
    let dataTable = null;
    if (db && db.company_id) {
      try {
        const { data: co } = await supabase.from('companies').select('name, data_table').eq('id', db.company_id).single();
        if (co) {
          companyName = co.name || companyName;
          dataTable = co.data_table;
        }
      } catch {}
    }

    const dbRole   = db?.role   || 'user';
    const dbStatus = db?.status || 'active';
    localStorage.setItem('user_context_role', dbRole);
    sessionStorage.setItem('apex_session_active', 'true');
    setUser({
      ...loginUser,
      id:                   loginUser.id,
      uuid:                 loginUser.id,
      username:             db?.username || loginUser.email?.split('@')[0],
      company_name:         companyName,
      data_table:           dataTable,
      role:                 dbRole,
      context_role:         resolveContextRole(dbRole),
      status:               dbStatus,
      company_id:           db?.company_id   ?? null,
      is_admin:             db?.is_admin     ?? false,
      onboarding_completed: db?.onboarding_completed ?? false,
    });
  };

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-black">
      <div className="w-9 h-9 rounded-full border-2 border-white/10 border-t-white animate-spin" />
      <span className="text-sm text-white/40 font-semibold tracking-wide">Loading Spotfixes…</span>
    </div>
  );

  if (!user) {
    if (showLogin) {
      return (
        <Login
           onLogin={handleLogin}
           forceResetRecovery={forceRecoveryReset}
           onResetDone={() => setForceRecoveryReset(false)}
           onBack={() => setShowLogin(false)}
        />
      );
    }
    return <Landing onEnterWorkspace={() => setShowLogin(true)} />;
  }
  if (forceRecoveryReset) return (
    <Login
      onLogin={handleLogin}
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
  const _onboardLocalKey = `sf_onboarded_${user?.uuid || user?.id}`;
  const _onboardingDone  = user.onboarding_completed
    || !!user.company_id                             // already in a company → setup complete
    || !!localStorage.getItem(_onboardLocalKey);     // completed in a previous session
  if (user && user.role === 'admin' && !_onboardingDone) return (
    <Onboarding onComplete={handleOnboardingComplete} user={user} />
  );
  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
      initialTab={initialTab}
      onUpdateUser={u => setUser(prev => ({ ...prev, ...u }))}
    />
  );
}
