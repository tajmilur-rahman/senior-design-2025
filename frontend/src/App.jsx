import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import BugAnalysis from './Pages/BugAnalysis';
import { ScrollSection, Background, SkeletonLoader } from './Components/LayoutUtils';
import Overview from './Pages/Overview';
import Explorer from "./Pages/Explorer";
import SubmitTab from "./Pages/Submit";
import Login from "./Pages/Login";

import {
  Database, BrainCircuit, LogOut, Search,
  ShieldCheck, UploadCloud, Activity,
  Download, ArrowUpDown, ChevronLeft, ChevronRight,
  Terminal, AlertTriangle, Trash2, CheckCircle, ExternalLink,
  Cpu, Zap, Server, RotateCcw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import './App.css';


// --- DASHBOARD CONTAINER ---
function Dashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview');
  const [externalQuery, setExternalQuery] = useState("");

  const handleNavigation = (targetTab, query = "") => {
      setTab(targetTab);
      setExternalQuery(query);
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
             {/* UPDATED: Added 'Analysis' to this list */}
             {['Overview', 'Database', 'Analysis', 'Submit'].map(t => (
                 <button
                    key={t}
                    className={`nav-link ${tab===t.toLowerCase()?'active':''}`}
                    onClick={()=>{
                        setTab(t.toLowerCase());
                        setExternalQuery("");
                    }}
                 >
                    {t}
                 </button>
             ))}
          </div>
          <div className="nav-right">
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
         {tab === 'database' && <Explorer user={user} initialQuery={externalQuery}/>}
         {tab === 'analysis' && <BugAnalysis />}
         
         {tab === 'submit' && <SubmitTab user={user}/>}
      </main>
    </div>
  );
}

// ==========================================
// 👇 THE MAIN APP SWITCH
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);

  // 1. If no user is logged in, show Login
  if (!user) {
    return <Login onLogin={(loggedInUser) => setUser(loggedInUser)} />;
  }

  // 2. If user IS logged in, show Dashboard
  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}