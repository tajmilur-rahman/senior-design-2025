import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { supabase } from './supabaseClient';
import axios from 'axios';
import Login           from './Pages/Login';
import Landing         from './Pages/Landing';
import PendingApproval   from './Pages/PendingApproval';
import CodeWall          from './Pages/CodeWall';
const BugAnalysis     = lazy(() => import('./Pages/BugAnalysis'));
const Overview        = lazy(() => import('./Pages/Overview'));
const Explorer        = lazy(() => import('./Pages/Explorer'));
const SubmitTab       = lazy(() => import('./Pages/Submit'));
const Directory       = lazy(() => import('./Pages/Directory'));
const Onboarding      = lazy(() => import('./Pages/Onboarding'));
const Performance     = lazy(() => import('./Pages/Performance'));
const SuperAdmin      = lazy(() => import('./Pages/SuperAdmin'));
const UserManagement  = lazy(() => import('./Pages/UserManagement'));
const ResolutionSupport = lazy(() => import('./Pages/ResolutionSupport'));
const ProfileSettings = lazy(() => import('./Pages/ProfileSettings'));
const CompanyProfile  = lazy(() => import('./Pages/CompanyProfile'));
import { LogOut, Crown, Users, ChevronDown, ChevronUp, UserCog, BrainCircuit, CheckCircle, X, AlertTriangle, Bell, Sun, Moon, Menu, PanelLeft, PanelTop, LayoutDashboard, FlaskConical, Gauge, BarChart3, BookUser, Database, ShieldCheck, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import { AnimatedNavFramer } from './navigation-menu';
import ErrorBoundary from './Components/ErrorBoundary';

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--accent)' }} />
  </div>
);

axios.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) config.headers.Authorization = `Bearer ${session.access_token}`;
  return config;
});

const NAV_TABS = [
  { id: 'overview',    label: 'Overview',          icon: LayoutDashboard },
  { id: 'submit',      label: 'Bug Ingestion',     icon: FlaskConical },
  { id: 'performance', label: 'Performance',       icon: Gauge,          adminOnly: true },
  { id: 'analysis',    label: 'Severity Analysis', icon: BarChart3 },
  { id: 'resolution',  label: 'Analytics',         icon: ShieldCheck },
  { id: 'directory',   label: 'Directory',         icon: BookUser },
  { id: 'database',    label: 'Database',          icon: Database },
  { id: 'company',     label: 'Company',           icon: Building2,      adminOnly: true, hideForSystemLevel: true },
];

const sidebarVariants = {
  expanded: { width: "16rem", transition: { type: "spring", damping: 20, stiffness: 250, staggerChildren: 0.05 } },
  collapsed: { width: "5rem", transition: { type: "spring", damping: 20, stiffness: 250, staggerChildren: 0.05, staggerDirection: -1, when: "afterChildren" } }
};

const sidebarTextVariants = {
  expanded: { opacity: 1, width: "auto", display: "block", transition: { duration: 0.2 } },
  collapsed: { opacity: 0, width: 0, transition: { duration: 0.2 }, transitionEnd: { display: "none" } }
};

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
                  : 'border-blue-500/30'}`}
        style={!isDone && !isError ? { background: 'var(--bg-elevated)', color: 'var(--text-main)' } : {}}>
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
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${job.pct}%`, background: 'var(--accent)' }} />
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
  const [isSidebarExpanded, setSidebarExpanded] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState(null);
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

  // Nav orientation — user-selectable horizontal (default) or vertical sidebar.
  const [navOrientation, setNavOrientation] = useState(
    () => localStorage.getItem('spotfixes_nav_orientation') || 'horizontal'
  );
  const toggleNavOrientation = () => setNavOrientation(o => {
    const next = o === 'horizontal' ? 'vertical' : 'horizontal';
    localStorage.setItem('spotfixes_nav_orientation', next);
    return next;
  });

  // Click-based avatar menu (replaces hover-only). Closes on ESC / outside click.
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef(null);
  const mobileAvatarMenuRef = useRef(null);
  
  useEffect(() => {
    if (!avatarMenuOpen) return;
    const onDown = (e) => {
      const clickedDesktop = avatarMenuRef.current && avatarMenuRef.current.contains(e.target);
      const clickedMobile  = mobileAvatarMenuRef.current && mobileAvatarMenuRef.current.contains(e.target);
      if (!clickedDesktop && !clickedMobile) {
        setAvatarMenuOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setAvatarMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [avatarMenuOpen]);

  // Click-based avatar menu for the Vertical Sidebar (pops up). Closes on ESC / outside click.
  const [sidebarAvatarMenuOpen, setSidebarAvatarMenuOpen] = useState(false);
  const sidebarAvatarMenuRef = useRef(null);
  useEffect(() => {
    if (!sidebarAvatarMenuOpen) return;
    const onDown = (e) => {
      if (sidebarAvatarMenuRef.current && !sidebarAvatarMenuRef.current.contains(e.target)) {
        setSidebarAvatarMenuOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setSidebarAvatarMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [sidebarAvatarMenuOpen]);

  // Mobile nav drawer
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMobileNavOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  const navigate = (targetTab, query = '', prefill = null, filters = null) => {
    setTab(prev => { setPreviousTab(prev); return targetTab; });
    setExtQ(query);
    setPrefill(prefill || null);
    setExtFilters(filters || null);
    setMobileNavOpen(false);
    setAvatarMenuOpen(false);
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
    let interval = 1000;
    const MAX_INTERVAL = 5000;
    const MAX_ELAPSED_MS = 600000; // 10 minutes

    const poll = async () => {
      elapsed += interval;
      if (elapsed > MAX_ELAPSED_MS) {
        setTrainingJob(j => ({ ...j, done: true, error: 'Timed out after 10 minutes.' }));
        return;
      }
      try {
        const s = await axios.get(`/api/admin/model/train/status?stream_key=${trainingJob.key}`);
        const d = s.data;
        if (d.done) {
          if (!d.error) setPerfRefreshKey(k => k + 1);
          setTrainingJob(j => ({ ...j, step: d.step || j.step, pct: d.pct || j.pct, done: true, error: d.error || null }));
          return;
        }
        setTrainingJob(j => ({ ...j, step: d.step || j.step, pct: d.pct || j.pct }));
        interval = Math.min(interval * 1.5, MAX_INTERVAL);
      } catch {
        interval = Math.min(interval * 2, MAX_INTERVAL);
      }
      pollRef.current = setTimeout(poll, interval);
    };

    pollRef.current = setTimeout(poll, interval);
    return () => clearTimeout(pollRef.current);
  }, [trainingJob.key, trainingJob.done]);

  const isSuperAdmin  = user?.role === 'super_admin';
  const isDeveloper   = user?.role === 'developer';
  const isSystemLevel = isSuperAdmin || isDeveloper;
  const isAdmin       = isSystemLevel || user?.role === 'admin';

  const visibleTabs = NAV_TABS.filter(t => {
    if (t.superAdminOnly && !isSuperAdmin)  return false;
    if (t.adminOnly      && !isAdmin)       return false;
    if (t.hideForSystemLevel && isSystemLevel) return false;
    return true;
  });

  // Pending approval notifications
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    const fetchPending = async () => {
      try {
        const endpoint = isSystemLevel ? '/api/superadmin/pending' : '/api/admin/users/pending';
        const res = await axios.get(endpoint);
        const data = res.data || [];
        setPendingCount(Array.isArray(data) ? data.length : 0);
      } catch { setPendingCount(0); }
    };
    fetchPending();
    const iv = setInterval(fetchPending, 30000);
    return () => clearInterval(iv);
  }, [isAdmin, isSystemLevel]);

  // Supplemental bell poll — includes invite_requested users in the badge count
  useEffect(() => {
    if (!isAdmin || isSystemLevel) return;
    const fetchAllPending = async () => {
      try {
        const res = await axios.get('/api/admin/users/pending/all');
        const data = res.data || [];
        setPendingCount(Array.isArray(data) ? data.length : 0);
      } catch { /* retain existing count on failure */ }
    };
    fetchAllPending();
    const iv = setInterval(fetchAllPending, 30000);
    return () => clearInterval(iv);
  }, [isAdmin, isSystemLevel]);

  const renderAnimatedAvatarMenu = (closeMenu, positionClass = "right-0 top-full pt-4") => {
    const isBottom = positionClass.includes('bottom');
    const startY = isBottom ? 10 : -10;
    
    const initials = (user?.username || user?.email || 'U')[0].toUpperCase();

    const getStatusColor = (status) => {
      const s = status?.toLowerCase();
      if (s === 'active') return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
      if (s === 'pending') return "text-amber-500 bg-amber-500/10 border-amber-500/30";
      return "text-slate-400 bg-slate-500/10 border-slate-500/20";
    };

    const adminItems = [
      { label: 'Admin Panel', icon: <Users size={20} />, onClick: () => { closeMenu(); navigate('users'); }, show: isAdmin && !isSuperAdmin },
      { label: 'Super Admin Panel', icon: <Crown size={20} />, onClick: () => { closeMenu(); navigate('superadmin'); }, show: isSuperAdmin, color: 'text-amber-400' },
      { label: 'System Panel', icon: <Crown size={20} />, onClick: () => { closeMenu(); navigate('superadmin'); }, show: isDeveloper, color: 'text-sky-500' },
    ].filter(i => i.show);

    const prefItems = [
      { label: 'Your Profile', icon: <UserCog size={20} />, onClick: () => { closeMenu(); navigate('profile'); }, show: true },
      { 
        label: 'Appearance', 
        rightLabel: theme === 'dark' ? 'Dark' : 'Light', 
        icon: (
          <div className="relative w-[20px] h-[20px] flex items-center justify-center">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={theme}
                initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                transition={{ duration: 0.2 }}
                className="absolute flex"
              >
                {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
              </motion.div>
            </AnimatePresence>
          </div>
        ),
        onClick: () => { toggleTheme(); }, show: true 
      },
      { 
        label: 'Navigation', 
        rightLabel: navOrientation === 'horizontal' ? 'Left' : 'Top', 
        icon: (
          <div className="relative w-[20px] h-[20px] flex items-center justify-center">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={navOrientation}
                initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                transition={{ duration: 0.2 }}
                className="absolute flex"
              >
                {navOrientation === 'horizontal' ? <PanelLeft size={20} /> : <PanelTop size={20} />}
              </motion.div>
            </AnimatePresence>
          </div>
        ),
        onClick: () => { toggleNavOrientation(); closeMenu(); }, show: true 
      },
    ].filter(i => i.show);

    const accountItems = [
      { label: 'Log out', icon: <LogOut size={20} />, onClick: () => { closeMenu(); onLogout(); }, show: true, color: 'text-red-500', hoverBg: 'hover:bg-red-500/10 hover:text-red-600' }
    ].filter(i => i.show);

    const renderMenuItem = (item, index) => (
      <motion.button
        key={item.label}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, delay: index * 0.03 }}
        role="menuitem"
        onClick={(e) => { e.stopPropagation(); item.onClick(); }}
        className={`w-full flex items-center justify-between p-3 rounded-xl cursor-pointer text-sm font-semibold transition-colors ${item.hoverBg || 'hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]'} ${item.color || 'text-[var(--text-sec)]'}`}
      >
        <span className="flex items-center gap-3">
          <span className="opacity-70">{item.icon}</span>
          {item.label}
        </span>
        {item.rightLabel && (
          <span className="text-[11px] uppercase tracking-widest font-bold px-2.5 py-0.5 rounded border" style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-dim)' }}>
            {item.rightLabel}
          </span>
        )}
      </motion.button>
    );

    let animIndex = 0;

    return (
      <motion.div
        key="avatar-menu"
        initial={{ opacity: 0, y: startY, filter: "blur(10px)", scale: 0.95 }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
        exit={{ opacity: 0, y: startY, filter: "blur(10px)", scale: 0.95 }}
        transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
        className={`absolute ${positionClass} z-[100]`}
        role="menu"
      >
        <div className="w-[340px] rounded-2xl shadow-2xl p-0" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <section className="rounded-2xl p-2 shadow-inner border m-1" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
            {/* Profile Header */}
            <div className="flex items-center p-3 gap-3.5 mb-1">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0" style={{ background: 'var(--accent)' }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate leading-tight" style={{ color: 'var(--text-main)' }}>{user?.username || 'User'}</h3>
                <p className="text-sm truncate leading-tight mt-0.5" style={{ color: 'var(--text-sec)' }}>{user?.email || 'email@example.com'}</p>
              </div>
              <div className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest rounded-md border ${getStatusColor(user?.status)}`}>
                {user?.status || 'Active'}
              </div>
            </div>

            {adminItems.length > 0 && (
              <>
                <div className="h-px my-1.5 mx-2" style={{ background: 'var(--border)' }} />
                <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Administration</div>
                <div className="flex flex-col gap-0.5">
                  {adminItems.map(item => renderMenuItem(item, animIndex++))}
                </div>
              </>
            )}

            <div className="h-px my-1.5 mx-2" style={{ background: 'var(--border)' }} />
            <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Preferences</div>
            <div className="flex flex-col gap-0.5">
              {prefItems.map(item => renderMenuItem(item, animIndex++))}
            </div>
          </section>

          <section className="p-1 mt-1">
            <div className="flex flex-col gap-0.5 px-1 pb-1">
              {accountItems.map(item => renderMenuItem(item, animIndex++))}
            </div>
          </section>
        </div>
      </motion.div>
    );
  };

  const desktopRightActions = (
    <div className="flex items-center gap-2 sm:gap-3">
      {isAdmin && (
        <button onClick={() => navigate(isSuperAdmin || isDeveloper ? 'superadmin' : 'users')} aria-label={pendingCount > 0 ? `${pendingCount} pending approval${pendingCount > 1 ? 's' : ''}` : 'Notifications'} className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/70 hover:text-white">
          <Bell size={18} className={pendingCount > 0 ? 'text-amber-400 subtle-bounce' : ''} />
          {pendingCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[10px] font-bold text-black flex items-center justify-center" aria-hidden="true">{pendingCount > 9 ? '9+' : pendingCount}</span>}
        </button>
      )}
      <div ref={avatarMenuRef} className="relative">
        <button onClick={(e) => { e.stopPropagation(); setAvatarMenuOpen(o => !o); }} className="flex items-center gap-2 px-1.5 pr-3 py-1.5 rounded-full transition-all border" style={{ background: 'var(--hover-bg)', borderColor: 'var(--border)', color: 'var(--text-sec)' }}>
          <div className="w-8 h-8 text-sm font-bold flex items-center justify-center rounded-full" style={{ background: 'var(--text-main)', color: 'var(--bg)' }}>
            {(user?.username || 'U')[0].toUpperCase()}
          </div>
          <ChevronDown size={16} className={`transition-transform ${avatarMenuOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-main)' }} />
        </button>
        <AnimatePresence>
          {avatarMenuOpen && renderAnimatedAvatarMenu(() => setAvatarMenuOpen(false))}
        </AnimatePresence>
      </div>
    </div>
  );

  const mobileRightActions = (
    <div className="flex-shrink-0 flex items-center gap-2">
      {isAdmin && (
        <button onClick={() => navigate(isSuperAdmin || isDeveloper ? 'superadmin' : 'users')} aria-label={pendingCount > 0 ? `${pendingCount} pending approval${pendingCount > 1 ? 's' : ''}` : 'Notifications'} className="relative flex items-center justify-center w-11 h-11 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/15 transition-all text-white/70 hover:text-white">
          <Bell size={18} className={pendingCount > 0 ? 'text-amber-400 subtle-bounce' : ''} />
          {pendingCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[10px] font-bold text-black flex items-center justify-center" aria-hidden="true">{pendingCount > 9 ? '9+' : pendingCount}</span>}
        </button>
      )}
      <div ref={mobileAvatarMenuRef} className="relative">
        <button onClick={(e) => { e.stopPropagation(); setAvatarMenuOpen(o => !o); }} className="flex items-center gap-2 px-1.5 pr-3 py-1.5 rounded-full transition-all border" style={{ background: 'var(--hover-bg)', borderColor: 'var(--border)', color: 'var(--text-sec)' }}>
          <div className="w-8 h-8 text-sm font-bold flex items-center justify-center rounded-full" style={{ background: 'var(--text-main)', color: 'var(--bg)' }}>
            {(user?.username || 'U')[0].toUpperCase()}
          </div>
          <ChevronDown size={16} className={`transition-transform ${avatarMenuOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-main)' }} />
        </button>
        <AnimatePresence>
          {avatarMenuOpen && renderAnimatedAvatarMenu(() => setAvatarMenuOpen(false))}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="app-container text-white min-h-screen font-sans relative" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-main)' }} data-theme={theme}>
      
      {/* Vertical sidebar — desktop only, when orientation === 'vertical' */}
      {navOrientation === 'vertical' && (
        <motion.aside
          initial={false}
          animate={isSidebarExpanded ? "expanded" : "collapsed"}
          variants={sidebarVariants}
          className="hidden md:flex fixed top-0 left-0 bottom-0 z-40 flex-col backdrop-blur-xl border-r"
          style={{ background: 'var(--nav-bg)', borderColor: 'var(--border)' }}
          aria-label="Primary navigation"
        >
        <div className="px-5 h-[72px] flex items-center border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button onClick={() => setSidebarExpanded(!isSidebarExpanded)} aria-label={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'} className="flex items-center justify-center w-11 h-11 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 text-white/70">
            <Menu size={24} />
            </button>
          <motion.button variants={sidebarTextVariants} onClick={() => navigate('overview')} className="ml-3.5 text-xl font-extrabold tracking-widest uppercase text-white whitespace-nowrap overflow-hidden transition-all hover:scale-105 hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
              SPOTFIXES
            </motion.button>
          </div>
        <nav className="flex-1 py-5 px-3 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar" aria-label="Sections">
            {NAV_TABS.map(t => {
              if (t.superAdminOnly && !isSuperAdmin)  return null;
              if (t.adminOnly      && !isAdmin)       return null;
              if (t.hideForSystemLevel && isSystemLevel) return null;
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => navigate(t.id)}
                  aria-current={isActive ? 'page' : undefined}
                  title={!isSidebarExpanded ? t.label : undefined}
              className={`relative group w-full flex items-center px-3 py-3.5 rounded-xl text-base font-semibold text-left ${
                    !isActive && 'hover:bg-white/5'
                  } ${isSidebarExpanded ? 'justify-start' : 'justify-center'}`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-vertical-nav-pill"
                      className="absolute inset-0 rounded-lg"
                      style={{ background: 'var(--hover-bg)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 35 }}
                    />
                  )}
                  {isActive && isSidebarExpanded && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  )}
                  
                  {Icon && <Icon size={18} className={`relative z-10 flex-shrink-0 transition-all duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'opacity-50 group-hover:opacity-100'}`} style={isActive ? { color: 'var(--text-main)' } : {}} />}
                  <motion.span variants={sidebarTextVariants} className={`relative z-10 ml-3 truncate transition-colors duration-200 ${isActive ? 'font-semibold' : 'opacity-60 group-hover:opacity-100'}`} style={{ color: 'var(--text-main)' }}>{t.label}</motion.span>
                </button>
              );
            })}
          </nav>
          
          {/* Vertical Sidebar Bottom Actions (User, Theme, Notifications) */}
        <div className="p-4 border-t flex-shrink-0 flex flex-col gap-3" style={{ borderColor: 'var(--border)' }}>
            <div className={`flex ${isSidebarExpanded ? 'items-center justify-between px-2' : 'flex-col items-center gap-3 pt-2'}`}>
            <motion.span variants={sidebarTextVariants} className="text-[11px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">System</motion.span>
            <div className={`flex ${isSidebarExpanded ? 'items-center gap-2' : 'flex-col items-center gap-2'}`}>
                {isAdmin && (
                  <button
                    onClick={() => navigate(isSuperAdmin || isDeveloper ? 'superadmin' : 'users')}
                  className="relative flex items-center justify-center w-10 h-10 rounded-full bg-transparent hover:bg-white/10 text-white/50 hover:text-white transition-all"
                    title={pendingCount > 0 ? `${pendingCount} pending approval${pendingCount > 1 ? 's' : ''}` : 'Notifications'}
                  >
                  <Bell size={20} className={pendingCount > 0 ? 'text-amber-400 subtle-bounce' : ''} />
                    {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full text-[11px] font-bold text-black flex items-center justify-center">
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div ref={sidebarAvatarMenuRef} className="relative mt-2">
              <button
                type="button"
                onClick={() => setSidebarAvatarMenuOpen(o => !o)}
              className={`w-full flex items-center ${isSidebarExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center py-2.5'} rounded-xl transition-all border`}
                style={{ background: 'var(--hover-bg)', borderColor: 'var(--border)' }}
              >
              <div className="w-10 h-10 text-base font-bold flex items-center justify-center rounded-full flex-shrink-0" style={{ background: 'var(--text-main)', color: 'var(--bg)' }}>
                  {(user?.username || 'U')[0].toUpperCase()}
                </div>
                <motion.div variants={sidebarTextVariants} className="flex-1 min-w-0 text-left">
                <div className="text-base font-bold truncate leading-tight" style={{ color: 'var(--text-main)' }}>
                    {user?.username || 'User'}
                  </div>
                <div className="text-xs truncate leading-tight capitalize mt-0.5" style={{ color: 'var(--text-sec)' }}>
                    {user?.role?.replace('_', ' ') || 'User'}
                  </div>
                </motion.div>
                <motion.div variants={sidebarTextVariants}>
                <ChevronUp size={20} className={`transition-transform flex-shrink-0 ${sidebarAvatarMenuOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-sec)' }} />
                </motion.div>
              </button>

              {/* Sidebar popup menu */}
              <AnimatePresence>
                {sidebarAvatarMenuOpen && renderAnimatedAvatarMenu(() => setSidebarAvatarMenuOpen(false), isSidebarExpanded ? 'left-0 bottom-full mb-2 w-full' : 'left-full bottom-0 ml-2 w-56')}
              </AnimatePresence>
            </div>
          </div>
        </motion.aside>
      )}

      {/* Mobile Top bar */}
      <nav
        className="fixed top-0 right-0 left-0 z-50 backdrop-blur-xl border-b transition-all md:hidden"
        style={{ background: 'var(--nav-bg)', borderColor: 'var(--border)' }}
        aria-label="Mobile Top bar"
      >
        <div className="px-4 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNavOpen(true)} className="flex items-center justify-center w-11 h-11 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/15 transition-all">
              <Menu size={20} className="text-white/70" />
            </button>
            <div className="flex items-center cursor-pointer transition-transform hover:scale-105 active:scale-95" onClick={() => navigate('overview')}>
              <span className="text-xl font-extrabold tracking-widest uppercase text-white hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-all">SPOTFIXES</span>
            </div>
          </div>
          {mobileRightActions}
        </div>
      </nav>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-all"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
        <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] border-r flex flex-col" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <div className="h-[72px] px-5 flex items-center justify-between border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xl font-extrabold tracking-widest uppercase" style={{ color: 'var(--text-main)' }}>
                SPOTFIXES
              </span>
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-sec)' }}
              >
              <X size={20} />
              </button>
            </div>
          <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
              {NAV_TABS.map(t => {
                if (t.superAdminOnly && !isSuperAdmin)  return null;
                if (t.adminOnly      && !isAdmin)       return null;
                if (t.hideForSystemLevel && isSystemLevel) return null;
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(t.id)}
                    aria-current={tab === t.id ? 'page' : undefined}
                  className={`group w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-semibold transition-all text-left ${
                      tab === t.id
                        ? 'bg-white/15 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                  {t.superAdminOnly && <Crown size={14} className="opacity-80 transition-transform duration-200 group-hover:scale-110" />}
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {navOrientation === 'horizontal' && <AnimatedNavFramer navItems={visibleTabs} currentTab={tab} onNavigate={navigate} rightActions={desktopRightActions} onBack={goBack} canGoBack={!!previousTab} />}

      <main className={`main-scroll relative z-10 transition-all duration-300 ${navOrientation === 'vertical' ? (isSidebarExpanded ? 'pt-[72px] md:pt-8 md:pl-64' : 'pt-[72px] md:pt-8 md:pl-20') : 'pt-[72px] md:pt-[104px]'}`}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            {tab === 'overview'    && <Overview     user={user} onNavigate={navigate} selectedCompany={selectedCompany} onSelectCompany={setSelectedCompany} />}
            {tab === 'submit'      && <SubmitTab    user={user} prefill={submitPrefill} onClearPrefill={() => setPrefill(null)} onNavigate={navigate} />}
            {tab === 'performance' && isAdmin       && <Performance key={`perf-${perfRefreshKey}`} user={user} onTrainStart={handleTrainStart} />}
            {tab === 'analysis'    && <BugAnalysis  user={user} />}
            {tab === 'directory'   && <Directory    onNavigate={navigate} user={user} />}
            {tab === 'database'    && <Explorer     user={user} initialQuery={externalQuery} initialFilters={extFilters} onNavigate={navigate} />}
            {tab === 'resolution'  && <ResolutionSupport />}
            {tab === 'users'       && isAdmin       && <UserManagement currentUser={user} initialQuery={externalQuery} />}
            {tab === 'superadmin'  && isSuperAdmin  && <SuperAdmin user={user} canManage={true} canApprove={true} canDelete={true} />}
            {tab === 'superadmin'  && isDeveloper   && <SuperAdmin user={user} canManage={false} canApprove={true} canDelete={false} />}
            {tab === 'profile'                      && <ProfileSettings user={user} onUpdate={onUpdateUser} />}
            {tab === 'company'     && !isDeveloper  && isAdmin && <CompanyProfile  user={user} />}
          </Suspense>
        </ErrorBoundary>
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
  const [forceInviteSetPassword, setForceInviteSetPassword] = useState(false);
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
        if (import.meta.env.DEV) console.error('[App] initAuth:', err);
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
      // When an approved user signs in via invite link, handle password setup based on metadata.
      // We check user_metadata instead of the URL hash because Supabase clears the hash
      // before firing onAuthStateChange, so the URL is no longer reliable.
      if (event === 'SIGNED_IN') {
        const passwordPrefilled = session?.user?.user_metadata?.password_prefilled;
        const needsPasswordSetup = session?.user?.user_metadata?.needs_password_setup;
        if (passwordPrefilled) {
          // Registered admin — silently apply their pre-set registration password.
          setForceInviteSetPassword(false);
          axios.post('/api/users/me/apply-registration-password').catch(() => {});
        } else if (needsPasswordSetup && !sessionStorage.getItem('invite_setup_shown')) {
          // System user (super_admin/developer) or directly-invited user — show set-password screen.
          // Guard with sessionStorage so it only appears once even if SIGNED_IN fires multiple times.
          sessionStorage.setItem('invite_setup_shown', 'true');
          sessionStorage.setItem('apex_session_active', 'true');
          setForceInviteSetPassword(true);
        }
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
      if (import.meta.env.DEV) console.error('[App] handleLogin DB fetch:', err);
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
    <div className="h-screen w-full flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)' }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--accent)' }} />
      <span className="text-sm font-medium" style={{ color: 'var(--text-dim, var(--text-sec))', letterSpacing: '-0.01em' }}>Loading Spotfixes…</span>
    </div>
  );

  if (!user) {
    if (showLogin || forceRecoveryReset || forceInviteSetPassword) {
      return (
        <Login
          onLogin={(u) => {
            setForceInviteSetPassword(false);
            setForceRecoveryReset(false);
            handleLogin(u);
          }}
          forceInviteSetup={forceInviteSetPassword}
          onInviteSetupDone={() => setForceInviteSetPassword(false)}
          forceResetRecovery={forceRecoveryReset}
          onResetDone={() => setForceRecoveryReset(false)}
          onBack={() => setShowLogin(false)}
        />
      );
    }
    return <Landing onEnterWorkspace={() => setShowLogin(true)} />;
  }
  if (forceRecoveryReset || forceInviteSetPassword) {
    return (
      <Login
        onLogin={(u) => {
          setForceInviteSetPassword(false);
          setForceRecoveryReset(false);
          handleLogin(u);
        }}
        forceInviteSetup={forceInviteSetPassword}
        onInviteSetupDone={() => setForceInviteSetPassword(false)}
        forceResetRecovery={forceRecoveryReset}
        onResetDone={() => setForceRecoveryReset(false)}
      />
    );
  }
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
  // Gate onboarding on explicit `onboarding_completed` flag only. New-company admins
  // start with `company_id` set but `onboarding_completed=false` — must still onboard.
  const _onboardLocalKey = `sf_onboarded_${user?.uuid || user?.id}`;
  const _onboardingDone  = user.onboarding_completed
    || !!localStorage.getItem(_onboardLocalKey);
  if (user && user.role === 'admin' && !_onboardingDone) return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Onboarding onComplete={handleOnboardingComplete} user={user} />
      </Suspense>
    </ErrorBoundary>
  );
  return (
    <ErrorBoundary>
      <Dashboard
        user={user}
        onLogout={handleLogout}
        initialTab={initialTab}
        onUpdateUser={u => setUser(prev => ({ ...prev, ...u }))}
      />
    </ErrorBoundary>
  );
}
