import { Clock, LogOut, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function PendingApproval({ user, onLogout, status = 'pending' }) {
  const isInactive       = status === 'inactive';
  const isInviteRequested = status === 'invite_requested';

  const iconColor = isInactive ? '#ef4444' : '#f59e0b';
  const iconBg    = isInactive ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)';
  const heading   = isInactive        ? 'Account Deactivated'
                  : isInviteRequested ? 'Waiting for Admin Approval'
                  :                     'Awaiting Approval';
  const body      = isInactive
    ? 'Your account has been deactivated. Please contact your system administrator if you believe this is a mistake.'
    : isInviteRequested
    ? 'Your access request is pending. Your company admin will review it and approve your account. You can then log in with the email and password you set.'
    : 'Your account is pending Super Admin approval. You\'ll receive access once your registration is reviewed.';

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', flexDirection: 'column', gap: 0, padding: 24,
    }}>
      <div style={{
        maxWidth: 480, width: '100%', background: 'var(--card-bg)',
        border: '1px solid var(--border)', borderRadius: 16,
        padding: '48px 40px', textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
        }}>
          {isInactive ? <ShieldCheck size={32} color={iconColor} /> : <Clock size={32} color={iconColor} />}
        </div>

        <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>
          {heading}
        </h2>

        <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-sec)', lineHeight: 1.7 }}>
          {body}
        </p>

        {!isInactive && (
          <p style={{ margin: '0 0 32px', fontSize: 13, color: 'var(--text-sec)', lineHeight: 1.6 }}>
            Signed in as <strong style={{ color: 'var(--text-main)' }}>{user?.email}</strong>
          </p>
        )}
        {isInactive && <div style={{ marginBottom: 32 }} />}

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            if (onLogout) onLogout();
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--hover-bg)', color: 'var(--text-main)',
            cursor: 'pointer', fontSize: 14, fontWeight: 600,
            fontFamily: 'var(--font-head)',
          }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  );
}
