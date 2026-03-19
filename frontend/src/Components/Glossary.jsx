import { useState } from 'react';
import { BookOpen, X, ChevronDown, ChevronUp } from 'lucide-react';

// ── Severity definitions ─────────────────────────────────────────────────────
export const SEVERITY_DEFS = [
  {
    code: 'S1', label: 'Critical',
    color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)',
    desc: 'System crash, data loss, or complete feature failure with no workaround. Immediate action required.',
    action: 'Assign to on-call engineer now.',
  },
  {
    code: 'S2', label: 'High',
    color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)',
    desc: 'Major feature broken. Significant user impact with no easy workaround.',
    action: 'Fix in the current sprint.',
  },
  {
    code: 'S3', label: 'Medium',
    color: '#3b82f6', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.25)',
    desc: 'Feature works but behaves unexpectedly. A reasonable workaround exists.',
    action: 'Schedule for the next sprint.',
  },
  {
    code: 'S4', label: 'Low',
    color: '#64748b', bg: 'var(--hover-bg)', border: 'var(--border)',
    desc: 'Cosmetic issue, typo, or minor inconvenience. No functional impact.',
    action: 'Add to the backlog.',
  },
];

// ── Status definitions ────────────────────────────────────────────────────────
export const STATUS_DEFS = [
  { code: 'NEW',         color: '#3b82f6', bg: 'rgba(37,99,235,0.08)',  desc: 'Logged and waiting to be triaged.' },
  { code: 'UNCONFIRMED', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', desc: 'Reported but not yet reproduced. Needs verification.' },
  { code: 'CONFIRMED',   color: '#10b981', bg: 'rgba(16,185,129,0.08)', desc: 'Verified and ready to be worked on.' },
  { code: 'RESOLVED',    color: '#10b981', bg: 'rgba(16,185,129,0.08)', desc: 'Fix implemented. Awaiting QA sign-off.' },
  { code: 'VERIFIED',    color: '#6366f1', bg: 'rgba(99,102,241,0.08)', desc: 'Fix confirmed by QA. Bug is closed.' },
  { code: 'PROCESSED',   color: '#64748b', bg: 'var(--hover-bg)',       desc: 'Ingested via bulk import or dataset sync.' },
];

// ── Data source definitions ───────────────────────────────────────────────────
export const SOURCE_DEFS = [
  { code: 'Manual',          icon: '✏️', desc: 'Submitted by a team member directly through the Submit tab.' },
  { code: 'Bugzilla',        icon: '🔄', desc: 'Auto-synced from Mozilla Bugzilla every 24 hours.' },
  { code: 'Bulk import',     icon: '📦', desc: 'Uploaded by an admin in JSON/CSV format for batch training.' },
  { code: 'Firefox dataset', icon: '🗄️', desc: 'Pre-loaded baseline of 220,000+ historical Mozilla bugs for ML training.' },
];

// ── Inline severity legend ───────────────────────────────────────────────────
export function SeverityLegend({ style = {} }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, ...style }}>
      {SEVERITY_DEFS.map(s => (
        <div key={s.code} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 7, background: s.bg, border: `1px solid ${s.border}`, fontSize: 12 }}>
          <span style={{ fontWeight: 800, color: s.color, fontSize: 11 }}>{s.code}</span>
          <span style={{ color: 'var(--text-sec)', fontWeight: 500 }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Full glossary drawer ──────────────────────────────────────────────────────
export function GlossaryDrawer({ onClose }) {
  const [openSection, setOpenSection] = useState('severity');

  const Section = ({ id, title, children }) => {
    const isOpen = openSection === id;
    return (
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => setOpenSection(isOpen ? null : id)} style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 0', color: 'var(--text-main)', fontFamily: 'var(--font-head)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
          {isOpen ? <ChevronUp size={16} color="var(--text-sec)" /> : <ChevronDown size={16} color="var(--text-sec)" />}
        </button>
        {isOpen && <div style={{ paddingBottom: 20 }}>{children}</div>}
      </div>
    );
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(3px)', zIndex: 2000 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: 'var(--card-bg)', borderLeft: '1px solid var(--border)',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.18)', zIndex: 2001,
        display: 'flex', flexDirection: 'column',
        animation: 'fadeInRight 0.25s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 26px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <BookOpen size={17} color="var(--accent)" />
            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-main)' }}>Reference guide</span>
          </div>
          <button className="inspector-close" onClick={onClose} style={{ position: 'static', transform: 'none' }}><X size={16} /></button>
        </div>

        {/* Content */}
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '6px 26px 28px' }}>

          {/* Severity */}
          <Section id="severity" title="Severity Levels (S1 – S4)">
            <p style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 14, lineHeight: 1.7 }}>
              Severity shows how serious a bug is. The AI predicts this — engineers can correct it to improve future predictions.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SEVERITY_DEFS.map(s => (
                <div key={s.code} style={{ padding: '14px 16px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: s.color, fontFamily: 'var(--font-mono)', minWidth: 28 }}>{s.code}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>{s.label}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: '0 0 8px', lineHeight: 1.6 }}>{s.desc}</p>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>→ {s.action}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Statuses */}
          <Section id="statuses" title="Bug Statuses">
            <p style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 14, lineHeight: 1.7 }}>
              Status tracks where a bug is in the fix process — from first report to final close.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STATUS_DEFS.map(s => (
                <div key={s.code} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: s.bg, border: '1px solid var(--border)', borderRadius: 9 }}>
                  <span style={{ fontWeight: 800, fontSize: 12, color: s.color, fontFamily: 'var(--font-mono)', minWidth: 90, paddingTop: 1 }}>{s.code}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-sec)', lineHeight: 1.55 }}>{s.desc}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Sources */}
          <Section id="sources" title="Data Sources">
            <p style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 14, lineHeight: 1.7 }}>
              Each bug in the database comes from one of these four sources.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SOURCE_DEFS.map(s => (
                <div key={s.code} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 9 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', marginBottom: 3 }}>{s.code}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.55 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </div>
    </>
  );
}

// ── Trigger button ────────────────────────────────────────────────────────────
export function GlossaryTrigger({ onClick, label = 'Reference guide' }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'var(--hover-bg)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '5px 11px', cursor: 'pointer',
      fontSize: 12, fontWeight: 600, color: 'var(--text-sec)',
      fontFamily: 'var(--font-head)', transition: 'all 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-sec)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
      <BookOpen size={12} /> {label}
    </button>
  );
}

export default GlossaryDrawer;