import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Search, History, Clock3, CheckCircle2, Wrench,
  ExternalLink, Lightbulb, BarChart2, BookOpen, X,
  RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Filter,
} from "lucide-react";

function CustomSelect({ value, onChange, options, placeholder, disabled = false, ariaLabel, triggerClassName, dropUp = false }) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);
  const listId = useRef(`sf-listbox-${Math.random().toString(36).slice(2, 9)}`).current;
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const selectedIdx = options.findIndex(o => String(o.value) === String(value));
  const selected = selectedIdx >= 0 ? options[selectedIdx] : null;
  useEffect(() => { if (!open) return; setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0); }, [open]);
  const openAnd = (idx) => { if (disabled) return; setOpen(true); setActiveIdx(idx); };
  const commit = (idx) => { if (idx < 0 || idx >= options.length) return; onChange(options[idx].value); setOpen(false); };
  const onKeyDown = (e) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter': case ' ': e.preventDefault(); if (!open) openAnd(selectedIdx >= 0 ? selectedIdx : 0); else commit(activeIdx); break;
      case 'ArrowDown': e.preventDefault(); if (!open) openAnd(selectedIdx >= 0 ? selectedIdx : 0); else setActiveIdx(i => Math.min(options.length - 1, i + 1)); break;
      case 'ArrowUp': e.preventDefault(); if (!open) openAnd(Math.max(0, selectedIdx)); else setActiveIdx(i => Math.max(0, i - 1)); break;
      case 'Escape': if (open) { e.preventDefault(); setOpen(false); } break;
      case 'Tab': setOpen(false); break;
      default: break;
    }
  };
  return (
    <div ref={ref} className={`relative select-none w-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div role="combobox" tabIndex={disabled ? -1 : 0} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-disabled={disabled} aria-label={ariaLabel || placeholder} onClick={() => { if (!disabled) setOpen(o => !o); }} onKeyDown={onKeyDown}
        className={triggerClassName || `h-10 flex items-center justify-between px-3 border rounded-xl cursor-pointer text-sm transition-all outline-none focus:ring-2 focus:ring-blue-500/40 border-white/10 bg-zinc-900 text-white hover:bg-white/10`}>
        <span className={`truncate pr-2 ${selected ? 'text-white' : ''}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div id={listId} role="listbox" ref={listRef} aria-label={ariaLabel || placeholder} className={`absolute z-[9999] w-full bg-[#1a1d27] border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] overflow-hidden py-1.5 ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
          <div className="max-h-52 overflow-y-auto custom-scrollbar">
            {options.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              return (<div key={opt.value} role="option" aria-selected={isSelected} onClick={() => commit(i)} onMouseEnter={() => setActiveIdx(i)} className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors mx-1.5 rounded-xl ${isSelected ? 'bg-blue-500/20 text-blue-400' : i === activeIdx ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>{opt.label}</div>);
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const EXAMPLE_QUERIES = [
  "Video playback crashes on startup",
  "Memory leak when opening many tabs",
  "Login fails on password protected sites",
  "Extension causes high CPU usage",
];

const SCORE_CONFIG = [
  { min: 10, label: "Strong match",  accent: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { min: 6,  label: "Good match",    accent: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
  { min: 3,  label: "Partial match", accent: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
  { min: 0,  label: "Weak match",    accent: "text-white/40",    bg: "bg-white/5",         border: "border-white/10" },
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

function BarChart({ items, valueKey, labelKey, formatValue }) {
  const max = items[0]?.[valueKey] || 1;
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, idx) => {
        const pct = Math.max((item[valueKey] / max) * 100, 6);
        return (
          <div key={idx} className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-white/80 font-medium truncate max-w-[70%]">{item[labelKey]}</span>
              <span className="text-white/50 font-semibold">{formatValue(item)}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500/70 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ResolutionSupport() {
  const [query,          setQuery]         = useState("");
  const [results,        setResults]       = useState([]);
  const [loading,        setLoading]       = useState(false);
  const [searched,       setSearched]      = useState(false);
  const [error,          setError]         = useState("");
  const [expandedItems,  setExpandedItems] = useState({});
  const [expandedWhy,    setExpandedWhy]   = useState({});
  const [showFilters,    setShowFilters]   = useState(false);

  // Filters
  const [resolutionFilter, setResolutionFilter] = useState("");
  const [componentFilter,  setComponentFilter]  = useState("");
  const [minDays,          setMinDays]          = useState("");
  const [maxDays,          setMaxDays]          = useState("");

  // Analytics panels
  const [componentTrends,       setComponentTrends]       = useState([]);
  const [componentCorrelations, setComponentCorrelations] = useState([]);
  const [trendsLoading,         setTrendsLoading]         = useState(true);
  // "mozilla" = Firefox/Bugzilla data | "company" = user's own resolved bugs
  const [source, setSource] = useState(null);

  const hasActiveFilters = resolutionFilter || componentFilter || minDays || maxDays;

  const isMozilla = source === "mozilla";

  useEffect(() => {
    const load = async () => {
      setTrendsLoading(true);
      try {
        const [trendRes, corrRes] = await Promise.all([
          axios.get("/api/resolution-support/component-trends"),
          axios.get("/api/resolution-support/component-resolution-correlation"),
        ]);
        setComponentTrends(trendRes.data.trends || []);
        setComponentCorrelations(corrRes.data.correlations || []);
        setSource(trendRes.data.source || "company");
      } catch {
        setComponentTrends([]);
        setComponentCorrelations([]);
      } finally {
        setTrendsLoading(false);
      }
    };
    load();
  }, []);

  const handleSearch = async (overrideQuery) => {
    const text = typeof overrideQuery === "string" ? overrideQuery : query;
    if (!text.trim()) return;
    if (typeof overrideQuery === "string") setQuery(text);

    setLoading(true); setError(""); setSearched(true); setResults([]);
    setExpandedItems({}); setExpandedWhy({});

    try {
      const res = await axios.post("/api/resolution-support/search", {
        summary:          text,
        resolution_filter: resolutionFilter || null,
        component_filter:  componentFilter  || null,
        min_days:          minDays !== "" ? Number(minDays) : null,
        max_days:          maxDays !== "" ? Number(maxDays) : null,
      });
      setResults(res.data.results || []);
      if (res.data.source) setSource(res.data.source);
    } catch (err) {
      console.error(err);
      setError("Could not reach the intelligence backend. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setQuery(""); setResults([]); setSearched(false); setError("");
    setExpandedItems({}); setExpandedWhy({});
  };

  const clearFilters = () => {
    setResolutionFilter(""); setComponentFilter(""); setMinDays(""); setMaxDays("");
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
            {source && (
              <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-widest uppercase ${
                isMozilla
                  ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              }`}>
                {isMozilla ? "Mozilla Bugzilla" : "Company Data"}
              </div>
            )}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest uppercase">Live Search</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Resolution <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">support</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            {isMozilla
              ? "Search historically resolved Mozilla Bugzilla bugs. Surface how similar anomalies were fixed, which component owned them, and average resolution times."
              : "Search your company's resolved bugs. Surface how similar issues were fixed, which component owned them, and resolution patterns over time."
            }
          </p>
        </div>
        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-blue-500/20 via-white/5 to-transparent" />
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative flex items-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-colors focus-within:border-blue-500/50 focus-within:bg-white/10 shadow-lg">
            <Search size={18} className="absolute left-5 text-white/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Describe the bug you are working on…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="w-full bg-transparent h-14 pl-14 pr-4 text-white placeholder:text-white/30 focus:outline-none text-base"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(f => !f)}
              className={`h-14 px-4 rounded-2xl border font-semibold text-sm flex items-center gap-2 transition-all ${
                showFilters || hasActiveFilters
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                  : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Filter size={15} />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-blue-400 ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              className="h-14 px-8 bg-white text-black hover:bg-zinc-200 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] whitespace-nowrap"
            >
              {loading ? <><RefreshCw size={16} className="animate-spin" /> Searching</> : <><Search size={16} /> Search KB</>}
            </button>
            {searched && (
              <button
                type="button"
                onClick={handleReset}
                title="Clear"
                className="h-14 w-14 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-white/50 hover:text-red-400 rounded-2xl flex items-center justify-center transition-all flex-shrink-0"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-3 p-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md animate-in fade-in duration-200">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1 min-w-[170px]">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Resolution type</label>
                <CustomSelect
                  value={resolutionFilter}
                  onChange={v => setResolutionFilter(v)}
                  placeholder="All types"
                  options={[
                    { value: '', label: 'All types' }, { value: 'fixed', label: 'FIXED' },
                    { value: 'duplicate', label: 'DUPLICATE' }, { value: 'worksforme', label: 'WORKSFORME' },
                    { value: 'invalid', label: 'INVALID' }, { value: 'wontfix', label: 'WONTFIX' }
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Component</label>
                <input
                  type="text"
                  value={componentFilter}
                  onChange={e => setComponentFilter(e.target.value)}
                  placeholder="e.g. Networking"
                  className="h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex flex-col gap-1 w-28">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Min days</label>
                <input
                  type="number"
                  value={minDays}
                  onChange={e => setMinDays(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex flex-col gap-1 w-28">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Max days</label>
                <input
                  type="number"
                  value={maxDays}
                  onChange={e => setMaxDays(e.target.value)}
                  placeholder="∞"
                  min="0"
                  className="h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-10 px-4 rounded-xl border border-white/10 bg-transparent text-white/50 hover:text-red-400 hover:border-red-500/30 text-sm font-semibold transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 px-2 opacity-60">
          <History size={12} className="text-white/60" />
          <span className="text-xs text-white/60">
            {isMozilla
              ? <>Searches across <strong className="text-white font-semibold">resolved Mozilla Bugzilla data</strong>. Try "memory leak tabs" or "extension high CPU".</>
              : <>Searches across <strong className="text-white font-semibold">your company's resolved bugs</strong>. Try keywords from bug summaries your team has already closed.</>
            }
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-semibold flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Pre-search state: example queries + analytics panels */}
      {!searched && !loading && (
        <div className="animate-in fade-in duration-500">
          {/* Example queries */}
          <div className="mt-8 text-center">
            <p className="text-[10px] font-bold text-white/40 mb-6 flex items-center justify-center gap-2 tracking-widest uppercase">
              <Lightbulb size={12} className="text-blue-400" /> Quick examples
            </p>
            <div className="flex flex-wrap gap-3 justify-center max-w-3xl mx-auto mb-12">
              {EXAMPLE_QUERIES.map((sample, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSearch(sample)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-full text-xs px-5 py-2.5 font-medium transition-all"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {/* Analytics panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Component Trends */}
            <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 size={14} className="text-blue-400" />
                <h2 className="text-sm font-bold text-white tracking-tight">Top Bug Components</h2>
              </div>
              <p className="text-xs text-white/40 mb-6">
                {isMozilla ? "Most common components in resolved Mozilla Bugzilla imports." : "Most common components in your company's resolved bugs."}
              </p>
              {trendsLoading ? (
                <div className="flex flex-col gap-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex flex-col gap-1 animate-pulse">
                      <div className="flex justify-between">
                        <div className="bg-white/10 rounded w-32 h-3" />
                        <div className="bg-white/10 rounded w-10 h-3" />
                      </div>
                      <div className="bg-white/5 rounded-full h-2 w-full" />
                    </div>
                  ))}
                </div>
              ) : componentTrends.length === 0 ? (
                <p className="text-white/30 text-xs text-center py-8">No trend data available.</p>
              ) : (
                <BarChart
                  items={componentTrends}
                  valueKey="count"
                  labelKey="component"
                  formatValue={item => item.count.toLocaleString()}
                />
              )}
            </div>

            {/* Component vs Avg Resolution Time */}
            <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8">
              <div className="flex items-center gap-2 mb-1">
                <Clock3 size={14} className="text-indigo-400" />
                <h2 className="text-sm font-bold text-white tracking-tight">Component vs Avg Resolution Time</h2>
              </div>
              <p className="text-xs text-white/40 mb-6">
                {isMozilla ? "Average days to resolve by component (Mozilla Bugzilla)." : "Average days to resolve by component (your company's data)."}
              </p>
              {trendsLoading ? (
                <div className="flex flex-col gap-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex flex-col gap-1 animate-pulse">
                      <div className="flex justify-between">
                        <div className="bg-white/10 rounded w-32 h-3" />
                        <div className="bg-white/10 rounded w-16 h-3" />
                      </div>
                      <div className="bg-white/5 rounded-full h-2 w-full" />
                    </div>
                  ))}
                </div>
              ) : componentCorrelations.length === 0 ? (
                <p className="text-white/30 text-xs text-center py-8">No correlation data available.</p>
              ) : (
                <BarChart
                  items={componentCorrelations}
                  valueKey="average_resolved_days"
                  labelKey="component"
                  formatValue={item => `${item.average_resolved_days}d`}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* No results */}
      {searched && !loading && results.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl mt-8">
          <Search size={32} className="text-white/20 mb-4" />
          <p className="text-white text-lg font-bold mb-2">No matching resolved bugs found</p>
          <p className="text-white/50 text-sm text-center max-w-md">
            Try different keywords, a broader description, or clear your filters.
          </p>
        </div>
      )}

      {/* Results header */}
      {!loading && results.length > 0 && (
        <div className="mt-8 mb-6 flex justify-between items-end">
          <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <BarChart2 size={14} className="text-white/40" /> {results.length} similar resolved anomalies
          </span>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Sorted by relevance</span>
        </div>
      )}

      {/* Results grid */}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {results.map((item, idx) => {
            const sc = getScoreConfig(item.match_score ?? 0);
            const isExpanded    = expandedItems[idx] ?? false;
            const isWhyExpanded = expandedWhy[idx]   ?? false;
            const resText       = item.resolution_text || "";
            const isTruncated   = resText.length > 280;

            return (
              <div
                key={item.id ?? idx}
                className="group bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden transition-all hover:bg-white/[0.04] hover:border-white/20 flex flex-col gap-5"
              >
                {/* Color accent bar */}
                <div className={`absolute top-0 left-0 w-full h-[2px] ${sc.bg.replace("/10", "/50")}`} />

                {/* Top row: status + score */}
                <div className="flex justify-between items-center gap-4 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                    <CheckCircle2 size={12} /> {item.status || "RESOLVED"}
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${sc.bg} ${sc.border} ${sc.accent}`}>
                    {sc.label} · {item.match_score ?? 0}
                  </div>
                </div>

                {/* Summary */}
                <h3 className="m-0 text-lg font-bold text-white leading-snug line-clamp-3">{item.summary || "—"}</h3>

                {/* Meta row */}
                <div className="flex gap-6 flex-wrap border-b border-white/10 pb-5">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Wrench size={14} className={sc.accent} />
                    <span><strong className="text-white font-medium">Component:</strong> {item.component || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Clock3 size={14} className={sc.accent} />
                    <span><strong className="text-white font-medium">Resolved in:</strong> {item.resolved_in_days != null ? `${item.resolved_in_days} days` : "N/A"}</span>
                  </div>
                </div>

                {/* Resolution box */}
                <div className={`bg-white/5 rounded-xl p-5 border-l-2 ${sc.border.replace("border-", "border-l-")}`}>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">
                    Resolution · {item.resolution || "FIXED"}
                  </div>
                  <p className="m-0 text-sm text-white/80 leading-relaxed break-words">
                    {resText
                      ? (isExpanded ? resText : resText.slice(0, 280) + (isTruncated ? "…" : ""))
                      : "No resolution details recorded."}
                  </p>
                  {isTruncated && (
                    <button
                      onClick={() => setExpandedItems(prev => ({ ...prev, [idx]: !prev[idx] }))}
                      className="mt-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>

                {/* Bugzilla link */}
                {item.bug_url && (
                  <a
                    href={item.bug_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                  >
                    <ExternalLink size={12} /> Open in Bugzilla
                  </a>
                )}

                {/* Why this matched — collapsible */}
                {(item.match_reasons?.length > 0 || item.score_breakdown || item.matched_keywords) && (
                  <div className="border-t border-white/10 pt-4">
                    <button
                      type="button"
                      onClick={() => setExpandedWhy(prev => ({ ...prev, [idx]: !prev[idx] }))}
                      className="flex items-center gap-2 text-[10px] font-bold text-white/40 hover:text-white/70 uppercase tracking-widest transition-colors w-full text-left"
                    >
                      <Lightbulb size={11} className="text-blue-400 flex-shrink-0" />
                      Why this matched
                      {isWhyExpanded ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
                    </button>

                    {isWhyExpanded && (
                      <div className="mt-3 flex flex-col gap-3 animate-in fade-in duration-200">
                        {/* Match reasons */}
                        {item.match_reasons?.length > 0 && (
                          <ul className="text-xs text-white/60 leading-relaxed space-y-1 pl-1">
                            {item.match_reasons.map((r, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-blue-400 mt-0.5">•</span> {r}
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Score breakdown */}
                        {item.score_breakdown && (
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            {[
                              ["Exact phrase", item.score_breakdown.exact_summary_match],
                              ["Summary keywords", item.score_breakdown.summary_keyword_match],
                              ["Resolution text", item.score_breakdown.resolution_text_match],
                              ["Component",       item.score_breakdown.component_match],
                            ].map(([label, val]) => (
                              <div key={label} className="flex justify-between bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                                <span className="text-white/40">{label}</span>
                                <span className={`font-bold ${val > 0 ? "text-blue-400" : "text-white/20"}`}>{val}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Matched keywords */}
                        {item.matched_keywords && (
                          <div className="flex flex-col gap-1.5 text-[11px]">
                            {[
                              ["Summary",    item.matched_keywords.summary],
                              ["Resolution", item.matched_keywords.resolution_text],
                              ["Component",  item.matched_keywords.component],
                            ].map(([label, words]) => (
                              <div key={label} className="flex items-center gap-2">
                                <span className="text-white/30 w-20 flex-shrink-0">{label}:</span>
                                {words?.length > 0
                                  ? words.map(w => (
                                      <span key={w} className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-medium">{w}</span>
                                    ))
                                  : <span className="text-white/20">—</span>
                                }
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
