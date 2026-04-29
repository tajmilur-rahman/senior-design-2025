import { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { FolderTree, ExternalLink, ArrowRight, Layers, Building2, Users, Bug, BrainCircuit, CheckCircle, XCircle, Trash2, RefreshCw, Search, Globe, Activity } from 'lucide-react';
import { mozillaTaxonomy, teamDescriptions, teamComponentCounts } from '../javascript/taxonomy';
import { LiquidButton as Button } from '../liquid-glass-button';
import { BentoCard } from '../bento-card';

export default function Directory({ onNavigate, user }) {
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [counts, setCounts] = useState({});
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [resettingId, setResettingId] = useState(null);   // company id currently being reset
  const [confirmReset, setConfirmReset] = useState(null); // company id awaiting confirm
  const [searchQuery, setSearchQuery] = useState('');

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
      if (import.meta.env.DEV) console.error('Reset failed:', e.response?.data || e.message);
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
        .catch(e => { if (import.meta.env.DEV) console.error('Could not load companies', e); })
        .finally(() => setLoadingCompanies(false));
    } else {
      const fetchCounts = async () => {
        try {
          const res = await axios.get('/api/hub/component_counts');
          const normalised = {};
          Object.keys(res.data).forEach(k => { normalised[k.toLowerCase()] = res.data[k]; });
          setCounts(normalised);
        } catch (e) { if (import.meta.env.DEV) console.error('Could not load counts', e); }
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

  // Show dynamic component cards for non-Firefox companies whenever they have
  // component data. Do not suppress on name overlap (e.g. "DevTools") because
  // legitimate tenant data can share labels with Mozilla taxonomy terms.
  const showDynamic = !isFirefoxCompany && dynamicComponents.length > 0;
  const companyLabel = user?.company_name || 'your company';

  const getTeamCount = (teamName) => counts[teamName.toLowerCase()] || 0;

  // ── Super admin: Companies Directory ─────────────────────────────────────────
  if (isSuperAdmin) {
    const totalPlatformBugs = companies.reduce((acc, c) => acc + (c.total_bugs ?? c.total ?? 0), 0);
    const totalPlatformUsers = companies.reduce((acc, c) => acc + (c.total_users ?? c.users ?? 0), 0);
    const activeModels = companies.filter(c => c.has_own_model).length;
    const filteredCompanies = companies.filter(c => (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()));

    return (
      <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 relative">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
                <Globe size={12} className="text-indigo-500" />
                <span className="text-[11px] font-medium tracking-[0.06em] uppercase">Global Directory</span>
              </div>
            </div>
            <h1 className="text-[1.75rem] font-semibold tracking-tight mb-3 text-white">
              Tenant <span className="text-indigo-400">Directory</span>
            </h1>
            <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
              Monitor and manage all registered organizations, their telemetry volume, and machine learning models.
            </p>
          </div>
        </div>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <BentoCard className="p-5 hover:bg-white/[0.02] transition-colors">
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2 flex items-center gap-2"><Building2 size={14} className="text-white/30" /> Organizations</div>
            <div className="text-3xl font-bold font-mono text-white">{companies.length}</div>
          </BentoCard>
          <BentoCard className="p-5 hover:bg-white/[0.02] transition-colors">
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2 flex items-center gap-2"><BrainCircuit size={14} className="text-emerald-400/50" /> Active Models</div>
            <div className="text-3xl font-bold font-mono text-emerald-400">{activeModels}</div>
          </BentoCard>
          <BentoCard className="p-5 hover:bg-white/[0.02] transition-colors">
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2 flex items-center gap-2"><Bug size={14} className="text-indigo-400/50" /> Total Telemetry</div>
            <div className="text-3xl font-bold font-mono text-indigo-400">{totalPlatformBugs.toLocaleString()}</div>
          </BentoCard>
          <BentoCard className="p-5 hover:bg-white/[0.02] transition-colors">
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2 flex items-center gap-2"><Users size={14} className="text-white/30" /> Platform Users</div>
            <div className="text-3xl font-bold font-mono text-white">{totalPlatformUsers.toLocaleString()}</div>
          </BentoCard>
        </div>

        {/* Search & Toolbar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input 
              type="text"
              placeholder="Search organizations by name…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-sm text-white placeholder:text-white/30 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all shadow-inner"
            />
          </div>
        </div>

        {loadingCompanies ? (
          <div className="flex flex-col items-center justify-center min-h-[30vh] gap-4 mt-8 animate-in fade-in duration-500">
            <div className="w-14 h-14 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent animate-pulse" />
              <RefreshCw size={20} className="animate-spin text-white/40 relative z-10" />
            </div>
            <div className="text-white/40 text-sm font-medium">Loading companies…</div>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3 mt-8">
            <Building2 size={32} className="text-white/15" />
            <div className="text-white/30 text-sm font-medium">{searchQuery ? 'No organizations match your search.' : 'No companies registered yet.'}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {filteredCompanies.map(co => (
              <BentoCard key={co.id} onClick={() => onNavigate('users', co.name)} className="flex flex-col p-6 lg:p-8 hover:!border-indigo-500/30 hover:!bg-white/[0.04] cursor-pointer group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0" />

                <div className="flex items-start justify-between gap-3 mb-6 relative z-10">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-bold text-white truncate">{co.name || `Company ${co.id}`}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">ID: {co.id}</div>
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest flex-shrink-0 ${
                    co.has_own_model
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-white/5 border-white/10 text-white/30'
                  }`}>
                    {co.has_own_model ? 'Model Active' : 'No Model'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5 relative z-10">
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3.5">
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Bug size={12}/> Telemetry</div>
                    <div className="text-lg font-mono font-bold text-white">{(co.total_bugs ?? co.total ?? 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3.5">
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Users size={12}/> Users</div>
                    <div className="text-lg font-mono font-bold text-white">{(co.total_users ?? co.users ?? 0).toLocaleString()}</div>
                  </div>
                </div>

                {(co.total_bugs ?? co.total ?? 0) > 0 && (
                  <div className="mb-6 relative z-10">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest mb-2">
                      <span className="text-white/40 flex items-center gap-1.5"><Activity size={10} /> Resolution Rate</span>
                      <span className="text-indigo-400">{Math.round(((co.resolved || 0) / (co.total_bugs ?? co.total ?? 1)) * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.round(((co.resolved || 0) / (co.total_bugs ?? co.total ?? 1)) * 100)}%` }} />
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-4 flex items-center justify-between relative z-10 border-t border-white/10">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded border ${
                    co.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {co.status || 'Active'}
                  </span>

                  {/* Per-company model reset — super admin only */}
                  {confirmReset === co.id ? (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button onClick={(e) => { e.stopPropagation(); setConfirmReset(null); }}
                        className="px-2.5 py-1 bg-white/5 border border-white/10 text-white/40 text-[11px] font-bold rounded-lg hover:bg-white/10 transition-all">
                        No
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleResetCompany(co.id); }} disabled={resettingId === co.id}
                        className="flex items-center gap-1 px-2.5 py-1 bg-red-500/20 border border-red-500/30 text-red-400 text-[11px] font-bold rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50">
                        {resettingId === co.id ? <RefreshCw size={9} className="animate-spin" /> : <Trash2 size={9} />} Reset
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 ml-auto">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        Manage users <ArrowRight size={10} />
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmReset(co.id); }} disabled={resettingId !== null}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white/[0.03] border border-white/[0.08] text-white/30 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 text-[11px] font-bold rounded-lg transition-all disabled:opacity-30">
                        <Trash2 size={9} /> Reset model
                      </button>
                    </div>
                  )}
                </div>
              </BentoCard>
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
              <span className="text-[11px] font-medium tracking-[0.06em] uppercase">System Taxonomy</span>
            </div>
          </div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight mb-3 text-white">
            Component <span className="text-indigo-400">Directory</span>
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
            <Button variant="outline" onClick={() => window.open('https://bugzilla.mozilla.org/', '_blank')} className="px-5 py-2.5 font-bold shadow-sm whitespace-nowrap">
              Open Bugzilla <ExternalLink size={14} className="opacity-70" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
        {showDynamic ? (
          dynamicComponents.map((item) => (
            <BentoCard
              key={item.name}
              className="p-6 lg:p-8 cursor-pointer hover:!border-indigo-500/40 hover:!bg-white/[0.04]"
              onClick={() => onNavigate('database', '', null, { comp: item.name })}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0" />

              <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
                <div className="text-xl font-bold text-white capitalize truncate min-w-0 flex-1">{item.name}</div>
                <div className="bg-white/5 border border-white/10 text-white/60 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest whitespace-nowrap flex-shrink-0">{item.count.toLocaleString()} records</div>
              </div>

              <div className="text-sm text-white/40 mb-6 leading-relaxed relative z-10">
                Live component observed in your company's bug dataset.
              </div>

              <div className="text-indigo-400 group-hover:text-indigo-300 font-bold text-xs uppercase tracking-widest flex items-center gap-2 relative z-10 transition-colors">
                View bugs <ArrowRight size={12} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
            </BentoCard>
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
            <Button
              onClick={() => onNavigate('submit')}
              className="px-5 py-2.5 bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 font-bold"
            >
              Open Bug Ingestion <ArrowRight size={14} />
            </Button>
          </div>
        ) : (
          Object.keys(mozillaTaxonomy).map((team) => {
            const tCount = getTeamCount(team);
            const isExpanded = expandedTeam === team;

            return (
              <BentoCard
                key={team}
                className={`p-6 lg:p-8 cursor-pointer ${isExpanded ? '!border-white/30 !bg-white/[0.04] ' : 'hover:!border-white/20 hover:!bg-white/[0.04]'}`}
                onClick={() => setExpandedTeam(isExpanded ? null : team)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0" />
                
                <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
                  <div className="text-xl font-bold text-white capitalize truncate min-w-0 flex-1">{team}</div>
                  <div className="bg-white/5 border border-white/10 text-white/60 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest whitespace-nowrap flex-shrink-0">
                    {tCount > 0 ? `${tCount.toLocaleString()} records` : `${(teamComponentCounts?.[team] ?? 0)} components`}
                  </div>
                </div>

                <div className="text-sm text-white/40 mb-6 leading-relaxed relative z-10 line-clamp-3">
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
                        <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
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
              </BentoCard>
            );
          })
        )}
      </div>
    </div>
  );
}
