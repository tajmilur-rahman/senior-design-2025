import { useState, useEffect } from 'react';
import axios from 'axios';
import { FolderTree, ExternalLink, ArrowRight, Layers } from 'lucide-react';
import { mozillaTaxonomy, teamDescriptions } from '../javascript/taxonomy';

export default function Directory({ onNavigate }) {
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await axios.get('/api/hub/component_counts');
        const normalizedCounts = {};
        Object.keys(res.data).forEach(k => { normalizedCounts[k.toLowerCase()] = res.data[k]; });
        setCounts(normalizedCounts);
      } catch (e) { console.error("Could not load counts", e); }
    };
    fetchCounts();
  }, []);

  const getTeamCount = (teamName) => { return counts[teamName.toLowerCase()] || 0; };

  return (
    <div className="page-content fade-in">
      <div className="explorer-header">
        <div>
           <h1 style={{fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10}}>
               <FolderTree size={24} color="var(--accent)"/> COMPONENT DIRECTORY
           </h1>
           <span style={{fontSize: 13, color: 'var(--text-sec)'}}>Select an architecture node to rapidly log a manual entry or scan a defect.</span>
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
                                 {/* THE FIX: Instantly navigates to the Submit tab with the correct prefill data! */}
                                 {mozillaTaxonomy[team][category].map(comp => (
                                     <button key={comp} className="dir-comp-btn" onClick={(e) => {
                                         e.stopPropagation();
                                         onNavigate('submit', '', { team, category, component: comp });
                                     }}>
                                         {comp} <ArrowRight size={12} style={{opacity: 0.4, marginLeft: 'auto'}}/>
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
    </div>
  );
}