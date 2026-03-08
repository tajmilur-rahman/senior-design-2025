import { useState } from "react";
import axios from "axios";
import { ShieldCheck, Brain, Upload, ArrowRight, ArrowLeft, X } from "lucide-react";

// ─── Step Definitions ────────────────────────────────────────────────────────
const STEPS = [
  {
    id: "welcome",
    icon: <ShieldCheck size={40} color="#3b82f6" />,
    title: "Welcome to SmartSort",
    subtitle: "AI-powered bug triage for your team",
  },
  {
    id: "predictor",
    icon: <Brain size={40} color="#a78bfa" />,
    title: "Try the AI Predictor",
    subtitle: "See the model in action — type any bug description below",
  },
  {
    id: "upload",
    icon: <Upload size={40} color="#22c55e" />,
    title: "Bulk Upload Your Bugs",
    subtitle: "Already tracking bugs elsewhere? Import them all at once",
  },
];

// Demo prediction logic — mirrors your backend heuristics
const DEMO_PREDICTIONS = {
  crash:    { sev: "S1", conf: 94, diagnosis: "Critical Memory Corruption",  team: "Core Performance"     },
  login:    { sev: "S1", conf: 91, diagnosis: "Access Control Failure",       team: "Security Ops"         },
  security: { sev: "S1", conf: 96, diagnosis: "Security Vulnerability",       team: "Security Ops"         },
  slow:     { sev: "S2", conf: 87, diagnosis: "Performance Degradation",      team: "Core Performance"     },
  database: { sev: "S2", conf: 88, diagnosis: "Database Contention",          team: "Data Infrastructure"  },
  typo:     { sev: "S4", conf: 82, diagnosis: "UI Text Error",                team: "Frontend/UX"          },
  color:    { sev: "S4", conf: 79, diagnosis: "Visual Styling Issue",         team: "Frontend/UX"          },
  button:   { sev: "S3", conf: 75, diagnosis: "UI Interaction Bug",           team: "Frontend/UX"          },
};

const SEV_COLORS  = { S1: "#ef4444", S2: "#f97316", S3: "#3b82f6", S4: "#22c55e" };
const SEV_LABELS  = { S1: "Critical", S2: "Major",   S3: "Normal",  S4: "Trivial" };

const EXAMPLES = [
  "App crashes when user clicks logout",
  "Login button does nothing on mobile",
  "Database query times out after 30 seconds",
  "Typo in the settings page label",
];

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────
function WelcomeStep() {
  return (
    <div className="onboarding-step-content">
      <p className="onboarding-desc">
        SmartSort uses a <strong>Random Forest ML model</strong> trained on 220,000+ real-world bugs
        to instantly predict the severity of any bug your team submits — so you stop guessing and start triaging faster.
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
          2. SmartSort's AI predicts the severity instantly<br />
          3. Confirm or correct — the model learns from your feedback
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: AI Predictor ─────────────────────────────────────────────────────
function PredictorStep() {
  const [text, setText]     = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const predict = () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    // Simulate ML prediction — replace with real axios call if desired
    setTimeout(() => {
      const lower = text.toLowerCase();
      let prediction = { sev: "S3", conf: 72, diagnosis: "Standard Logic Defect", team: "General Maintenance" };
      for (const [keyword, pred] of Object.entries(DEMO_PREDICTIONS)) {
        if (lower.includes(keyword)) { prediction = pred; break; }
      }
      setResult(prediction);
      setLoading(false);
    }, 900);
  };

  return (
    <div className="onboarding-step-content">
      <p className="onboarding-desc">
        Describe a bug in plain English — the same way a developer would write it in a ticket.
        The AI will instantly classify its severity.
      </p>

      {/* Quick example chips */}
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
        {loading ? "Analyzing..." : "Predict Severity"}
      </button>

      {/* Prediction result */}
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
              <div className="onboarding-result-card-label">Assigned Team</div>
              <div className="onboarding-result-card-value" style={{ color: "#3b82f6" }}>{result.team}</div>
            </div>
          </div>
          <div className="onboarding-result-hint">
            You can correct this prediction before saving — corrections help retrain the model.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Bulk Upload ──────────────────────────────────────────────────────
function UploadStep() {
  return (
    <div className="onboarding-step-content">
      <p className="onboarding-desc">
        If your team already tracks bugs in a spreadsheet or another tool,
        you can upload them all at once. SmartSort accepts <strong>CSV or JSON</strong> files.
      </p>
      <div className="onboarding-csv-grid">
        {[
          { col: "summary",   req: true,  desc: "Bug description"      },
          { col: "severity",  req: false, desc: "S1, S2, S3, or S4"    },
          { col: "component", req: false, desc: "e.g. Frontend, API"   },
          { col: "status",    req: false, desc: "e.g. open, pending"   },
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
        <pre className="onboarding-csv-code">
{`summary,severity,component
"Login crashes on Safari",S1,Frontend
"Export button missing label",S4,UI
"API timeout on large queries",S2,Backend`}
        </pre>
      </div>
      <div className="onboarding-info-box">
        After upload, SmartSort automatically retrains on your new data — the model gets smarter with every batch you add.
      </div>
    </div>
  );
}

// ─── Main Onboarding Component ────────────────────────────────────────────────
export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const cur    = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="onboarding-backdrop">
      <div className="onboarding-card">

        {/* Skip button */}
        <button className="onboarding-skip" onClick={onComplete} title="Skip onboarding">
          <X size={18} />
        </button>

        {/* Progress dots */}
        <div className="onboarding-progress">
          {STEPS.map((_, i) => (
            <div key={i} className={`onboarding-dot ${i === step ? "active" : i < step ? "done" : ""}`} />
          ))}
        </div>

        {/* Step icon + heading */}
        <div className="onboarding-header">
          <div className="onboarding-icon">{cur.icon}</div>
          <div className="onboarding-step-label">Step {step + 1} of {STEPS.length}</div>
          <h2 className="onboarding-title">{cur.title}</h2>
          <p className="onboarding-subtitle">{cur.subtitle}</p>
        </div>

        {/* Step content */}
        {cur.id === "welcome"   && <WelcomeStep />}
        {cur.id === "predictor" && <PredictorStep />}
        {cur.id === "upload"    && <UploadStep />}

        {/* Navigation */}
        <div className="onboarding-nav">
          <button className="onboarding-skip-text" onClick={onComplete}>
            Skip onboarding
          </button>
          <div className="onboarding-nav-right">
            {step > 0 && (
              <button className="onboarding-btn-back" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft size={16} /> Back
              </button>
            )}
            <button className="onboarding-btn-next" onClick={() => isLast ? onComplete() : setStep(s => s + 1)}>
              {isLast ? "Go to Dashboard" : "Next"} <ArrowRight size={16} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}