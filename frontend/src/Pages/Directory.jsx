import { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { FolderTree, ExternalLink, ArrowRight, Layers, Building2, Users, Bug, BrainCircuit, CheckCircle, XCircle, Trash2, RefreshCw } from 'lucide-react';
import { mozillaTaxonomy, teamDescriptions } from '../javascript/taxonomy';

export default function Directory({ onNavigate, user }) {
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [counts, setCounts] = useState({});
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [resettingId, setResettingId] = useState(null);   // company id currently being reset
  const [confirmReset, setConfirmReset] = useState(null); // company id awaiting confirm

  const handleResetCompany = async (coId) => {
    setResettingId(coId);
    setConfirmReset(null);
    try {
      const token = localStorage.getItem('token');
      await axios.delete('/api/admin/model/reset', {
        headers: { Authorization: `Bearer ${token}` },
        params: { target_company_id: coId },
      });
      setCompanies(prev => prev.map(c => c.id === coId ? { ...c, has_own_model: false } : c));
    } catch (e) {
      console.error('Reset failed:', e.response?.data || e.message);
    } finally {
      setResettingId(null);
    }
  };

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (isSuperAdmin) {
      setLoadingCompanies(true);
      const token = localStorage.getItem('token');
      axios.get('/api/superadmin/companies', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setCompanies(res.data || []))
        .catch(e => console.error('Could not load companies', e))
        .finally(() => setLoadingCompanies(false));
    } else {
      const fetchCounts = async () => {
        try {
          const res = await axios.get('/api/hub/component_counts');
          const normalised = {};
          Object.keys(res.data).forEach(k => { normalised[k.toLowerCase()] = res.data[k]; });
          setCounts(normalised);
        } catch (e) { console.error('Could not load counts', e); }
      };
      fetchCounts();
    }
  }, [isSuperAdmin]);

  const dynamicComponents = useMemo(() => {
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count: Number(count) || 0 }))
      .filter(r => r.name && r.name.trim().length > 0)
      .sort((a, b) => b.count - a.count);
  }, [counts]);

  // Detect if this is a Firefox/Mozilla company by checking their data_table
  const compName = (user?.company_name || '').toLowerCase();
  const userName = (user?.username || '').toLowerCase();
  const isFirefoxCompany = user?.data_table === 'firefox_table' ||
    compName.includes('firefox') || compName.includes('mozilla') ||
    userName.includes('firefox') || userName.includes('mozilla');

  // Detect whether the component data looks like Mozilla taxonomy —
  // this catches non-Firefox companies whose DB was seeded from firefox_table
  // before the component-stripping fix was applied.
  const looksLikeMozilla = dynamicComponents.some(({ name }) =>
    Object.keys(mozillaTaxonomy).some(k => k.toLowerCase() === name.toLowerCase())
  );

  // Only show dynamic component cards for non-Firefox companies that have
  // their own real (non-Mozilla) component data.
  const showDynamic = !isFirefoxCompany && dynamicComponents.length > 0 && !looksLikeMozilla;
  const companyLabel = user?.company_name || 'your company';

  const getTeamCount = (teamName) => counts[teamName.toLowerCase()] || 0;

  // ── Super admin: Companies Directory ─────────────────────────────────────────
  if (isSuperAdmin) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 relative">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
                <Building2 size={12} className="text-indigo-500" />
                <span className="text-[10px] font-bold tracking-widest uppercase">Platform Overview</span>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
              Companies <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Directory</span>
            </h1>
            <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
              All registered tenant companies on the platform, with model and usage status.
            </p>
          </div>
          <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-indigo-500/20 via-white/5 to-transparent" />
        </div>

        {loadingCompanies ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 mt-12 animate-in fade-in duration-500">
            <div className="w-14 h-14 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent animate-pulse" />
              <RefreshCw size={20} className="animate-spin text-white/40 relative z-10" />
            </div>
            <div className="text-white/40 text-sm font-medium">Loading companies…</div>
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 mt-12">
            <Building2 size={32} className="text-white/15" />
            <div className="text-white/30 text-sm font-medium">No companies registered yet.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {companies.map(co => (
              <div key={co.id} className="group bg-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] rounded-[2rem] p-6 lg:p-8 transition-all relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="flex items-start justify-between gap-3 mb-4 relative z-10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                      <Building2 size={15} className="text-indigo-400" />
                    </div>
                    <div className="text-base font-bold text-white truncate">{co.name || `Company ${co.id}`}</div>
                  </div>
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest flex-shrink-0 ${
                    co.has_own_model
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-white/5 border-white/10 text-white/30'
                  }`}>
                    {co.has_own_model
                      ? <><CheckCircle size={9} /> Model Ready</>
                      : <><XCircle size={9} /> No Model</>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 relative z-10">
                  {[
                    { icon: <Bug size={12} />, label: 'Bugs',    val: co.total_bugs    ?? '—' },
                    { icon: <Users size={12} />, label: 'Users',   val: co.total_users   ?? '—' },
                    { icon: <BrainCircuit size={12} />, label: 'Feedback', val: co.total_feedback ?? '—' },
                  ].map(({ icon, label, val }) => (
                    <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center text-white/30 mb-1">{icon}</div>
                      <div className="text-white font-bold text-sm">{typeof val === 'number' ? val.toLocaleString() : val}</div>
                      <div className="text-white/30 text-[10px] uppercase tracking-widest">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between relative z-10">
                  {co.status && (
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                      co.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>{co.status}</span>
                  )}
                  {/* Per-company model reset — super admin only */}
                  {confirmReset === co.id ? (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button onClick={() => setConfirmReset(null)}
                        className="px-2.5 py-1 bg-white/5 border border-white/10 text-white/40 text-[10px] font-bold rounded-lg hover:bg-white/10 transition-all">
                        No
                      </button>
                      <button onClick={() => handleResetCompany(co.id)} disabled={resettingId === co.id}
                        className="flex items-center gap-1 px-2.5 py-1 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-bold rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50">
                        {resettingId === co.id ? <RefreshCw size={9} className="animate-spin" /> : <Trash2 size={9} />} Reset
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmReset(co.id)} disabled={resettingId !== null}
                      className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-white/[0.03] border border-white/[0.08] text-white/30 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 text-[10px] font-bold rounded-lg transition-all disabled:opacity-30">
                      <Trash2 size={9} /> Reset model
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
              <FolderTree size={12} className="text-indigo-500" />
              <span className="text-[10px] font-bold tracking-widest uppercase">System Taxonomy</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Component <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Directory</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            {showDynamic
              ? `Live components from ${companyLabel} data. Select one to pre-fill a bug report.`
              : isFirefoxCompany
                ? 'Select a component to pre-fill a bug report, or browse the architecture.'
                : `Components will appear here as your team submits bugs. Submit your first bug to get started.`}
          </p>
        </div>
        {isFirefoxCompany && (
          <div className="relative z-10">
            <button onClick={() => window.open('https://bugzilla.mozilla.org/', '_blank')} className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm whitespace-nowrap">
              Open Bugzilla <ExternalLink size={14} className="opacity-70" />
            </button>
          </div>
        )}
        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-indigo-500/20 via-white/5 to-transparent" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
        {showDynamic ? (
          dynamicComponents.map((item) => (
            <div
              key={item.name}
              className="group bg-white/[0.02] border border-white/10 hover:border-indigo-500/40 hover:bg-white/[0.04] rounded-[2rem] p-6 lg:p-8 transition-all cursor-pointer relative overflow-hidden"
              onClick={() => onNavigate('submit', '', { component: item.name })}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
                <div className="text-xl font-bold text-white capitalize truncate min-w-0 flex-1">{item.name}</div>
                <div className="bg-white/5 border border-white/10 text-white/60 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap flex-shrink-0">{item.count.toLocaleString()} records</div>
              </div>

              <div className="text-sm text-white/40 mb-6 leading-relaxed relative z-10">
                Live component observed in your company's bug dataset.
              </div>

              <div className="text-indigo-400 group-hover:text-indigo-300 font-bold text-xs uppercase tracking-widest flex items-center gap-2 relative z-10 transition-colors">
                Pre-fill &amp; Submit <ArrowRight size={12} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))
        ) : !isFirefoxCompany ? (
          // Non-Firefox company with no own-component data yet — show empty state
          <div className="col-span-full flex flex-col items-center justify-center py-24 gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <FolderTree size={28} className="text-white/20" />
            </div>
            <div>
              <p className="text-white/50 text-base font-medium mb-2">No components yet</p>
              <p className="text-white/30 text-sm max-w-sm">
                Components are automatically detected from your submitted bugs.
                Tag bugs with a component when submitting to start building your directory.
              </p>
            </div>
            <button
              onClick={() => onNavigate('submit')}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 rounded-xl text-sm font-bold transition-all"
            >
              Submit a bug <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          Object.keys(mozillaTaxonomy).map((team) => {
            const tCount = getTeamCount(team);
            const isExpanded = expandedTeam === team;

            return (
              <div
                key={team}
                className={`group bg-white/[0.02] border rounded-[2rem] p-6 lg:p-8 transition-all cursor-pointer relative overflow-hidden ${isExpanded ? 'border-white/30 bg-white/[0.04] shadow-[0_0_30px_rgba(255,255,255,0.05)]' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.04]'}`}
                onClick={() => setExpandedTeam(isExpanded ? null : team)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                
                <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
                  <div className="text-xl font-bold text-white capitalize truncate min-w-0 flex-1">{team}</div>
                  <div className="bg-white/5 border border-white/10 text-white/60 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap flex-shrink-0">
                    {tCount > 0 ? `${tCount.toLocaleString()} records` : `${Object.keys(mozillaTaxonomy[team]).length} categories`}
                  </div>
                </div>

                <div className="text-sm text-white/40 mb-6 leading-relaxed relative z-10">
                  {teamDescriptions[team] || 'Core subsystem architecture and logic.'}
                </div>

                {!isExpanded && (
                  <div className="text-indigo-400 group-hover:text-indigo-300 font-bold text-xs uppercase tracking-widest flex items-center gap-2 relative z-10 transition-colors">
                    Browse components <ArrowRight size={12} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}

                {isExpanded && (
                  <div className="animate-in fade-in slide-in-from-top-4 mt-6 pt-6 border-t border-white/10 relative z-10">
                    {Object.keys(mozillaTaxonomy[team]).map(category => (
                      <div key={category} className="mb-4">
                        <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Layers size={12} /> {category}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {mozillaTaxonomy[team][category].map(comp => (
                            <button
                              key={comp}
                              className="bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-2 max-w-[200px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate('submit', '', { team, category, component: comp });
                              }}
                            >
                              <span className="truncate">{comp}</span>
                              <ArrowRight size={12} className="opacity-40 ml-1 flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
