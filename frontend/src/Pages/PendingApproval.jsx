import { Clock, LogOut, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { LiquidButton as Button } from '../liquid-glass-button';
import { BentoCard } from '../bento-card';

export default function PendingApproval({ user, onLogout, status = 'pending' }) {
  const isInactive       = status === 'inactive';
  const isInviteRequested = status === 'invite_requested';

  const heading   = isInactive        ? 'Account Deactivated'
                  : isInviteRequested ? 'Waiting for Admin Approval'
                  :                     'Awaiting Approval';
  const body      = isInactive
    ? 'Your account has been deactivated. Please contact your system administrator if you believe this is a mistake.'
    : isInviteRequested
    ? 'Your access request is pending. Your company admin will review it and approve your account. You can then log in with the email and password you set.'
    : 'Your account is pending Super Admin approval. You\'ll receive access once your registration is reviewed.';

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center font-sans p-6 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-black to-black pointer-events-none" />
      
      <BentoCard className="w-full max-w-md p-8 lg:p-12 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-500 rounded-[2rem]">
        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 ${isInactive ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
          {isInactive ? <ShieldCheck size={28} className="text-red-500" /> : <Clock size={28} className="text-amber-500" />}
        </div>

        <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">
          {heading}
        </h2>

        <p className="text-sm text-white/60 leading-relaxed mb-6">
          {body}
        </p>

        {!isInactive && (
          <p className="text-xs text-white/40 mb-8 font-medium">
            Signed in as <strong className="text-white font-semibold">{user?.email}</strong>
          </p>
        )}
        {isInactive && <div className="mb-8" />}

        <Button variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            if (onLogout) onLogout();
          }}
          className="w-full"
        >
          <LogOut size={15} /> Sign out
        </Button>
      </BentoCard>
    </div>
  );
}
