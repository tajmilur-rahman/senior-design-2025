import { useState } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import axios from 'axios';

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
    <div className="min-h-[100dvh] w-full flex items-center justify-center font-sans bg-black p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-black to-black pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 lg:p-12 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
          <KeyRound size={28} className="text-blue-400" />
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
            className={`w-full bg-black/50 border rounded-2xl px-4 py-4 text-white text-center text-xl font-bold tracking-[0.3em] uppercase outline-none transition-all ${error ? 'border-red-500/50 focus:border-red-500 focus:bg-red-500/10' : 'border-white/10 focus:border-blue-500/50 focus:bg-white/5'}`}
          />

          {error && (
            <p className="m-0 text-sm text-red-400 font-bold">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            <ShieldCheck size={18} />
            {loading ? 'Verifying…' : 'Verify Code'}
          </button>
        </form>

        <div className="mt-8 border-t border-white/10 pt-6">
          <button
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-transparent hover:bg-white/10 border border-transparent hover:border-white/10 text-white/50 hover:text-white text-sm font-bold transition-all w-full"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
