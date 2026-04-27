import { useState } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { LiquidButton as Button } from '../liquid-glass-button';
import { BentoCard } from '../bento-card';
import { DottedSurface } from '../Components/ui/dotted-surface';

export default function CodeWall({ user, onLogout, onVerified }) {
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/invite/verify_code', { code: code.trim() });
      onVerified();
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center font-sans p-6 relative overflow-hidden bg-black">
      {/* Animated dotted surface background */}
      <DottedSurface className="z-0" />
      
      {/* Deep vignette + color wash over dots */}
      <div className="fixed inset-0 z-[1] pointer-events-none" style={{ background: 'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 35%, rgba(0,0,0,0.65) 100%)' }} />
      
      {/* Subtle magenta-cyan gradient bloom at center */}
      <div className="fixed inset-0 z-[1] pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(142,59,255,0.12) 0%, transparent 70%)' }} />

      <BentoCard className="w-full max-w-md rounded-[2rem] p-8 lg:p-12 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-500 relative z-10">
        <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6">
          <KeyRound size={28} className="text-indigo-400" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
          Enter Your Invite Code
        </h2>
        <p className="text-sm text-white/60 leading-relaxed mb-2">
          Your access request was approved. Check your email for the invite code sent by your company admin.
        </p>
        <p className="text-xs text-white/40 mb-8 font-medium">
          Signed in as <strong className="text-white font-semibold">{user?.email}</strong>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Invite code (e.g. ABC123)"
            value={code}
            onChange={e => setCode(e.target.value)}
            autoFocus
            className={`w-full bg-black/20 border rounded-2xl px-4 py-4 text-white text-center text-xl font-bold tracking-[0.3em] uppercase outline-none transition-all ${error ? 'border-red-500/50 focus:border-red-500 focus:bg-red-500/10' : 'border-white/10 focus:border-indigo-500/50 focus:bg-white/5'}`}
          />

          {error && (
            <p className="m-0 text-sm text-red-400 font-bold">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full font-bold py-4 mt-2"
          >
            <ShieldCheck size={18} />
            {loading ? 'Verifying…' : 'Verify Code'}
          </Button>
        </form>

        <div className="mt-8 border-t border-white/10 pt-6">
          <button
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-transparent hover:bg-white/10 border border-transparent hover:border-white/10 text-white/50 hover:text-white text-sm font-bold transition-all w-full"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </BentoCard>
    </div>
  );
}
