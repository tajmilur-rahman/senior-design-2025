import { useState, useEffect } from "react";
import axios from "axios";
import {
  ShieldCheck, Brain, Upload, ArrowRight, ArrowLeft, X,
  Building2, User, Plus, ChevronDown, CheckCircle, Loader
} from "lucide-react";

// ─── Demo prediction data (Step: Predictor) ───────────────────────────────────
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

// ─── Step 0: Company Setup ────────────────────────────────────────────────────
// This is the ONLY step that collects real data.
// All other steps are a product tour.
function SetupStep({ user, onSetupComplete }) {
  const [mode, setMode]               = useState("create"); // 'create' | 'join'
  const [companyName, setCompanyName] = useState("");
  const [displayName, setDisplayName] = useState(user?.username || "");
  const [companies, setCompanies]     = useState([]);
  const [selectedCo, setSelectedCo]   = useState(null);
  const [dropOpen, setDropOpen]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [loadingCos, setLoadingCos]   = useState(false);
  const [error, setError]             = useState("");

  // Fetch existing companies for the "join" mode dropdown
  useEffect(() => {
    if (mode !== "join") return;
    setLoadingCos(true);
    axios.get("/api/companies/list")
      .then(r => setCompanies(r.data || []))
      .catch(() => setCompanies([]))
      .finally(() => setLoadingCos(false));
  }, [mode]);

  const handleSubmit = async () => {
    setError("");
    if (!displayName.trim()) { setError("Please enter your name."); return; }
    if (mode === "create" && !companyName.trim()) { setError("Please enter a company name."); return; }
    if (mode === "join"   && !selectedCo)         { setError("Please select a company."); return; }

    setLoading(true);
    try {
      const coName = mode === "create" ? companyName.trim() : selectedCo.name;
      await onSetupComplete(coName, displayName.trim());
    } catch (e) {
      setError(e?.response?.data?.detail || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-step-content">
      <p className="onboarding-desc">
        Before we get started, let's link your account to a company.
        You can <strong>create a new organisation</strong> or <strong>join an existing one</strong>.
      </p>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
        {[
          { id: "create", label: "Create new company", icon: <Plus size={14} /> },
          { id: "join",   label: "Join existing",      icon: <Building2 size={14} /> },
        ].map(opt => (
          <button key={opt.id} onClick={() => { setMode(opt.id); setSelectedCo(null); setError(""); }}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "10px 14px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: `1.5px solid ${mode === opt.id ? "var(--accent)" : "var(--border)"}`,
              background: mode === opt.id ? "var(--pill-bg)" : "var(--hover-bg)",
              color: mode === opt.id ? "var(--accent)" : "var(--text-sec)",
              transition: "all 0.15s",
            }}>
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      {/* Company name (create mode) */}
      {mode === "create" && (
        <div className="fade-in">
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 7 }}>
            Company name
          </label>
          <div style={{ position: "relative" }}>
            <Building2 size={16} color="var(--text-sec)" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              className="sys-input"
              placeholder="e.g. Acme Engineering"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              style={{ paddingLeft: 38, height: 44, fontSize: 13, width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <p style={{ fontSize: 11, color: "var(--text-sec)", margin: "6px 0 0" }}>
            This creates a new row in the <code style={{ background: "var(--hover-bg)", padding: "1px 5px", borderRadius: 3 }}>companies</code> table and assigns you as admin.
          </p>
        </div>
      )}

      {/* Company picker (join mode) */}
      {mode === "join" && (
        <div className="fade-in">
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 7 }}>
            Select your company
          </label>
          <div style={{ position: "relative" }}>
            <button onClick={() => setDropOpen(o => !o)} style={{
              width: "100%", height: 44, display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0 14px", background: "var(--input-bg)", border: `1px solid ${dropOpen ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8, cursor: "pointer", fontSize: 13, color: selectedCo ? "var(--text-main)" : "var(--text-sec)",
              fontFamily: "var(--font-head)", boxSizing: "border-box",
              boxShadow: dropOpen ? "0 0 0 3px rgba(37,99,235,0.1)" : "none",
            }}>
              <span>{selectedCo ? selectedCo.name : (loadingCos ? "Loading companies…" : "Choose a company…")}</span>
              {loadingCos ? <Loader size={14} className="spin" /> : <ChevronDown size={14} style={{ transition: "0.2s", transform: dropOpen ? "rotate(180deg)" : "none" }} />}
            </button>
            {dropOpen && !loadingCos && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100,
                background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10,
                boxShadow: "0 16px 40px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: 220, overflowY: "auto",
              }}>
                {companies.length === 0 ? (
                  <div style={{ padding: "16px", fontSize: 13, color: "var(--text-sec)", textAlign: "center" }}>
                    No companies found. Try creating one instead.
                  </div>
                ) : companies.map(co => (
                  <div key={co.id} onClick={() => { setSelectedCo(co); setDropOpen(false); }}
                    style={{
                      padding: "11px 16px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                      background: selectedCo?.id === co.id ? "var(--pill-bg)" : "transparent",
                      color: selectedCo?.id === co.id ? "var(--accent)" : "var(--text-main)",
                      borderBottom: "1px solid var(--border)",
                    }}
                    onMouseEnter={e => { if (selectedCo?.id !== co.id) e.currentTarget.style.background = "var(--hover-bg)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = selectedCo?.id === co.id ? "var(--pill-bg)" : "transparent"; }}>
                    <Building2 size={13} color="var(--text-sec)" />
                    <span style={{ fontWeight: 600 }}>{co.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-sec)", marginLeft: "auto" }}>ID #{co.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-sec)", margin: "6px 0 0" }}>
            Joining an existing company sets your role to <strong>user</strong>. Ask your company admin if you need admin access.
          </p>
        </div>
      )}

      {/* Display name */}
      <div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 7 }}>
          Your display name
        </label>
        <div style={{ position: "relative" }}>
          <User size={16} color="var(--text-sec)" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            className="sys-input"
            placeholder="e.g. Alex Chen"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            style={{ paddingLeft: 38, height: 44, fontSize: 13, width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <p style={{ fontSize: 11, color: "var(--text-sec)", margin: "6px 0 0" }}>
          Stored as <code style={{ background: "var(--hover-bg)", padding: "1px 5px", borderRadius: 3 }}>users.username</code> — shown in the nav bar.
        </p>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 13, color: "var(--danger)", fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: "100%", padding: "12px 0", background: "var(--accent)", border: "none",
          borderRadius: 9, color: "white", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontFamily: "var(--font-head)",
        }}>
        {loading ? <><Loader size={14} className="spin" /> Setting up…</> : <><CheckCircle size={14} /> Continue</>}
      </button>

      {/* What this does — transparency note */}
      <div style={{ padding: "12px 16px", background: "var(--hover-bg)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 12, color: "var(--text-sec)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--text-main)", display: "block", marginBottom: 4 }}>What gets saved:</strong>
        {mode === "create" ? (
          <>
            <div>• <code style={{ background: "var(--bg)", padding: "0 4px", borderRadius: 3 }}>companies</code> → new row: <strong>{companyName || "your company name"}</strong>, data_table: 'bugs'</div>
            <div>• <code style={{ background: "var(--bg)", padding: "0 4px", borderRadius: 3 }}>users</code> → your row updated: company_id linked, username set, role stays <strong>admin</strong></div>
          </>
        ) : (
          <>
            <div>• <code style={{ background: "var(--bg)", padding: "0 4px", borderRadius: 3 }}>users</code> → your row updated: company_id → {selectedCo ? `#${selectedCo.id} (${selectedCo.name})` : "selected company"}, role: <strong>user</strong></div>
            <div>• No new company created.</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Step: Welcome tour ───────────────────────────────────────────────────────
function WelcomeStep() {
  return (
    <div className="onboarding-step-content">
      <p className="onboarding-desc">
        Apex System uses a <strong>Random Forest ML model</strong> trained on 220,000+ real-world bugs
        to instantly predict the severity of any bug your team submits.
      </p>
      <div className="onboarding-feature-grid">
        {[
          { title: "AI Prediction",  desc: "Type a bug summary and get an instant S1–S4 severity score" },
          { title: "Bulk Upload",    desc: "Upload a CSV of existing bugs and let the model classify them all" },
          { title: "Your Data Only", desc: "Your company's bugs are completely isolated from other tenants" },
        ].map((f, i) => (
          <div key={i} className="onboarding-feature-card">
            <div className="onboarding-feature-title">{f.title}</div>
            <div className="onboarding-feature-desc">{f.desc}</div>
          </div>
        ))}
      </div>
      <div className="onboarding-info-box">
        <div className="onboarding-info-title">How it works in 3 steps</div>
        <div className="onboarding-info-body">
          1. Describe a bug in plain English<br />
          2. Apex System's AI predicts the severity instantly<br />
          3. Confirm or correct — the model learns from your feedback
        </div>
      </div>
    </div>
  );
}

// ─── Step: AI Predictor demo ──────────────────────────────────────────────────
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
    <div className="onboarding-step-content">
      <p className="onboarding-desc">Describe a bug in plain English. The AI will classify its severity instantly.</p>
      <div className="onboarding-chips">
        {EXAMPLES.map((ex, i) => (
          <button key={i} className="onboarding-chip" onClick={() => setText(ex)}>{ex}</button>
        ))}
      </div>
      <textarea className="onboarding-textarea" rows={3} value={text}
        onChange={e => setText(e.target.value)}
        placeholder="e.g. Application crashes when clicking the login button on iOS..." />
      <button className="onboarding-predict-btn" onClick={predict} disabled={!text.trim() || loading}>
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
          <div className="onboarding-result-grid">
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

// ─── Step: Bulk Upload info ───────────────────────────────────────────────────
function UploadStep() {
  return (
    <div className="onboarding-step-content">
      <p className="onboarding-desc">
        Already tracking bugs elsewhere? Upload a <strong>CSV or JSON</strong> file to import them all at once.
      </p>
      <div className="onboarding-csv-grid">
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
        After upload, the AI automatically classifies each bug — the model gets smarter with every batch you add.
      </div>
    </div>
  );
}

// ─── Main Onboarding Component ────────────────────────────────────────────────
// onComplete(companyName, displayName) — called once setup is done
// user — the current user object from App.jsx (may have company_id=null)
export default function Onboarding({ onComplete, user }) {
  // setupDone tracks whether Step 0 (the data-collection step) is complete
  const [setupDone, setSetupDone] = useState(false);
  const [step, setStep]           = useState(0); // tour steps: 0=welcome, 1=predictor, 2=upload

  // If the user already has a company (e.g. registered via Register page),
  // skip the setup step entirely and just show the product tour
  const needsSetup = !user?.company_id;

  // Tour steps shown AFTER setup (or immediately if company already linked)
  const TOUR_STEPS = [
    { id: "welcome",   icon: <ShieldCheck size={40} color="#3b82f6" />, title: "Welcome to Apex System",  subtitle: "AI-powered bug triage for your team" },
    { id: "predictor", icon: <Brain       size={40} color="#a78bfa" />, title: "Try the AI Predictor",   subtitle: "See the model in action" },
    { id: "upload",    icon: <Upload      size={40} color="#22c55e" />, title: "Bulk Upload Your Bugs",  subtitle: "Already tracking bugs elsewhere? Import them all at once" },
  ];

  const cur    = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  // Called by SetupStep when the user clicks Continue
  const handleSetupComplete = async (companyName, displayName) => {
    await onComplete(companyName, displayName);
    setSetupDone(true);
    // Don't close yet — show the product tour
  };

  // Called when the tour finishes
  const handleTourDone = () => {
    if (needsSetup && !setupDone) {
      // Shouldn't normally reach here, but safety net
      onComplete("", user?.username || "");
    } else {
      onComplete(null, null); // signal: tour done, no setup needed
    }
  };

  // ── Render setup step (Step 0) ────────────────────────────────────────────
  if (needsSetup && !setupDone) {
    return (
      <div className="onboarding-backdrop">
        <div className="onboarding-card">
          <div className="onboarding-header">
            <div className="onboarding-icon"><Building2 size={40} color="var(--accent)" /></div>
            <div className="onboarding-step-label">Setup · Step 1 of 1</div>
            <h2 className="onboarding-title">Set up your workspace</h2>
            <p className="onboarding-subtitle">Link your account to a company to get started</p>
          </div>
          <SetupStep user={user} onSetupComplete={handleSetupComplete} />
        </div>
      </div>
    );
  }

  // ── Render product tour ───────────────────────────────────────────────────
  return (
    <div className="onboarding-backdrop">
      <div className="onboarding-card">
        <button className="onboarding-skip" onClick={handleTourDone} title="Skip tour"><X size={18} /></button>

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

        {cur.id === "welcome"   && <WelcomeStep />}
        {cur.id === "predictor" && <PredictorStep />}
        {cur.id === "upload"    && <UploadStep />}

        <div className="onboarding-nav">
          <button className="onboarding-skip-text" onClick={handleTourDone}>Skip tour</button>
          <div className="onboarding-nav-right">
            {step > 0 && (
              <button className="onboarding-btn-back" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft size={16} /> Back
              </button>
            )}
            <button className="onboarding-btn-next" onClick={() => isLast ? handleTourDone() : setStep(s => s + 1)}>
              {isLast ? "Go to Dashboard" : "Next"} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}