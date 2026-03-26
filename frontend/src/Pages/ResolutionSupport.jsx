import { useState } from "react";
import axios from "axios";
import {
  Search, History, Clock3, CheckCircle2, Wrench,
  ExternalLink, Lightbulb, BarChart2, BookOpen, X,
  RefreshCw, AlertTriangle
} from "lucide-react";

const EXAMPLE_QUERIES = [
  "Video playback crashes on startup",
  "Memory leak when opening many tabs",
  "Login fails on password protected sites",
  "Extension causes high CPU usage",
];

const SCORE_CONFIG = [
  { min: 10, label: "Strong match",  accent: "text-emerald-400",  bg: "bg-emerald-500/10",  border: "border-emerald-500/20" },
  { min: 6,  label: "Good match",    accent: "text-blue-400",   bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { min: 3,  label: "Partial match", accent: "text-amber-500",         bg: "bg-amber-500/10",  border: "border-amber-500/20" },
  { min: 0,  label: "Weak match",    accent: "text-white/40", bg: "bg-white/5",        border: "border-white/10" },
];

function getScoreConfig(score) {
  return SCORE_CONFIG.find(c => score >= c.min) || SCORE_CONFIG[SCORE_CONFIG.length - 1];
}

function SkeletonCard() {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 flex flex-col gap-4 animate-pulse">
      <div className="flex justify-between">
        <div className="bg-white/10 rounded-md w-24 h-6" />
        <div className="bg-white/10 rounded-md w-20 h-6" />
      </div>
      <div className="bg-white/5 rounded-md w-4/5 h-5 mt-2" />
      <div className="bg-white/5 rounded-md w-3/5 h-5 mb-2" />
      <div className="flex gap-4">
        <div className="bg-white/10 rounded-md w-32 h-4" />
        <div className="bg-white/10 rounded-md w-28 h-4" />
      </div>
      <div className="bg-white/5 rounded-xl w-full h-20 mt-4" />
    </div>
  );
}

export default function ResolutionSupport() {
  const [query,         setQuery]        = useState("");
  const [results,       setResults]      = useState([]);
  const [loading,       setLoading]      = useState(false);
  const [searched,      setSearched]     = useState(false);
  const [error,         setError]        = useState("");
  const [expandedItems, setExpandedItems] = useState({});

  const handleSearch = async (overrideQuery) => {
    // Safely handle event objects just in case, or use override string
    const text = (typeof overrideQuery === 'string') ? overrideQuery : query;
    if (!text.trim()) return;
    
    if (typeof overrideQuery === 'string') {
      setQuery(text);
    }
    
    setLoading(true); setError(""); setSearched(true); setResults([]);
    try {
      const res = await axios.post("/api/resolution-support/search", {
        summary: text 
      });
      setResults(res.data.results || []);
    } catch (err) {
      console.error(err);
      setError("Could not reach the intelligence backend. Make sure the server is running.");
    } finally { setLoading(false); }
  };

  const handleReset = () => {
    setQuery(""); setResults([]); setSearched(false); setError("");
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-400">
              <BookOpen size={12} className="text-blue-500" />
              <span className="text-[10px] font-bold tracking-widest uppercase">Resolution KB</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest uppercase">Live Search</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Resolution <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Support</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            Search historically resolved bugs. Surface how similar anomalies were fixed, which component owned them, and average resolution times.
          </p>
        </div>
        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-blue-500/20 via-white/5 to-transparent" />
      </div>

      {/* Search Input matching BugAnalysis */}
      <div className="mb-10">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative flex items-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-colors focus-within:border-blue-500/50 focus-within:bg-white/10 shadow-lg">
            <Search size={18} className="absolute left-5 text-white/40 pointer-events-none" />
            <input type="text" placeholder="Describe the bug you are working on…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full bg-transparent h-14 pl-14 pr-4 text-white placeholder:text-white/30 focus:outline-none text-base" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleSearch()} disabled={loading || !query.trim()}
              className="h-14 px-8 bg-white text-black hover:bg-zinc-200 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] whitespace-nowrap">
              {loading ? <><RefreshCw size={16} className="animate-spin" /> Searching</> : <><Search size={16} /> Search KB</>}
            </button>
            {searched && (
              <button type="button" onClick={handleReset} title="Clear"
                className="h-14 w-14 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-white/50 hover:text-red-400 rounded-2xl flex items-center justify-center transition-all flex-shrink-0">
                <X size={18} />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 px-2 opacity-60">
          <History size={12} className="text-white/60" />
          <span className="text-xs text-white/60">Searches across <strong className="text-white font-semibold">resolved Firefox historical data</strong>. Try "memory leak tabs" or "extension high CPU".</span>
        </div>
      </div>

      {!searched && !loading && (
        <div className="animate-in fade-in duration-500 mt-12 text-center">
          <p className="text-[10px] font-bold text-white/40 mb-6 flex items-center justify-center gap-2 tracking-widest uppercase">
            <Lightbulb size={12} className="text-blue-400" /> Quick examples
          </p>
          <div className="flex flex-wrap gap-3 justify-center max-w-3xl mx-auto">
            {EXAMPLE_QUERIES.map((sample, i) => (
              <button key={i} type="button" onClick={() => handleSearch(sample)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-full text-xs px-5 py-2.5 font-medium transition-all flex items-center gap-2 group">
                {sample}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-semibold flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-500" />
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl mt-8">
          <Search size={32} className="text-white/20 mb-4" />
          <p className="text-white text-lg font-bold mb-2">No matching resolved bugs found</p>
          <p className="text-white/50 text-sm text-center max-w-md">Try different keywords or a broader description. The knowledge base contains completely resolved, fixed Firefox bugs.</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="mt-8 mb-6 flex justify-between items-end">
          <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <BarChart2 size={14} className="text-white/40" /> {results.length} similar resolved anomalies
          </span>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Sorted by relevance</span>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {results.map((item, idx) => {
            const sc = getScoreConfig(item.match_score ?? 0);
            return (
              <div key={item.id ?? idx} className="group bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden transition-all hover:bg-white/[0.04] hover:border-white/20">
                <div className={`absolute top-0 left-0 w-full h-[2px] ${sc.bg.replace('/10', '/50')}`} />
                
                <div className="flex justify-between items-center gap-4 flex-wrap mb-6">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                    <CheckCircle2 size={12} /> {item.status || "RESOLVED"}
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${sc.bg} ${sc.border} ${sc.accent}`}>
                    {sc.label} · {item.match_score ?? 0}
                  </div>
                </div>
                
                <h3 className="m-0 text-lg font-bold text-white leading-snug mb-6 line-clamp-3">{item.summary || "—"}</h3>
                
                <div className="flex gap-6 flex-wrap mb-6 border-b border-white/10 pb-6">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Wrench size={14} className={sc.accent} />
                    <span className="truncate"><strong className="text-white font-medium">Component:</strong> {item.component || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Clock3 size={14} className={sc.accent} />
                    <span><strong className="text-white font-medium">Resolved in:</strong> {item.resolved_in_days != null ? `${item.resolved_in_days} days` : "N/A"}</span>
                  </div>
                </div>
                
                <div className={`bg-white/5 rounded-xl p-5 border-l-2 ${sc.border.replace('border-', 'border-l-')}`}>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">
                    Resolution · {item.resolution || "FIXED"}
                  </div>
                  <p className="m-0 text-sm text-white/80 leading-relaxed break-words">
                    {item.resolution_text
                      ? (expandedItems[idx] ? item.resolution_text : item.resolution_text.slice(0, 280) + (item.resolution_text.length > 280 ? "…" : ""))
                      : "No resolution details recorded."}
                  </p>
                  {item.resolution_text?.length > 280 && (
                    <button onClick={() => setExpandedItems(prev => ({ ...prev, [idx]: !prev[idx] }))} className="mt-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
                      {expandedItems[idx] ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
                
                {item.bug_url && (
                  <a href={item.bug_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline mt-4 transition-colors">
                    <ExternalLink size={12} /> Open in Bugzilla
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
