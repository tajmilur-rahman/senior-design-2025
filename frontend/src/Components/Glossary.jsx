import { useState } from 'react';
import { createPortal } from 'react-dom';
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
      <div className="border-b border-white/10">
        <button onClick={() => setOpenSection(isOpen ? null : id)} className="w-full flex justify-between items-center py-5 text-white hover:text-white/80 transition-colors">
          <span className="text-sm font-bold tracking-wide">{title}</span>
          {isOpen ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
        </button>
        {isOpen && <div className="pb-6 animate-in fade-in duration-300">{children}</div>}
      </div>
    );
  };

  return createPortal(
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] animate-in fade-in duration-300" />
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[460px] bg-black/80 backdrop-blur-2xl border-l border-white/10 shadow-[-10px_0_50px_rgba(0,0,0,0.5)] z-[9999] flex flex-col animate-in slide-in-from-right duration-300 font-sans">
        
        {/* Header */}
        <div className="p-6 lg:p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <BookOpen size={18} />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">Reference Guide</span>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white/50 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">

          {/* Severity */}
          <Section id="severity" title="Severity Levels (S1 – S4)">
            <p className="text-xs text-white/50 mb-6 leading-relaxed">
              Severity shows how serious a bug is. The AI predicts this — engineers can correct it to improve future predictions.
            </p>
            <div className="flex flex-col gap-3">
              {SEVERITY_DEFS.map(s => {
                const activeColors = {
                  S1: 'border-red-500/20 bg-red-500/5 text-red-500',
                  S2: 'border-amber-500/20 bg-amber-500/5 text-amber-500',
                  S3: 'border-blue-500/20 bg-blue-500/5 text-blue-500',
                  S4: 'border-white/10 bg-white/5 text-white/40'
                }[s.code];
                return (
                  <div key={s.code} className={`p-4 rounded-2xl border ${activeColors}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-lg font-mono">{s.code}</span>
                      <span className="font-bold text-white text-sm">{s.label}</span>
                    </div>
                    <p className="text-xs text-white/60 mb-4 leading-relaxed">{s.desc}</p>
                    <div className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" /> {s.action}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Statuses */}
          <Section id="statuses" title="Bug Statuses">
            <p className="text-xs text-white/50 mb-6 leading-relaxed">
              Status tracks where a bug is in the fix process — from first report to final close.
            </p>
            <div className="flex flex-col gap-3">
              {STATUS_DEFS.map(s => {
                const activeColors = {
                  'NEW': 'text-blue-400', 'UNCONFIRMED': 'text-amber-500',
                  'CONFIRMED': 'text-emerald-400', 'RESOLVED': 'text-emerald-400',
                  'VERIFIED': 'text-indigo-400', 'PROCESSED': 'text-white/40'
                }[s.code] || 'text-white/40';
                return (
                  <div key={s.code} className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <span className={`font-bold text-xs font-mono w-24 pt-0.5 ${activeColors}`}>{s.code}</span>
                    <span className="text-xs text-white/60 leading-relaxed flex-1">{s.desc}</span>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Sources */}
          <Section id="sources" title="Data Sources">
            <p className="text-xs text-white/50 mb-6 leading-relaxed">
              Each bug in the database comes from one of these four sources.
            </p>
            <div className="flex flex-col gap-3">
              {SOURCE_DEFS.map(s => (
                <div key={s.code} className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <span className="text-2xl flex-shrink-0 opacity-80">{s.icon}</span>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-white mb-1.5">{s.code}</div>
                    <div className="text-xs text-white/60 leading-relaxed">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </div>
    </>
  , document.body);
}

// ── Trigger button ────────────────────────────────────────────────────────────
export function GlossaryTrigger({ onClick, label = 'Reference guide' }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 text-white/60 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg backdrop-blur-md">
      <BookOpen size={14} /> {label}
    </button>
  );
}

export default GlossaryDrawer;