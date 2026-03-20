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
        const normalised = {};
        Object.keys(res.data).forEach(k => { normalised[k.toLowerCase()] = res.data[k]; });
        setCounts(normalised);
      } catch (e) { console.error('Could not load counts', e); }
    };
    fetchCounts();
  }, []);

  const getTeamCount = (teamName) => counts[teamName.toLowerCase()] || 0;

  return (
    <div className="page-content fade-in">
      <div className="explorer-header">
        <div>
          <h1 style={{
            fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-main)',
            display: 'flex', alignItems: 'center', gap: 10, letterSpacing: -0.5
          }}>
            <FolderTree size={22} color="var(--accent)" /> Component directory
          </h1>
          <span style={{ fontSize: 13, color: 'var(--text-sec)', marginTop: 4, display: 'block' }}>
            Select a component to pre-fill a bug report, or browse the architecture.
          </span>
        </div>
        <button className="sys-btn outline" onClick={() => window.open('https://bugzilla.mozilla.org/', '_blank')}>
          Open Bugzilla <ExternalLink size={13} />
        </button>
      </div>

      <div className="dir-grid">
        {Object.keys(mozillaTaxonomy).map((team) => {
          const tCount = getTeamCount(team);
          const isExpanded = expandedTeam === team;

          return (
            <div
              key={team}
              className={`sys-card dir-card ${isExpanded ? 'active' : ''}`}
              onClick={() => setExpandedTeam(isExpanded ? null : team)}
            >
              <div className="dir-header">
                <div className="dir-title">{team}</div>
                <div className="dir-pill">
                  {tCount > 0 ? `${tCount.toLocaleString()} records` : `${Object.keys(mozillaTaxonomy[team]).length} categories`}
                </div>
              </div>

              <div className="dir-body">
                {teamDescriptions[team] || 'Core subsystem architecture and logic.'}
              </div>

              {!isExpanded && (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  Browse components <ArrowRight size={13} />
                </div>
              )}

              {isExpanded && (
                <div className="dir-expanded fade-in">
                  {Object.keys(mozillaTaxonomy[team]).map(category => (
                    <div key={category} style={{ marginBottom: 14 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 800, color: 'var(--text-sec)',
                        textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
                        display: 'flex', alignItems: 'center', gap: 5
                      }}>
                        <Layers size={11} /> {category}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                        {mozillaTaxonomy[team][category].map(comp => (
                          <button
                            key={comp}
                            className="dir-comp-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate('submit', '', { team, category, component: comp });
                            }}
                            style={{ fontSize: 11.5 }}
                          >
                            {comp}
                            <ArrowRight size={11} style={{ opacity: 0.35, marginLeft: 'auto' }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}