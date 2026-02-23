import { useState, useEffect } from 'react';
import axios from 'axios';
import { FolderTree, ExternalLink, ArrowRight, Layers, Activity, AlertTriangle, Database, Plus, X, Search } from 'lucide-react';
import { mozillaTaxonomy, teamDescriptions } from '../javascript/taxonomy';

export default function Directory({ onNavigate }) {
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [counts, setCounts] = useState({});
  const [inspector, setInspector] = useState({ open: false, component: null, team: null, category: null, data: null, loading: false });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get('/api/hub/component_counts', { headers: { Authorization: `Bearer ${token}` } });
        const normalizedCounts = {};
        Object.keys(res.data).forEach(k => { normalizedCounts[k.toLowerCase()] = res.data[k]; });
        setCounts(normalizedCounts);
      } catch (e) { console.error("Could not load counts", e); }
    };
    fetchCounts();
  }, []);

  const getTeamCount = (teamName) => { return counts[teamName.toLowerCase()] || 0; };

  const openInspector = async (team, category, comp) => {
    setInspector({ open: true, component: comp, team, category, data: null, loading: true });
    try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`/api/hub/component_inspector?component=${encodeURIComponent(comp)}&team=${encodeURIComponent(team)}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setInspector(prev => ({ ...prev, data: res.data, loading: false }));
    } catch (e) { setInspector(prev => ({ ...prev, loading: false })); }
  };

  const closeInspector = () => setInspector({ open: false, component: null, team: null, category: null, data: null, loading: false });

  return (
    <div className="page-content fade-in">
      <div className="explorer-header">
        <div>
           <h1 style={{fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10}}>
               <FolderTree size={24} color="var(--accent)"/> COMPONENT DIRECTORY
           </h1>
           <span style={{fontSize: 13, color: 'var(--text-sec)'}}>Select an architecture node to inspect telemetry and route defects.</span>
        </div>
        <button className="sys-btn outline" onClick={() => window.open('https://bugzilla.mozilla.org/', '_blank')}>
            Bugzilla Hub <ExternalLink size={14}/>
        </button>
      </div>

      <div className="dir-grid">
        {Object.keys(mozillaTaxonomy).map((team) => {
          const tCount = getTeamCount(team);
          return (
          <div key={team} className={`sys-card dir-card ${expandedTeam === team ? 'active' : ''}`} onClick={() => setExpandedTeam(expandedTeam === team ? null : team)}>
             <div className="dir-header">
                <div className="dir-title">{team}</div>
                <div className="dir-pill">{tCount > 0 ? `${tCount.toLocaleString()} Records` : `${Object.keys(mozillaTaxonomy[team]).length} Categories`}</div>
             </div>
             <div className="dir-body">{teamDescriptions[team] || "Core subsystem architecture and logic."}</div>

             {expandedTeam !== team && (
                 <div style={{fontSize: 12, fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6}}>
                     View Architecture <ArrowRight size={14}/>
                 </div>
             )}

             {expandedTeam === team && (
                 <div className="dir-expanded fade-in">
                     {Object.keys(mozillaTaxonomy[team]).map(category => (
                         <div key={category} style={{ marginBottom: 15 }}>
                             <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                 <Layers size={12}/> {category}
                             </div>
                             <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                 {mozillaTaxonomy[team][category].map(comp => (
                                     <button key={comp} className="dir-comp-btn" onClick={(e) => { e.stopPropagation(); openInspector(team, category, comp); }}>
                                         {comp} <Search size={12} style={{opacity: 0.4, marginLeft: 'auto'}}/>
                                     </button>
                                 ))}
                             </div>
                         </div>
                     ))}
                 </div>
             )}
          </div>
        )})}
      </div>

      {inspector.open && (
        <div className="inspector-overlay" onClick={closeInspector}>
            <div className="inspector-modal fade-in" onClick={e => e.stopPropagation()}>
                <button className="inspector-close" onClick={closeInspector}><X size={20}/></button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ background: 'var(--pill-bg)', padding: 12, borderRadius: 12, color: 'var(--accent)' }}><Activity size={24}/></div>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase' }}>{inspector.team} / {inspector.category}</div>
                        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{inspector.component}</h2>
                    </div>
                </div>

                <div style={{ background: 'var(--bg)', padding: 20, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 15, display: 'flex', justifyContent: 'space-between' }}>
                        <span>TOTAL SYSTEM RECORDS</span>
                        <span style={{ color: 'var(--text-main)' }}>{inspector.loading ? '...' : inspector.data?.total?.toLocaleString()} RECORDS</span>
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--danger)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={14}/> RECENT CRITICAL FAILURES (S1)
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {inspector.loading ? <div style={{ fontSize: 13, color: 'var(--text-sec)' }}>Scanning database...</div> :
                         (!inspector.data?.recent_critical?.length ?
                             <div style={{ fontSize: 13, color: 'var(--text-sec)', padding: '10px 0' }}>No recent critical failures logged for this component.</div> :
                             inspector.data.recent_critical.map(bug => (
                                 <div key={bug.id} style={{ background: 'var(--card-bg)', padding: 10, borderRadius: 8, border: '1px solid var(--danger)', display: 'flex', gap: 12, alignItems: 'center' }}>
                                     <span className="pill S1 tiny">S1</span>
                                     <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={bug.summary}>{bug.summary}</span>
                                     <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-sec)' }}>#{bug.id}</span>
                                 </div>
                             ))
                         )}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <button className="sys-btn outline" onClick={() => onNavigate('database', inspector.component)} style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                        <Database size={16}/> EXPLORE ARCHIVE
                    </button>
                    <button className="sys-btn" onClick={() => onNavigate('submit', '', { team: inspector.team, category: inspector.category, component: inspector.component })} style={{ display: 'flex', justifyContent: 'center', gap: 8, background: 'var(--success)' }}>
                        <Plus size={16}/> LOG NEW BUG
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}