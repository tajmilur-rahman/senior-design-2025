import { useState } from "react";
import axios from "axios";
import { supabase } from "../supabaseClient";
import {
  ArrowRight, ArrowLeft,
  Zap, Database, Brain, Download, CheckCircle, Loader, X
} from "lucide-react";
import { LiquidButton as Button } from "../liquid-glass-button";
// ArrowLeft and X are used in the seed error/retry UI

// ── First-launch choice screen ────────────────────────────────────────────────
function LaunchChoiceStep({ onChoice }) {
  const choices = [
    {
      id: "populate",
      icon: <Download size={26} color="#10b981" />,
      title: "Populate with sample data",
      desc: "Seed your company database with 5,000 real Mozilla bugs — ready to explore and train the AI instantly.",
      badge: "Recommended",
    },
    {
      id: "empty",
      icon: <Database size={26} color="#6366f1" />,
      title: "Start with empty database",
      desc: "Begin with a clean slate. Submit your team's real bugs from day one using the Bug Ingestion tab.",
      badge: null,
    },
    {
      id: "demo",
      icon: <Brain size={26} color="#6366f1" />,
      title: "Explore Firefox demo data",
      desc: "Browse 220,000+ pre-loaded Mozilla Firefox bugs to see the full dashboard and AI model in action.",
      badge: "220k+ bugs",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {choices.map(c => (
        <button
          key={c.id}
          onClick={() => onChoice(c.id)}
          style={{
            display: "flex", alignItems: "center", gap: 16,
            padding: "16px 18px", borderRadius: 14, cursor: "pointer",
            border: "1px solid var(--border)",
            background: "var(--hover-bg)",
            transition: "all 0.15s", textAlign: "left",
            fontFamily: "var(--font-head)", width: "100%",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.background = "var(--pill-bg)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.background = "var(--hover-bg)";
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "var(--hover-bg)", border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {c.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>
                {c.title}
              </span>
              {c.badge && (
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 6,
                  background: "rgba(16,185,129,0.12)", color: "#10b981",
                  border: "1px solid rgba(16,185,129,0.25)",
                  textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0,
                }}>
                  {c.badge}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-sec)", lineHeight: 1.5 }}>
              {c.desc}
            </div>
          </div>
          <ArrowRight size={15} color="var(--text-sec)" style={{ flexShrink: 0 }} />
        </button>
      ))}
    </div>
  );
}


// ── Main Onboarding component ─────────────────────────────────────────────────
// onComplete(companyName, displayName, navigateTo)
// navigateTo: optional tab ID to land on after onboarding ('submit', 'database', null)
export default function Onboarding({ onComplete }) {
  const [choice,     setChoice]     = useState(null);
  const [seeding,    setSeeding]    = useState(false);
  const [seedResult, setSeedResult] = useState(null);

  const handleChoice = async (id) => {
    if (id === "empty") {
      onComplete(null, null, "submit", false);   // go to submit tab
    } else if (id === "demo") {
      onComplete(null, null, "database", false); // go to database tab
    } else if (id === "populate") {
      setChoice("populate");
      setSeeding(true);
      setSeedResult(null);
      try {
        const session = await supabase.auth.getSession();
        const token = session?.data?.session?.access_token;
        const res = await axios.post("/api/admin/seed_company_data", null, {
          params: { sample_size: 5000 },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setSeedResult({ count: res.data.count, message: res.data.message });
      } catch (err) {
        const msg = err.response?.data?.detail || "Seeding failed. You can try again from the Database tab.";
        setSeedResult({ error: msg });
      } finally {
        setSeeding(false);
      }
    }
  };

  const backdropStyle = (align = "center") => ({
    alignItems: align,
    overflowY: align === "flex-start" ? "auto" : undefined,
  });
  const iconCircle = (rgba) => ({
    width: 60, height: 60, borderRadius: "50%", background: rgba,
    display: "flex", alignItems: "center", justifyContent: "center",
  });

  // ── Populate / seed screen ────────────────────────────────────────────────
  if (choice === "populate") {
    return (
      <div className="onboarding-backdrop" style={backdropStyle()}>
        <div className="onboarding-card" style={{ maxWidth: "520px", display: "flex", flexDirection: "column", alignItems: "center", padding: "3rem", gap: 24, textAlign: "center" }}>
          {seeding ? (
            <>
              <div style={iconCircle("rgba(16,185,129,0.1)")} className="border border-emerald-500/20">
                <Loader size={32} color="#10b981" style={{ animation: "spin 1s linear infinite" }} />
              </div>
              <h2 className="onboarding-title" style={{ margin: 0 }}>Seeding your database…</h2>
              <p className="onboarding-subtitle" style={{ margin: 0 }}>
                Loading 5,000 sample bugs from Mozilla Firefox data. This takes a few seconds.
              </p>
            </>
          ) : seedResult?.error ? (
            <>
              <div style={iconCircle("rgba(239,68,68,0.1)")} className="border border-red-500/20">
                <X size={32} color="#ef4444" />
              </div>
              <h2 className="onboarding-title" style={{ margin: 0 }}>Seeding failed</h2>
              <p style={{ color: "var(--text-sec)", fontSize: 13, margin: 0 }}>{seedResult.error}</p>
              <div style={{ display: "flex", gap: 10 }}>
                <Button variant="outline" onClick={() => { setChoice(null); setSeedResult(null); }}>
                  <ArrowLeft size={15} /> Try again
                </Button>
                <Button onClick={() => onComplete(null, null, "database", false)}>
                  Go to Dashboard <ArrowRight size={15} />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div style={iconCircle("rgba(16,185,129,0.1)")} className="border border-emerald-500/20">
                <CheckCircle size={32} color="#10b981" />
              </div>
              <h2 className="onboarding-title" style={{ margin: 0 }}>Database ready!</h2>
              <p className="onboarding-subtitle" style={{ margin: 0 }}>
                {seedResult?.count ? `${seedResult.count.toLocaleString()} sample bugs` : "Sample bugs"} have been loaded into your company's database.
              </p>
              <Button onClick={() => onComplete(null, null, "database", false)}>
                Explore my database <ArrowRight size={15} />
              </Button>
            </>
          )}
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Choice screen ────────────────────────────────────────────────────────
  if (!choice) {
    return (
      <div className="onboarding-backdrop" style={backdropStyle("flex-start")}>
        <div className="onboarding-card" style={{ maxWidth: "900px", minHeight: "70vh", display: "flex", flexDirection: "column", padding: "3rem" }}>
          <div className="onboarding-header">
            <div className="onboarding-icon"><Zap size={40} color="var(--accent)" /></div>
            <div className="onboarding-step-label">One-time setup</div>
            <h2 className="onboarding-title">Set up your database</h2>
            <p className="onboarding-subtitle">Choose how to initialize your company's bug database. This step is required before your team can start using the platform.</p>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <LaunchChoiceStep onChoice={handleChoice} />
          </div>
        </div>
      </div>
    );
  }

  // Fallback — should not be reached
  return null;
}