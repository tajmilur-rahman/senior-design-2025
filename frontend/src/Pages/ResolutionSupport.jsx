import React, { useState } from "react";
import { Search, History, Clock3, CheckCircle2, Wrench } from "lucide-react";

export default function ResolutionSupport() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/resolution-support/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: query }),
      });

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error("Resolution support search failed:", err);
      setError("Failed to search similar resolved bugs.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="scroll-container">
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0, marginBottom: "0.5rem", color: "var(--text-main)", letterSpacing: "-0.5px" }}>
          Resolution Support
        </h1>
        <p style={{ margin: 0, color: "var(--text-sec)", fontSize: "0.98rem", lineHeight: 1.5 }}>
          Search past resolved Firefox bugs and review how they were resolved and how long they took.
        </p>
      </div>

      {/* Search card */}
      <div className="sys-card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "280px" }}>
            <Search size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-sec)", pointerEvents: "none" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter current bug summary..."
              className="sys-input"
              style={{ paddingLeft: "2.4rem" }}
            />
          </div>
          <button
            onClick={handleSearch}
            className="sys-btn"
            disabled={loading}
            style={{ minWidth: 120, borderRadius: 8 }}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        <div style={{ marginTop: "0.9rem", display: "flex", gap: "0.5rem", alignItems: "center", color: "var(--text-sec)", fontSize: "0.9rem" }}>
          <History size={16} />
          <span>Try phrases like: "show skylight experiment branch" or "message guardrail experiment".</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--danger)", padding: "0.9rem 1rem", borderRadius: "var(--radius)", marginBottom: "1rem", fontSize: "0.94rem" }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {searched && !loading && results.length === 0 && !error && (
        <div style={{ background: "var(--card-bg)", border: "1px dashed var(--border)", color: "var(--text-sec)", borderRadius: "var(--radius)", padding: "1.5rem", textAlign: "center", marginBottom: "1rem" }}>
          No similar resolved bugs were found.
        </div>
      )}

      {/* Results grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
        {results.map((item) => (
          <div key={item.id} className="sys-card" style={{ padding: "1.1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {/* Top row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.35rem 0.7rem", borderRadius: 999, background: "rgba(16,185,129,0.1)", color: "var(--success)", fontWeight: 600, fontSize: "0.85rem" }}>
                <CheckCircle2 size={14} />
                <span>{item.status || "N/A"}</span>
              </div>
              <div style={{ padding: "0.35rem 0.7rem", borderRadius: 999, background: "var(--hover-bg)", border: "1px solid var(--border)", fontSize: "0.84rem", color: "var(--text-sec)" }}>
                Match Score: {item.match_score ?? 0}
              </div>
            </div>

            <h3 style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.45, color: "var(--text-main)", fontWeight: 600 }}>
              {item.summary}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--text-sec)", fontSize: "0.92rem" }}>
                <Wrench size={15} />
                <span><strong style={{ color: "var(--text-main)" }}>Component:</strong> {item.component || "N/A"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--text-sec)", fontSize: "0.92rem" }}>
                <Clock3 size={15} />
                <span><strong style={{ color: "var(--text-main)" }}>Resolved in:</strong> {item.resolved_in_days ?? "N/A"} days</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "0.35rem" }}>
                Resolution Type
              </div>
              <div style={{ fontSize: "0.95rem", lineHeight: 1.5, color: "var(--text-main)" }}>
                {item.resolution || "N/A"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "0.35rem" }}>
                Resolution Details
              </div>
              <div style={{ fontSize: "0.95rem", lineHeight: 1.5, color: "var(--text-main)", wordBreak: "break-word" }}>
                {item.resolution_text || "No resolution details available."}
              </div>
            </div>

            <a
              href={item.bug_url}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-block", marginTop: "0.25rem", textDecoration: "none", fontWeight: 600, color: "var(--accent)", fontSize: "0.92rem" }}
            >
              Open in Bugzilla →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
