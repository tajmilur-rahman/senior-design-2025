import { useState } from 'react';
import { BookOpen, X, ChevronDown, ChevronUp, Info } from 'lucide-react';

// ── Severity definitions ─────────────────────────────────────────────────────
export const SEVERITY_DEFS = [
  {
    code: 'S1',
    label: 'Critical',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    desc: 'System crash, data loss, security breach, or complete feature failure with no workaround. Requires immediate escalation.',
    action: 'Assign to on-call engineer now.',
  },
  {
    code: 'S2',
    label: 'High',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    desc: 'Major functionality broken with a difficult workaround. Significantly impacts users but does not crash the system.',
    action: 'Prioritise for the current sprint.',
  },
  {
    code: 'S3',
    label: 'Medium',
    color: '#3b82f6',
    bg: 'rgba(37,99,235,0.08)',
    border: 'rgba(37,99,235,0.25)',
    desc: 'Feature partially broken or behaves unexpectedly. A reasonable workaround exists.',
    action: 'Schedule for the next sprint.',
  },
  {
    code: 'S4',
    label: 'Low',
    color: '#64748b',
    bg: 'var(--hover-bg)',
    border: 'var(--border)',
    desc: 'Cosmetic issue, typo, or minor inconvenience. No functional impact.',
    action: 'Add to backlog.',
  },
];

// ── Status definitions ────────────────────────────────────────────────────────
export const STATUS_DEFS = [
  {
    code: 'NEW',
    color: '#3b82f6',
    bg: 'rgba(37,99,235,0.08)',
    desc: 'Bug has been logged and is awaiting triage. Not yet reviewed by a team member.',
  },
  {
    code: 'UNCONFIRMED',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    desc: 'Bug has been reported but cannot yet be reproduced or verified. Needs confirmation before work begins.',
  },
  {
    code: 'CONFIRMED',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    desc: 'Bug has been reproduced and verified. Ready to be assigned and worked on.',
  },
  {
    code: 'RESOLVED',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    desc: 'A fix has been implemented. Awaiting verification by QA or the reporter.',
  },
  {
    code: 'VERIFIED',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.08)',
    desc: 'Fix confirmed by QA. Bug is closed and will not reappear in active queues.',
  },
  {
    code: 'PROCESSED',
    color: '#64748b',
    bg: 'var(--hover-bg)',
    desc: 'Bug was ingested via bulk import or Bugzilla sync. May not have gone through standard triage.',
  },
];

// ── Data source definitions ───────────────────────────────────────────────────
export const SOURCE_DEFS = [
  {
    code: 'Manual',
    icon: '✏️',
    desc: 'Submitted directly by a team member through the "Submit a Bug" tab.',
  },
  {
    code: 'Bugzilla',
    icon: '🔄',
    desc: 'Automatically synced from Mozilla Bugzilla via the background sync job. Runs every 24 hours and pulls recent changes.',
  },
  {
    code: 'Bulk import',
    icon: '📦',
    desc: 'Uploaded by an admin via the bulk training upload feature (JSON format). Used for seeding training data.',
  },
  {
    code: 'Firefox dataset',
    icon: '🗄️',
    desc: 'Pre-loaded historical dataset of 220,000+ Mozilla Firefox bugs used as the base training corpus for the ML model.',
  },
];

// ── Inline severity legend (compact, for embedding inside other components) ──
export function SeverityLegend({ style = {} }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, ...style
    }}>
      {SEVERITY_DEFS.map(s => (
        <div key={s.code} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 10px', borderRadius: 7,
          background: s.bg, border: `1px solid ${s.border}`,
          fontSize: 12,
        }}>
          <span style={{ fontWeight: 800, color: s.color, fontSize: 11 }}>{s.code}</span>
          <span style={{ color: 'var(--text-sec)', fontWeight: 500 }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Full glossary panel (slide-in drawer) ─────────────────────────────────────
export function GlossaryDrawer({ onClose }) {
  const [openSection, setOpenSection] = useState('severity');

  const Section = ({ id, title, children }) => {
    const isOpen = openSection === id;
    return (
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
        <button
          onClick={() => setOpenSection(isOpen ? null : id)}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 0', color: 'var(--text-main)', fontFamily: 'var(--font-head)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
          {isOpen ? <ChevronUp size={15} color="var(--text-sec)" /> : <ChevronDown size={15} color="var(--text-sec)" />}
        </button>
        {isOpen && <div style={{ paddingBottom: 16 }}>{children}</div>}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
          backdropFilter: 'blur(3px)', zIndex: 2000
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
        background: 'var(--card-bg)', borderLeft: '1px solid var(--border)',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.15)', zIndex: 2001,
        display: 'flex', flexDirection: 'column',
        animation: 'fadeInRight 0.25s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} color="var(--accent)" />
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-main)' }}>Reference guide</span>
          </div>
          <button className="inspector-close" onClick={onClose} style={{ position: 'static', transform: 'none' }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '4px 24px 24px' }}>

          <Section id="severity" title="Severity levels (S1 – S4)">
            <p style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 12, lineHeight: 1.6 }}>
              Severity describes how badly a bug impacts the product. The ML model predicts this automatically —
              engineers can correct it to improve future predictions.
            </p>
            {SEVERITY_DEFS.map(s => (
              <div key={s.code} style={{
                marginBottom: 10, padding: 12, borderRadius: 8,
                background: s.bg, border: `1px solid ${s.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontWeight: 800, color: s.color, fontSize: 12 }}>{s.code}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 12 }}>{s.label}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-sec)', margin: '0 0 4px', lineHeight: 1.6 }}>{s.desc}</p>
                <p style={{ fontSize: 11, color: s.color, margin: 0, fontWeight: 600 }}>→ {s.action}</p>
              </div>
            ))}
          </Section>

          <Section id="status" title="Status values">
            <p style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 12, lineHeight: 1.6 }}>
              Status tracks where a bug is in the resolution workflow.
              NEW and UNCONFIRMED are both "open" states — the key difference is whether
              someone has verified the bug can be reproduced.
            </p>
            {STATUS_DEFS.map(s => (
              <div key={s.code} style={{
                marginBottom: 8, padding: '10px 12px', borderRadius: 8,
                background: s.bg, border: '1px solid var(--border)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 10,
                  color: s.color, flexShrink: 0, paddingTop: 1,
                  background: `${s.color}18`, padding: '2px 6px', borderRadius: 4,
                }}>{s.code}</span>
                <p style={{ fontSize: 12, color: 'var(--text-sec)', margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
            {/* Status flow */}
            <div style={{
              marginTop: 12, padding: 12, borderRadius: 8,
              background: 'var(--hover-bg)', border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Typical workflow
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                {['NEW', '→', 'UNCONFIRMED', '→', 'CONFIRMED', '→', 'RESOLVED', '→', 'VERIFIED'].map((step, i) => (
                  <span key={i} style={{
                    fontSize: 11, fontWeight: step === '→' ? 400 : 700,
                    color: step === '→' ? 'var(--text-sec)' : 'var(--text-main)',
                    fontFamily: step !== '→' ? 'var(--font-mono)' : 'inherit',
                  }}>{step}</span>
                ))}
              </div>
            </div>
          </Section>

          <Section id="sources" title="Data sources">
            <p style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 12, lineHeight: 1.6 }}>
              Bugs in this system come from multiple sources. Each source is labelled
              so you can understand how the data entered the system.
            </p>
            {SOURCE_DEFS.map(s => (
              <div key={s.code} style={{
                marginBottom: 8, padding: '10px 12px', borderRadius: 8,
                background: 'var(--bg)', border: '1px solid var(--border)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', margin: '0 0 3px' }}>{s.code}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-sec)', margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </Section>

          <Section id="roles" title="User roles">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {
                  role: 'Admin',
                  color: '#6366f1',
                  bg: 'rgba(99,102,241,0.08)',
                  perms: ['Access all tabs including Performance', 'Trigger manual model retraining', 'Manage and delete any bug or batch', 'View confusion matrix and model diagnostics', 'Select bugs for training inclusion'],
                },
                {
                  role: 'User',
                  color: 'var(--accent)',
                  bg: 'var(--pill-bg)',
                  perms: ['Submit and view bugs', 'Run AI severity analysis', 'Browse the component directory', 'Search and export the database', 'Submit prediction corrections'],
                },
              ].map(r => (
                <div key={r.role} style={{ padding: 12, borderRadius: 8, background: r.bg, border: '1px solid var(--border)' }}>
                  <p style={{ fontWeight: 800, fontSize: 12, color: r.color, margin: '0 0 8px' }}>{r.role}</p>
                  <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
                    {r.perms.map((p, i) => (
                      <li key={i} style={{ fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.7 }}>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </div>
    </>
  );
}

// ── Small inline info trigger button ─────────────────────────────────────────
export function GlossaryTrigger({ onClick, label = 'Reference guide' }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: 'var(--hover-bg)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
        fontSize: 11.5, fontWeight: 600, color: 'var(--text-sec)',
        fontFamily: 'var(--font-head)', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-sec)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <BookOpen size={12} /> {label}
    </button>
  );
}

export default GlossaryDrawer;
