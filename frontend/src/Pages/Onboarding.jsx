import { useState } from "react";
import axios from "axios";
import { supabase } from "../supabaseClient";
import {
  ShieldCheck, Brain, Upload, ArrowRight, ArrowLeft, X,
  Zap, Database, PenTool, Download, CheckCircle, Loader
} from "lucide-react";

const DEMO_PREDICTIONS = {
  crash:    { sev: "S1", conf: 94, diagnosis: "Critical Memory Corruption",  team: "Core Performance"    },
  login:    { sev: "S1", conf: 91, diagnosis: "Access Control Failure",       team: "Security Ops"        },
  security: { sev: "S1", conf: 96, diagnosis: "Security Vulnerability",       team: "Security Ops"        },
  slow:     { sev: "S2", conf: 87, diagnosis: "Performance Degradation",      team: "Core Performance"    },
  database: { sev: "S2", conf: 88, diagnosis: "Database Contention",          team: "Data Infrastructure" },
  typo:     { sev: "S4", conf: 82, diagnosis: "UI Text Error",                team: "Frontend/UX"         },
  color:    { sev: "S4", conf: 79, diagnosis: "Visual Styling Issue",         team: "Frontend/UX"         },
  button:   { sev: "S3", conf: 75, diagnosis: "UI Interaction Bug",           team: "Frontend/UX"         },
};
const SEV_COLORS = { S1: "#ef4444", S2: "#f97316", S3: "#3b82f6", S4: "#22c55e" };
const SEV_LABELS = { S1: "Critical", S2: "Major",   S3: "Normal",  S4: "Trivial" };
const EXAMPLES   = [
  "App crashes when user clicks logout",
  "Login button does nothing on mobile",
  "Database query times out after 30 seconds",
  "Typo in the settings page label",
];

// ── First-launch choice screen ────────────────────────────────────────────────
function LaunchChoiceStep({ onChoice, isAdmin }) {
  const choices = [
    {
      id: "populate",
      icon: <Download size={26} color="#10b981" />,
      title: "Populate with sample data",
      desc: "Seed your company database with 5,000 real Mozilla bugs — ready to explore instantly.",
      cta: "Seed my database",
      badge: "Recommended",
      adminOnly: true,
    },
    {
      id: "submit",
      icon: <PenTool size={26} color="var(--accent)" />,
      title: "Submit your first bug",
      desc: "Jump straight in and start logging real bugs from the Severity Analysis tab.",
      cta: "Start fresh",
      badge: null,
      adminOnly: false,
    },
    {
      id: "demo",
      icon: <Database size={26} color="#3b82f6" />,
      title: "Explore Firefox demo data",
      desc: "Browse 220,000+ pre-loaded Mozilla Firefox bugs to see the full dashboard in action.",
      cta: "Show me around",
      badge: "220k+ bugs",
      adminOnly: false,
    },
    {
      id: "tour",
      icon: <Brain size={26} color="#a78bfa" />,
      title: "Take a quick tour",
      desc: "See how the AI severity predictor works with a short interactive walkthrough.",
      cta: "Take the tour",
      badge: null,
      adminOnly: false,
    },
  ].filter(c => !c.adminOnly || isAdmin);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {choices.map(c => (
        <button
          key={c.id}
          onClick={() => onChoice(c.id)}
          style={{
            display: "flex", alignItems: "center", gap: 16,
            padding: "16px 18px", borderRadius: 12, cursor: "pointer",
            border: "1.5px solid var(--border)",
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
            width: 48, height: 48, borderRadius: 10,
            background: "var(--card-bg)", border: "1px solid var(--border)",
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
                  fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 4,
                  background: "rgba(16,185,129,0.1)", color: "#10b981",
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

// ── Tour: predictor demo ──────────────────────────────────────────────────────
function PredictorStep() {
  const [text, setText]       = useState("");
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);

  const predict = () => {
    if (!text.trim()) return;
    setLoading(true); setResult(null);
    setTimeout(() => {
      const lower = text.toLowerCase();
      let prediction = { sev: "S3", conf: 72, diagnosis: "Standard Logic Defect", team: "General Maintenance" };
      for (const [kw, pred] of Object.entries(DEMO_PREDICTIONS)) {
        if (lower.includes(kw)) { prediction = pred; break; }
      }
      setResult(prediction); setLoading(false);
    }, 900);
  };

  return (
    <div className="onboarding-step-content" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "2rem", padding: "1rem 0" }}>
      <p className="onboarding-desc">
        Describe a bug in plain English. The AI will classify its severity instantly.
      </p>
      <div className="onboarding-chips">
        {EXAMPLES.map((ex, i) => (
          <button key={i} className="onboarding-chip" onClick={() => setText(ex)}>{ex}</button>
        ))}
      </div>
      <textarea
        className="onboarding-textarea"
        rows={3}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="e.g. Application crashes when clicking the login button on iOS..."
      />
      <button
        className="onboarding-predict-btn"
        onClick={predict}
        disabled={!text.trim() || loading}
      >
        {loading ? "Analyzing…" : "Predict Severity"}
      </button>
      {result && (
        <div className="onboarding-result" style={{ borderColor: SEV_COLORS[result.sev] + "44" }}>
          <div className="onboarding-result-header">
            <div className="onboarding-result-left">
              <span className="onboarding-sev-badge" style={{ background: SEV_COLORS[result.sev] + "22", color: SEV_COLORS[result.sev], border: `1px solid ${SEV_COLORS[result.sev]}55` }}>
                {result.sev}
              </span>
              <span className="onboarding-result-label">{SEV_LABELS[result.sev]}</span>
            </div>
            <span className="onboarding-conf">{result.conf}% confidence</span>
          </div>
          <div className="onboarding-result-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1rem" }}>
            <div className="onboarding-result-card">
              <div className="onboarding-result-card-label">Diagnosis</div>
              <div className="onboarding-result-card-value">{result.diagnosis}</div>
            </div>
            <div className="onboarding-result-card">
              <div className="onboarding-result-card-label">Team</div>
              <div className="onboarding-result-card-value" style={{ color: "#3b82f6" }}>{result.team}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="onboarding-step-content" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "2rem", padding: "1rem 0" }}>
      <p className="onboarding-desc">
        Apex SystemOS uses a <strong>Random Forest ML model</strong> trained on 220,000+ real-world
        bugs to instantly predict severity for every bug your team submits.
      </p>
      <div className="onboarding-feature-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "2rem" }}>
        {[
          { title: "AI Prediction",  desc: "Type a bug summary and get an instant S1–S4 severity score" },
          { title: "Bulk Upload",    desc: "Upload a CSV of existing bugs and let the model classify them all" },
          { title: "Your Data Only", desc: "Your company's bugs are fully isolated from other tenants" },
        ].map((f, i) => (
          <div key={i} className="onboarding-feature-card">
            <div className="onboarding-feature-title">{f.title}</div>
            <div className="onboarding-feature-desc">{f.desc}</div>
          </div>
        ))}
      </div>
      <div className="onboarding-info-box">
        <div className="onboarding-info-title">How it works</div>
        <div className="onboarding-info-body">
          1. Describe a bug in plain English<br />
          2. The AI predicts severity instantly<br />
          3. Confirm or correct — the model learns from your feedback
        </div>
      </div>
    </div>
  );
}

function UploadStep() {
  return (
    <div className="onboarding-step-content" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "2rem", padding: "1rem 0" }}>
      <p className="onboarding-desc">
        Already tracking bugs elsewhere? Upload a <strong>CSV or JSON</strong> file to import them all at once.
      </p>
      <div className="onboarding-csv-grid" style={{ display: "grid", gap: "1rem" }}>
        {[
          { col: "summary",   req: true,  desc: "Bug description"    },
          { col: "severity",  req: false, desc: "S1, S2, S3, or S4"  },
          { col: "component", req: false, desc: "e.g. Frontend, API" },
          { col: "status",    req: false, desc: "e.g. open, pending" },
        ].map((c, i) => (
          <div key={i} className="onboarding-csv-row">
            <div>
              <code className="onboarding-csv-col">{c.col}</code>
              <div className="onboarding-csv-desc">{c.desc}</div>
            </div>
            <span className={`onboarding-csv-badge ${c.req ? "required" : "optional"}`}>
              {c.req ? "Required" : "Optional"}
            </span>
          </div>
        ))}
      </div>
      <div className="onboarding-csv-example">
        <div className="onboarding-csv-example-label">Example CSV</div>
        <pre className="onboarding-csv-code">{`summary,severity,component\n"Login crashes on Safari",S1,Frontend\n"Export button missing label",S4,UI\n"API timeout on large queries",S2,Backend`}</pre>
      </div>
      <div className="onboarding-info-box">
        After upload, the AI automatically classifies each bug — the model improves with every batch.
      </div>
    </div>
  );
}

const TOUR_STEPS = [
  { id: "welcome",   icon: <ShieldCheck size={40} color="#3b82f6" />, title: "Welcome to Apex SystemOS", subtitle: "AI-powered bug triage for your team",              Component: WelcomeStep   },
  { id: "predictor", icon: <Brain       size={40} color="#a78bfa" />, title: "Try the AI Predictor",     subtitle: "See the model in action",                         Component: PredictorStep },
  { id: "upload",    icon: <Upload      size={40} color="#22c55e" />, title: "Bulk Upload Your Bugs",    subtitle: "Already tracking bugs elsewhere? Import them all", Component: UploadStep    },
];

// ── Main Onboarding component ─────────────────────────────────────────────────
// onComplete(companyName, displayName, navigateTo)
// navigateTo: optional tab ID to land on after onboarding ('submit', 'database', null)
export default function Onboarding({ onComplete, user }) {
  const [choice,       setChoice]       = useState(null);
  const [step,         setStep]         = useState(0);
  const [seeding,      setSeeding]      = useState(false);   // loading state for populate
  const [seedResult,   setSeedResult]   = useState(null);    // { count, error }

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const handleChoice = async (id) => {
    if (id === "submit") {
      onComplete(null, null, "submit", false);   // verified — completed
    } else if (id === "demo") {
      onComplete(null, null, "database", false); // verified — completed
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
    } else {
      // Show the product tour carousel
      setChoice("tour");
      setStep(0);
    }
  };

  const handleTourDone    = () => onComplete(null, null, null, false); // tour completed = verified
  const handleSkip        = () => onComplete(null, null, null, true);  // skipped = incomplete

  const cur    = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  // ── Populate / seed screen ────────────────────────────────────────────────
  if (choice === "populate") {
    return (
      <div className="onboarding-backdrop" style={{ minHeight: "100dvh", height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", boxSizing: "border-box", background: "var(--bg-primary)" }}>
        <div className="onboarding-card" style={{ width: "100%", maxWidth: "520px", background: "var(--card-bg)", borderRadius: "24px", display: "flex", flexDirection: "column", alignItems: "center", padding: "3rem", boxShadow: "var(--glow)", gap: 24, textAlign: "center" }}>
          {seeding ? (
            <>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Loader size={32} color="#10b981" style={{ animation: "spin 1s linear infinite" }} />
              </div>
              <h2 className="onboarding-title" style={{ margin: 0 }}>Seeding your database…</h2>
              <p className="onboarding-subtitle" style={{ margin: 0 }}>
                Loading 5,000 sample bugs from Mozilla Firefox data. This takes a few seconds.
              </p>
            </>
          ) : seedResult?.error ? (
            <>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={32} color="#ef4444" />
              </div>
              <h2 className="onboarding-title" style={{ margin: 0 }}>Seeding failed</h2>
              <p style={{ color: "var(--text-sec)", fontSize: 13, margin: 0 }}>{seedResult.error}</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="onboarding-btn-back" onClick={() => { setChoice(null); setSeedResult(null); }}>
                  <ArrowLeft size={15} /> Try again
                </button>
                <button className="onboarding-btn-next" onClick={() => onComplete(null, null, "database", false)}>
                  Go to Dashboard <ArrowRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle size={32} color="#10b981" />
              </div>
              <h2 className="onboarding-title" style={{ margin: 0 }}>Database ready!</h2>
              <p className="onboarding-subtitle" style={{ margin: 0 }}>
                {seedResult?.count ? `${seedResult.count.toLocaleString()} sample bugs` : "Sample bugs"} have been loaded into your company's database.
              </p>
              <button className="onboarding-btn-next" onClick={() => onComplete(null, null, "database", false)}>
                Explore my database <ArrowRight size={15} />
              </button>
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
      <div className="onboarding-backdrop" style={{ minHeight: "100dvh", height: "100dvh", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "2rem", boxSizing: "border-box", overflowY: "auto", background: "var(--bg-primary)" }}>
        <div className="onboarding-card" style={{ width: "100%", maxWidth: "900px", minHeight: "70vh", maxHeight: "calc(100dvh - 4rem)", minWidth: 0, overflow: "hidden", background: "var(--card-bg)", borderRadius: "24px", display: "flex", flexDirection: "column", padding: "3rem", boxShadow: "var(--glow)" }}>
          <div className="onboarding-header">
            <div className="onboarding-icon">
              <Zap size={40} color="var(--accent)" />
            </div>
            <div className="onboarding-step-label">You're all set</div>
            <h2 className="onboarding-title">How would you like to start?</h2>
            <p className="onboarding-subtitle">You can change this any time from the dashboard.</p>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <LaunchChoiceStep onChoice={handleChoice} isAdmin={isAdmin} />
          </div>
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <button
              className="onboarding-skip-text"
              onClick={handleSkip}
              style={{ fontSize: 12 }}
            >
              Skip and go to dashboard →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Product tour ──────────────────────────────────────────────────────────
  return (
    <div className="onboarding-backdrop" style={{ minHeight: "100dvh", height: "100dvh", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "2rem", boxSizing: "border-box", overflowY: "auto", background: "var(--bg-primary)" }}>
      <div className="onboarding-card" style={{ width: "100%", maxWidth: "900px", minHeight: "70vh", maxHeight: "calc(100dvh - 4rem)", minWidth: 0, overflow: "hidden", background: "var(--card-bg)", borderRadius: "24px", display: "flex", flexDirection: "column", padding: "3rem", boxShadow: "var(--glow)" }}>
        <button className="onboarding-skip" onClick={handleSkip} title="Skip tour">
          <X size={18} />
        </button>
        <div className="onboarding-progress">
          {TOUR_STEPS.map((_, i) => (
            <div key={i} className={`onboarding-dot ${i === step ? "active" : i < step ? "done" : ""}`} />
          ))}
        </div>
        <div className="onboarding-header">
          <div className="onboarding-icon">{cur.icon}</div>
          <div className="onboarding-step-label">Step {step + 1} of {TOUR_STEPS.length}</div>
          <h2 className="onboarding-title">{cur.title}</h2>
          <p className="onboarding-subtitle">{cur.subtitle}</p>
        </div>
        <cur.Component />
        <div className="onboarding-nav">
          <button className="onboarding-skip-text" onClick={handleSkip}>Skip tour</button>
          <div className="onboarding-nav-right">
            {step > 0 && (
              <button className="onboarding-btn-back" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft size={16} /> Back
              </button>
            )}
            <button
              className="onboarding-btn-next"
              onClick={() => isLast ? handleTourDone() : setStep(s => s + 1)}
            >
              {isLast ? "Go to Dashboard" : "Next"} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}