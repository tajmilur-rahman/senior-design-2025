import { useState, useEffect } from "react";
import axios from "axios";
import {
  Search, History, Clock3, CheckCircle2, Wrench,
  ExternalLink, Lightbulb, BarChart2, BookOpen, X,
  RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Filter,
  Database,
} from "lucide-react";

const EXAMPLE_QUERIES = [
  "Video playback crashes on startup",
  "Memory leak when opening many tabs",
  "Login fails on password protected sites",
  "Extension causes high CPU usage",
];

const SCORE_CONFIG = [
  { min: 10, label: "Strong match", accent: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { min: 6, label: "Good match", accent: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { min: 3, label: "Partial match", accent: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { min: 0, label: "Weak match", accent: "text-white/40", bg: "bg-white/5", border: "border-white/10" },
];

function getScoreConfig(score) {
  return SCORE_CONFIG.find((c) => score >= c.min) || SCORE_CONFIG[SCORE_CONFIG.length - 1];
}

function getSeverityBadgeClasses(severity) {
  switch ((severity || "").toUpperCase()) {
    case "S1":
      return "bg-red-500/10 border-red-500/20 text-red-400";
    case "S2":
      return "bg-orange-500/10 border-orange-500/20 text-orange-400";
    case "S3":
      return "bg-yellow-500/10 border-yellow-500/20 text-yellow-300";
    case "S4":
      return "bg-sky-500/10 border-sky-500/20 text-sky-400";
    default:
      return "bg-white/5 border-white/10 text-white/40";
  }
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

function VerticalBarChart({ items, valueKey, labelKey, formatValue }) {
  const max = items.reduce((acc, item) => Math.max(acc, item[valueKey] || 0), 0) || 1;

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="flex gap-4 mb-3 px-1">
          {items.map((item, idx) => (
            <div key={`value-${idx}`} className="flex-1 min-w-0 text-center">
              <span className="text-[11px] text-white/60 font-semibold">
                {formatValue(item)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-4 h-56 border-b border-white/10 px-1">
          {items.map((item, idx) => {
            const value = item[valueKey] || 0;
            const pct = Math.max((value / max) * 100, 6);

            return (
              <div
                key={`bar-${idx}`}
                className="flex-1 min-w-0 h-full flex items-end justify-center"
              >
                <div
                  className="w-full max-w-[56px] rounded-t-xl bg-blue-500/70 transition-all duration-500"
                  style={{ height: `${pct}%` }}
                  title={`${item[labelKey]}: ${formatValue(item)}`}
                />
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 pt-3 px-1">
          {items.map((item, idx) => (
            <div
              key={`label-${idx}`}
              className="flex-1 min-w-0 h-14 flex items-start justify-center"
            >
              <span className="text-[11px] text-white/70 text-center leading-tight break-words">
                {item[labelKey]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScatterPlot({
  points,
  xLabel,
  yLabel,
  xFormatter,
  yFormatter,
  pointColor = "cyan",
  customXTicks = null,
}) {
  if (!points || points.length === 0) {
    return (
      <p className="text-white/30 text-xs text-center py-8">
        No correlation data available.
      </p>
    );
  }

  const safePoints = points.filter(
    (p) =>
      typeof p?.x === "number" &&
      !Number.isNaN(p.x) &&
      typeof p?.y === "number" &&
      !Number.isNaN(p.y)
  );

  if (safePoints.length === 0) {
    return (
      <p className="text-white/30 text-xs text-center py-8">
        No valid correlation points available.
      </p>
    );
  }

  const sortedX = [...safePoints].map((p) => p.x).sort((a, b) => a - b);
  const sortedY = [...safePoints].map((p) => p.y).sort((a, b) => a - b);

  const percentile = (arr, q) => {
    if (arr.length === 0) return 1;
    const pos = (arr.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (arr[base + 1] !== undefined) {
      return arr[base] + rest * (arr[base + 1] - arr[base]);
    }
    return arr[base];
  };

  const xCap = Math.max(percentile(sortedX, 0.95), 1);
  const yCap = Math.max(percentile(sortedY, 0.95), 1);

  const xMax = Math.max(...sortedX, 1);
  const yMax = Math.max(...sortedY, 1);

  const plotMaxX = Math.max(xCap, xMax * 0.98);
  const plotMaxY = Math.max(yCap, yMax * 0.98);

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const tickValues = (max) => [0, max * 0.25, max * 0.5, max * 0.75, max];

  const pointClassMap = {
    cyan: "bg-cyan-400/65 hover:bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.45)]",
    fuchsia: "bg-fuchsia-400/65 hover:bg-fuchsia-300 shadow-[0_0_8px_rgba(217,70,239,0.45)]",
    emerald: "bg-emerald-400/65 hover:bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.45)]",
  };

  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-white/35 mb-3 uppercase tracking-widest">
        <span>{yLabel}</span>
        <span>{xLabel}</span>
      </div>

      <div className="relative h-80 rounded-2xl border border-white/10 bg-white/[0.02] px-4 pt-4 pb-12 overflow-hidden">
        <div className="absolute left-14 right-6 top-4 bottom-12">
          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <div
              key={`h-${r}`}
              className="absolute left-0 right-0 border-t border-white/[0.05]"
              style={{ bottom: `${r * 100}%` }}
            />
          ))}

          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <div
              key={`v-${r}`}
              className="absolute top-0 bottom-0 border-l border-white/[0.05]"
              style={{ left: `${r * 100}%` }}
            />
          ))}

          <div className="absolute left-0 right-0 bottom-0 border-t border-white/15" />
          <div className="absolute top-0 bottom-0 left-0 border-l border-white/15" />

          {safePoints.map((point, idx) => {
            const shouldJitterX = xLabel === "Severity";
            const jitterAmount = shouldJitterX ? ((idx % 7) - 3) * 0.06 : 0;
            const jitteredX = point.x + jitterAmount;

            const scaledX = clamp(jitteredX, 0, plotMaxX);
            const scaledY = clamp(point.y, 0, plotMaxY);

            const leftPct = (scaledX / plotMaxX) * 100;
            const bottomPct = (scaledY / plotMaxY) * 100;

            return (
              <div
                key={idx}
                className={`absolute w-2.5 h-2.5 rounded-full transition-colors ${pointClassMap[pointColor] || pointClassMap.cyan}`}
                style={{
                  left: `calc(${leftPct}% - 5px)`,
                  bottom: `calc(${bottomPct}% - 5px)`,
                }}
                title={`${point.label || "Bug"} | ${xLabel}: ${xFormatter ? xFormatter(point.x) : point.x}, ${yLabel}: ${yFormatter ? yFormatter(point.y) : point.y}`}
              />
            );
          })}
        </div>

        <div className="absolute left-0 top-4 bottom-12 w-14">
          {tickValues(plotMaxY).map((tick, idx) => (
            <div
              key={`yt-${idx}`}
              className="absolute right-2 text-[10px] text-white/35"
              style={{ bottom: `${(idx / 4) * 100}%`, transform: "translateY(50%)" }}
            >
              {yFormatter ? yFormatter(Math.round(tick * 10) / 10) : Math.round(tick)}
            </div>
          ))}
        </div>

        <div className="absolute left-14 right-6 bottom-3 h-8">
          {(customXTicks || tickValues(plotMaxX)).map((tick, idx, arr) => {
            const leftPct = customXTicks
              ? (tick / plotMaxX) * 100
              : (idx / (arr.length - 1)) * 100;

            return (
              <div
                key={`xt-${idx}`}
                className="absolute text-[10px] text-white/35 -translate-x-1/2"
                style={{ left: `${leftPct}%` }}
              >
                {xFormatter ? xFormatter(tick) : Math.round(tick)}
              </div>
            );
          })}
        </div>

        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[11px] text-white/45">
          {xLabel}
        </div>

        <div className="absolute top-1/2 left-2 -translate-y-1/2 -rotate-90 origin-left text-[11px] text-white/45">
          {yLabel}
        </div>
      </div>

      <div className="mt-3 text-[10px] text-white/30 leading-relaxed">
        Points are capped visually near the 95th percentile to reduce distortion from extreme outliers.
      </div>
    </div>
  );
}

function ComponentSeverityGrid({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="text-white/30 text-xs text-center py-8">
        No component severity data available.
      </p>
    );
  }

  const severityOrder = ["S1", "S2", "S3", "S4"];

  const grouped = rows.reduce((acc, row) => {
    const component = row.component || "Unknown";
    if (!acc[component]) {
      acc[component] = { component, S1: 0, S2: 0, S3: 0, S4: 0 };
    }
    if (severityOrder.includes(row.severity)) {
      acc[component][row.severity] = row.count || 0;
    }
    return acc;
  }, {});

  const items = Object.values(grouped).slice(0, 8);

  const maxCount = Math.max(
    1,
    ...items.flatMap((item) => severityOrder.map((sev) => item[sev] || 0))
  );

  const getCellStyle = (count, sev) => {
    const opacity = Math.max(0.08, count / maxCount);
    switch (sev) {
      case "S1":
        return { backgroundColor: `rgba(239, 68, 68, ${opacity})` };
      case "S2":
        return { backgroundColor: `rgba(249, 115, 22, ${opacity})` };
      case "S3":
        return { backgroundColor: `rgba(250, 204, 21, ${opacity})` };
      case "S4":
        return { backgroundColor: `rgba(56, 189, 248, ${opacity})` };
      default:
        return { backgroundColor: `rgba(255,255,255,0.08)` };
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[680px]">
        <div className="grid grid-cols-[200px_repeat(4,1fr)] gap-2 text-[11px] text-white/50 font-bold uppercase tracking-widest mb-2">
          <div>Component</div>
          <div className="text-center">S1</div>
          <div className="text-center">S2</div>
          <div className="text-center">S3</div>
          <div className="text-center">S4</div>
        </div>

        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.component}
              className="grid grid-cols-[200px_repeat(4,1fr)] gap-2 items-stretch"
            >
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-white/75 leading-tight">
                {item.component}
              </div>

              {severityOrder.map((sev) => (
                <div
                  key={`${item.component}-${sev}`}
                  className="rounded-xl border border-white/10 px-3 py-3 text-center text-sm font-bold text-white"
                  style={getCellStyle(item[sev] || 0, sev)}
                  title={`${item.component} | ${sev}: ${item[sev] || 0}`}
                >
                  {item[sev] || 0}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalyticsCard({ title, subtitle, icon, children }) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h2 className="text-sm font-bold text-white tracking-tight">{title}</h2>
      </div>
      <p className="text-xs text-white/40 mb-6">{subtitle}</p>
      {children}
    </div>
  );
}

export default function ResolutionSupport() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [expandedItems, setExpandedItems] = useState({});
  const [expandedWhy, setExpandedWhy] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  const [resolutionFilter, setResolutionFilter] = useState("");
  const [componentFilter, setComponentFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [minDays, setMinDays] = useState("");
  const [maxDays, setMaxDays] = useState("");

  const [componentTrends, setComponentTrends] = useState([]);
  const [componentCorrelations, setComponentCorrelations] = useState([]);
  const [summaryLengthPoints, setSummaryLengthPoints] = useState([]);
  const [severityVsResolvedDaysPoints, setSeverityVsResolvedDaysPoints] = useState([]);
  const [componentSeverityRows, setComponentSeverityRows] = useState([]);
  const [trendsLoading, setTrendsLoading] = useState(true);

  const [source, setSource] = useState(null);

  const hasActiveFilters =
    resolutionFilter || componentFilter || severityFilter || minDays || maxDays;
  const isMozilla = source === "mozilla";

  useEffect(() => {
    const load = async () => {
      setTrendsLoading(true);

      const responses = await Promise.allSettled([
        axios.get("/api/resolution-support/component-trends"),
        axios.get("/api/resolution-support/component-resolution-correlation"),
        axios.get("/api/resolution-support/summary-length-correlation"),
        axios.get("/api/resolution-support/severity-vs-resolved-days-correlation"),
        axios.get("/api/resolution-support/component-severity-distribution"),
      ]);

      const [trendRes, corrRes, summaryRes, severityRes, componentSeverityRes] = responses;

      if (trendRes.status === "fulfilled") {
        setComponentTrends(trendRes.value.data.trends || []);
        setSource(trendRes.value.data.source || "company");
      } else {
        console.error("component-trends failed:", trendRes.reason);
        setComponentTrends([]);
      }

      if (corrRes.status === "fulfilled") {
        setComponentCorrelations(corrRes.value.data.correlations || []);
      } else {
        console.error("component-resolution-correlation failed:", corrRes.reason);
        setComponentCorrelations([]);
      }

      if (summaryRes.status === "fulfilled") {
        setSummaryLengthPoints(summaryRes.value.data.points || []);
      } else {
        console.error("summary-length-correlation failed:", summaryRes.reason);
        setSummaryLengthPoints([]);
      }

      if (severityRes.status === "fulfilled") {
        setSeverityVsResolvedDaysPoints(severityRes.value.data.points || []);
      } else {
        console.error("severity-vs-resolved-days-correlation failed:", severityRes.reason);
        setSeverityVsResolvedDaysPoints([]);
      }

      if (componentSeverityRes.status === "fulfilled") {
        setComponentSeverityRows(componentSeverityRes.value.data.rows || []);
      } else {
        console.error("component-severity-distribution failed:", componentSeverityRes.reason);
        setComponentSeverityRows([]);
      }

      setTrendsLoading(false);
    };

    load();
  }, []);

  const handleSearch = async (overrideQuery) => {
    const text = typeof overrideQuery === "string" ? overrideQuery : query;
    if (!text.trim()) return;
    if (typeof overrideQuery === "string") setQuery(text);

    setLoading(true);
    setError("");
    setSearched(true);
    setResults([]);
    setExpandedItems({});
    setExpandedWhy({});

    try {
      const res = await axios.post("/api/resolution-support/search", {
        summary: text,
        resolution_filter: resolutionFilter || null,
        component_filter: componentFilter || null,
        severity_filter: severityFilter || null,
        min_days: minDays !== "" ? Number(minDays) : null,
        max_days: maxDays !== "" ? Number(maxDays) : null,
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
    setQuery("");
    setResults([]);
    setSearched(false);
    setError("");
    setExpandedItems({});
    setExpandedWhy({});
  };

  const clearFilters = () => {
    setResolutionFilter("");
    setComponentFilter("");
    setSeverityFilter("");
    setMinDays("");
    setMaxDays("");
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-400">
              <BookOpen size={12} className="text-blue-500" />
              <span className="text-[10px] font-bold tracking-widest uppercase">Resolution KB</span>
            </div>

            {source && (
              <div
                className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-widest uppercase ${
                  isMozilla
                    ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                }`}
              >
                {isMozilla ? "Mozilla Bugzilla" : "Company Data"}
              </div>
            )}

            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest uppercase">Live Search</span>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Resolution <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Support</span>
          </h1>

          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            {isMozilla
              ? "Search historically resolved Mozilla Bugzilla bugs. Surface how similar anomalies were fixed, which component owned them, severity, and average resolution times."
              : "Search your company's resolved bugs. Surface how similar issues were fixed, which component owned them, severity, and resolution patterns over time."
            }
          </p>
        </div>

        <div className="absolute -bottom-6 left-0 right-0 h-px bg-gradient-to-r from-blue-500/20 via-white/5 to-transparent" />
      </div>

      <div className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative flex items-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-colors focus-within:border-blue-500/50 focus-within:bg-white/10 shadow-lg">
            <Search size={18} className="absolute left-5 text-white/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Describe the bug you are working on…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full bg-transparent h-14 pl-14 pr-4 text-white placeholder:text-white/30 focus:outline-none text-base"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((f) => !f)}
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
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Searching
                </>
              ) : (
                <>
                  <Search size={16} />
                  Search KB
                </>
              )}
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

        {showFilters && (
          <div className="mt-3 p-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md animate-in fade-in duration-200">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1 min-w-[170px]">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Resolution type</label>
                <select
                  value={resolutionFilter}
                  onChange={(e) => setResolutionFilter(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-white/10 bg-zinc-900 text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value=""       className="bg-zinc-900 text-white">All types</option>
                  <option value="fixed"       className="bg-zinc-900 text-white">FIXED</option>
                  <option value="duplicate"   className="bg-zinc-900 text-white">DUPLICATE</option>
                  <option value="worksforme"  className="bg-zinc-900 text-white">WORKSFORME</option>
                  <option value="invalid"     className="bg-zinc-900 text-white">INVALID</option>
                  <option value="wontfix"     className="bg-zinc-900 text-white">WONTFIX</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Component</label>
                <input
                  type="text"
                  value={componentFilter}
                  onChange={(e) => setComponentFilter(e.target.value)}
                  placeholder="e.g. Networking"
                  className="h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="flex flex-col gap-1 min-w-[130px]">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Severity</label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-white/10 bg-zinc-900 text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">All severities</option>
                  <option value="S1">S1</option>
                  <option value="S2">S2</option>
                  <option value="S3">S3</option>
                  <option value="S4">S4</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 w-28">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Min days</label>
                <input
                  type="number"
                  value={minDays}
                  onChange={(e) => setMinDays(e.target.value)}
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
                  onChange={(e) => setMaxDays(e.target.value)}
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
            {isMozilla ? (
              <>
                Searches across <strong className="text-white font-semibold">resolved Mozilla Bugzilla data</strong>. Try "memory leak tabs" or "extension high CPU".
              </>
            ) : (
              <>
                Searches across <strong className="text-white font-semibold">your company's resolved bugs</strong>. Try keywords from bug summaries your team has already closed.
              </>
            )}
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-semibold flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          {error}
        </div>
      )}

      {!searched && !loading && (
        <div className="animate-in fade-in duration-500">
          <div className="mt-8 text-center">
            <p className="text-[10px] font-bold text-white/40 mb-6 flex items-center justify-center gap-2 tracking-widest uppercase">
              <Lightbulb size={12} className="text-blue-400" />
              Quick examples
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <AnalyticsCard
              title="Top Bug Components"
              subtitle={isMozilla ? "Most common components in resolved Mozilla Bugzilla imports." : "Most common components in your company's resolved bugs."}
              icon={<BarChart2 size={14} className="text-blue-400" />}
            >
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
                <VerticalBarChart
                  items={componentTrends}
                  valueKey="count"
                  labelKey="component"
                  formatValue={(item) => item.count.toLocaleString()}
                />
              )}
            </AnalyticsCard>

            <AnalyticsCard
              title="Component vs Avg Resolution Time"
              subtitle={isMozilla ? "Average days to resolve by component (Mozilla Bugzilla)." : "Average days to resolve by component (your company's data)."}
              icon={<Clock3 size={14} className="text-indigo-400" />}
            >
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
                <VerticalBarChart
                  items={componentCorrelations.slice(0, 7)}
                  valueKey="average_resolved_days"
                  labelKey="component"
                  formatValue={(item) => `${item.average_resolved_days}d`}
                />
              )}
            </AnalyticsCard>

            <AnalyticsCard
              title="Summary Length vs Resolved Days"
              subtitle="Numeric correlation between summary length and resolution time."
              icon={<BarChart2 size={14} className="text-cyan-400" />}
            >
              {trendsLoading ? (
                <div className="flex items-center justify-center h-72 text-white/30 text-xs">
                  Loading correlation data...
                </div>
              ) : (
                <ScatterPlot
                  points={summaryLengthPoints}
                  xLabel="Summary Length"
                  yLabel="Resolved Days"
                  xFormatter={(v) => `${Math.round(v)}`}
                  yFormatter={(v) => `${Math.round(v)}d`}
                  pointColor="cyan"
                />
              )}
            </AnalyticsCard>

            <AnalyticsCard
              title="Severity vs Resolved Days"
              subtitle="Numeric correlation between severity level and resolution time."
              icon={<BarChart2 size={14} className="text-fuchsia-400" />}
            >
              {trendsLoading ? (
                <div className="flex items-center justify-center h-72 text-white/30 text-xs">
                  Loading correlation data...
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <ScatterPlot
                    points={severityVsResolvedDaysPoints}
                    xLabel="Severity"
                    yLabel="Resolved Days"
                    customXTicks={[1, 2, 3, 4]}
                    xFormatter={(v) => {
                      if (v === 1) return "S1";
                      if (v === 2) return "S2";
                      if (v === 3) return "S3";
                      if (v === 4) return "S4";
                      return "";
                    }}
                    yFormatter={(v) => `${Math.round(v)}d`}
                    pointColor="fuchsia"
                  />
                </div>
              )}
            </AnalyticsCard>

            <div className="xl:col-span-2">
              <AnalyticsCard
                title="Bug Components vs Severity"
                subtitle="Severity distribution by component."
                icon={<BarChart2 size={14} className="text-emerald-400" />}
              >
                {trendsLoading ? (
                  <div className="flex items-center justify-center h-72 text-white/30 text-xs">
                    Loading component severity data...
                  </div>
                ) : (
                  <ComponentSeverityGrid rows={componentSeverityRows} />
                )}
              </AnalyticsCard>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 bg-white/[0.02] border border-white/10 rounded-[2rem] shadow-2xl mt-8">
          <Search size={32} className="text-white/20 mb-4" />
          <p className="text-white text-lg font-bold mb-2">No matching resolved bugs found</p>
          <p className="text-white/50 text-sm text-center max-w-md">
            Try different keywords, a broader description, or clear your filters.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="mt-8 mb-6 flex justify-between items-end">
          <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <BarChart2 size={14} className="text-white/40" />
            {results.length} similar resolved anomalies
          </span>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Sorted by relevance</span>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {results.map((item, idx) => {
            const sc = getScoreConfig(item.match_score ?? 0);
            const isExpanded = expandedItems[idx] ?? false;
            const isWhyExpanded = expandedWhy[idx] ?? false;
            const resText = item.resolution_text || "";
            const isTruncated = resText.length > 280;

            const itemSource = item.source || (isMozilla ? "Mozilla Bugzilla" : "Company Data");
            const itemBugId = item.source_bug_id || item.bug_id || item.id || null;
            const isMozillaItem =
              itemSource === "Mozilla Bugzilla" ||
              itemSource === "mozilla" ||
              Boolean(item.bug_url);

            return (
              <div
                key={item.id ?? idx}
                className="group bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden transition-all hover:bg-white/[0.04] hover:border-white/20 flex flex-col gap-5"
              >
                <div className={`absolute top-0 left-0 w-full h-[2px] ${sc.bg.replace("/10", "/50")}`} />

                <div className="flex justify-between items-center gap-4 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                    <CheckCircle2 size={12} />
                    {item.status || "RESOLVED"}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${getSeverityBadgeClasses(item.severity)}`}>
                      {item.severity || "N/A"}
                    </div>

                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${sc.bg} ${sc.border} ${sc.accent}`}>
                    {sc.label}
                  </div>
                  </div>
                </div>

                <h3 className="m-0 text-lg font-bold text-white leading-snug line-clamp-3">
                  {item.summary || "—"}
                </h3>

                <div className="flex gap-6 flex-wrap border-b border-white/10 pb-5">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Wrench size={14} className={sc.accent} />
                    <span>
                      <strong className="text-white font-medium">Component:</strong> {item.component || "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Clock3 size={14} className={sc.accent} />
                    <span>
                      <strong className="text-white font-medium">Resolved in:</strong>{" "}
                      {item.resolved_in_days != null ? `${item.resolved_in_days} days` : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <AlertTriangle size={14} className={sc.accent} />
                    <span>
                      <strong className="text-white font-medium">Severity:</strong> {item.severity || "N/A"}
                    </span>
                  </div>
                </div>

                <div
                  className={`rounded-2xl border px-4 py-3 ${
                    isMozillaItem
                      ? "bg-violet-500/10 border-violet-500/20"
                      : "bg-emerald-500/10 border-emerald-500/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Database size={16} className={isMozillaItem ? "text-violet-400 mt-0.5" : "text-emerald-400 mt-0.5"} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">
                        Source
                      </div>

                      <div className={`text-sm font-semibold ${isMozillaItem ? "text-violet-300" : "text-emerald-300"}`}>
                        {isMozillaItem ? "Mozilla Bugzilla" : "Company Data"}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
                        {itemBugId && (
                          <span>
                            <strong className="text-white/80 font-medium">Bug ID:</strong> {itemBugId}
                          </span>
                        )}

                        {item.resolution && (
                          <span>
                            <strong className="text-white/80 font-medium">Resolution:</strong> {item.resolution}
                          </span>
                        )}

                        <span>
                          <strong className="text-white/80 font-medium">Severity:</strong> {item.severity || "N/A"}
                        </span>
                      </div>

                      {item.bug_url && (
                        <a
                          href={item.bug_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 mt-3 text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                        >
                          <ExternalLink size={12} />
                          Open in Bugzilla
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`bg-white/5 rounded-xl p-5 border-l-2 ${sc.border.replace("border-", "border-l-")}`}>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">
                    Resolution Details
                  </div>

                  <p className="m-0 text-sm text-white/80 leading-relaxed break-words">
                    {resText
                      ? (isExpanded ? resText : resText.slice(0, 280) + (isTruncated ? "…" : ""))
                      : "No resolution details recorded."}
                  </p>

                  {isTruncated && (
                    <button
                      onClick={() => setExpandedItems((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      className="mt-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>

                {(item.match_reasons?.length > 0 || item.matched_keywords) && (
                  <div className="border-t border-white/10 pt-4">
                    <button
                      type="button"
                      onClick={() => setExpandedWhy((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      className="flex items-center gap-2 text-[10px] font-bold text-white/40 hover:text-white/70 uppercase tracking-widest transition-colors w-full text-left"
                    >
                      <Lightbulb size={11} className="text-blue-400 flex-shrink-0" />
                      Why this matched
                      {isWhyExpanded ? (
                        <ChevronUp size={12} className="ml-auto" />
                      ) : (
                        <ChevronDown size={12} className="ml-auto" />
                      )}
                    </button>

                    {isWhyExpanded && (
                      <div className="mt-3 flex flex-col gap-3 animate-in fade-in duration-200">
                        {item.match_reasons?.length > 0 && (
                          <ul className="text-xs text-white/60 leading-relaxed space-y-1 pl-1">
                            {item.match_reasons.map((r, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-blue-400 mt-0.5">•</span>
                                {r}
                              </li>
                            ))}
                          </ul>
                        )}

                        {item.matched_keywords && (
                          <div className="flex flex-col gap-1.5 text-[11px]">
                            {[
                              ["Summary", item.matched_keywords.summary],
                              ["Resolution", item.matched_keywords.resolution_text],
                              ["Component", item.matched_keywords.component],
                              ["Severity", item.matched_keywords.severity],
                            ].map(([label, words]) => (
                              <div key={label} className="flex items-center gap-2 flex-wrap">
                                <span className="text-white/30 w-20 flex-shrink-0">{label}:</span>
                                {words?.length > 0
                                  ? words.map((w) => (
                                      <span
                                        key={w}
                                        className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-medium"
                                      >
                                        {w}
                                      </span>
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