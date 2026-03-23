import { useState } from "react";
import {
  Search, History, Clock3, CheckCircle2, Wrench,
  ExternalLink, Lightbulb, BarChart2, BookOpen, X
} from "lucide-react";

const EXAMPLE_QUERIES = [
  "Video playback crashes on startup",
  "Memory leak when opening many tabs",
  "Login fails on password protected sites",
  "Extension causes high CPU usage",
];

const SCORE_CONFIG = [
  { min: 10, label: "Strong match",  accent: "var(--success)",  bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)" },
  { min: 6,  label: "Good match",    accent: "var(--accent)",   bg: "var(--pill-bg)",         border: "rgba(37,99,235,0.25)" },
  { min: 3,  label: "Partial match", accent: "#f59e0b",         bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.22)" },
  { min: 0,  label: "Weak match",    accent: "var(--text-sec)", bg: "var(--hover-bg)",        border: "var(--border)" },
];

function getScoreConfig(score) {
  return SCORE_CONFIG.find(c => score >= c.min) || SCORE_CONFIG[SCORE_CONFIG.length - 1];
}

function SkeletonCard() {
  return (
    <div className="sys-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div className="skeleton" style={{ width: 90, height: 22 }} />
        <div className="skeleton" style={{ width: 70, height: 22 }} />
      </div>
      <div className="skeleton" style={{ width: "85%", height: 18 }} />
      <div className="skeleton" style={{ width: "60%", height: 18 }} />
      <div style={{ display: "flex", gap: 10 }}>
        <div className="skeleton" style={{ width: 120, height: 16 }} />
        <div className="skeleton" style={{ width: 100, height: 16 }} />
      </div>
      <div className="skeleton" style={{ width: "100%", height: 56, borderRadius: 8 }} />
    </div>
  );
}

export default function ResolutionSupport() {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError]     = useState("");

  const handleSearch = async (overrideQuery) => {
    const text = overrideQuery ?? query;
    if (!text.trim()) return;
    if (overrideQuery !== undefined) setQuery(overrideQuery);

    setLoading(true);
    setError("");
    setSearched(true);
    setResults([]);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/resolution-support/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: text }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error(err);
      setError("Could not reach the backend. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setQuery(""); setResults([]); setSearched(false); setError("");
  };

  return (
    <div className="scroll-container fade-in">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="demo-page-header">
        <div>
          <div className="demo-page-meta">
            <span className="demo-badge demo-badge-blue">
              <BookOpen size={10} /> Resolution KB
            </span>
            <span className="demo-badge demo-badge-live">
              <span className="demo-live-dot" style={{ width: 6, height: 6 }} /> Live
            </span>
          </div>
          <h1 className="demo-page-title">Resolution Support</h1>
          <p className="demo-page-subtitle">
            Search historically resolved Firefox bugs. Surface how similar issues were fixed,
            which component owned them, and how long they took to resolve.
          </p>
        </div>
        {searched && (
          <button
            onClick={handleReset}
            className="sys-btn outline"
            style={{ borderRadius: 99, fontSize: 12, padding: "6px 14px", gap: 6, flexShrink: 0 }}
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* ── Search hero ──────────────────────────────────────────────────────── */}
      <div className="demo-search-hero">
        <div style={{ position: "relative" }}>
          {/* Input row */}
          <div className="demo-search-row">
            <div style={{ position: "relative", flex: 1 }}>
              <span className="demo-search-icon-wrap">
                <Search size={17} />
              </span>
              <input
                type="text"
                className="demo-search-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Describe the bug you are working on…"
              />
            </div>
            <button
              className="demo-search-btn"
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
            >
              {loading
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Searching…</>
                : <><Search size={15} /> Search</>
              }
            </button>
          </div>

          {/* Hint row */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6, color: "var(--text-sec)", fontSize: 12.5 }}>
            <History size={13} />
            <span>Searches across {" "}
              <strong style={{ color: "var(--text-main)" }}>resolved Firefox bugs</strong>
              {" "}— try phrases like "memory leak tabs" or "extension high CPU"
            </span>
          </div>
        </div>

        {/* Example chips */}
        {!searched && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Lightbulb size={12} color="var(--accent)" /> Quick examples
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EXAMPLE_QUERIES.map(q => (
                <button key={q} className="demo-chip" onClick={() => handleSearch(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="demo-danger-box" style={{ marginBottom: 20, fontSize: 13, fontWeight: 600, color: "var(--danger)", display: "flex", alignItems: "center", gap: 10 }}>
          <X size={16} /> {error}
        </div>
      )}

      {/* ── Skeleton loading ─────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
          {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {searched && !loading && results.length === 0 && !error && (
        <div className="sys-card demo-empty-state">
          <div className="demo-empty-icon">
            <Search size={24} color="var(--text-sec)" />
          </div>
          <p className="demo-empty-title">No matching resolved bugs found</p>
          <p className="demo-empty-sub">
            Try different keywords or a broader description. The knowledge base contains resolved, fixed Firefox bugs.
          </p>
        </div>
      )}

      {/* ── Results header ───────────────────────────────────────────────────── */}
      {!loading && results.length > 0 && (
        <div className="demo-section-header" style={{ marginBottom: 16 }}>
          <span className="demo-section-title">
            <BarChart2 size={13} /> {results.length} similar resolved bug{results.length !== 1 ? "s" : ""} found
          </span>
          <span style={{ fontSize: 11, color: "var(--text-sec)" }}>
            Sorted by relevance
          </span>
        </div>
      )}

      {/* ── Result cards grid ────────────────────────────────────────────────── */}
      {!loading && results.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
          {results.map((item, idx) => {
            const sc = getScoreConfig(item.match_score ?? 0);
            return (
              <div key={item.id ?? idx} className="demo-result-card" style={{ borderTop: `2.5px solid ${sc.accent}` }}>

                {/* Top row: status badge + score */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", fontSize: 11, fontWeight: 700, color: "var(--success)" }}>
                    <CheckCircle2 size={12} /> {item.status || "RESOLVED"}
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: sc.bg, border: `1px solid ${sc.border}`, fontSize: 11, fontWeight: 700, color: sc.accent }}>
                    {sc.label} · {item.match_score ?? 0}
                  </div>
                </div>

                {/* Summary */}
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.45 }}>
                  {item.summary || "—"}
                </h3>

                {/* Meta row */}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-sec)" }}>
                    <Wrench size={13} color={sc.accent} />
                    <span><strong style={{ color: "var(--text-main)" }}>Component:</strong> {item.component || "N/A"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-sec)" }}>
                    <Clock3 size={13} color={sc.accent} />
                    <span><strong style={{ color: "var(--text-main)" }}>Resolved in:</strong> {item.resolved_in_days != null ? `${item.resolved_in_days} days` : "N/A"}</span>
                  </div>
                </div>

                {/* Resolution details */}
                <div style={{ background: "var(--hover-bg)", borderRadius: 9, padding: "12px 14px", borderLeft: `3px solid ${sc.accent}` }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Resolution · {item.resolution || "FIXED"}
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: "var(--text-main)", wordBreak: "break-word" }}>
                    {item.resolution_text
                      ? item.resolution_text.slice(0, 280) + (item.resolution_text.length > 280 ? "…" : "")
                      : "No resolution details recorded."}
                  </p>
                </div>

                {/* Bugzilla link */}
                {item.bug_url && (
                  <a
                    href={item.bug_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none", marginTop: 2 }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                  >
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
