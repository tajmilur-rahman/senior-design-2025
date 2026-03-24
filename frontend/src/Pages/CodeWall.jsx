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
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24,
    }}>
      <div style={{
        maxWidth: 440, width: '100%', background: 'var(--card-bg)',
        border: '1px solid var(--border)', borderRadius: 16,
        padding: '48px 40px', textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(99,102,241,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
        }}>
          <KeyRound size={32} color="#6366f1" />
        </div>

        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>
          Enter Your Invite Code
        </h2>
        <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--text-sec)', lineHeight: 1.7 }}>
          Your access request was approved. Check your email for the invite code sent by your company admin.
        </p>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: 'var(--text-sec)' }}>
          Signed in as <strong style={{ color: 'var(--text-main)' }}>{user?.email}</strong>
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text"
            placeholder="Invite code (e.g. ABC123)"
            value={code}
            onChange={e => setCode(e.target.value)}
            autoFocus
            style={{
              padding: '11px 14px', borderRadius: 9, fontSize: 15, fontWeight: 700,
              letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center',
              border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
              background: 'var(--input-bg)', color: 'var(--text-main)',
              outline: 'none', width: '100%', boxSizing: 'border-box',
            }}
          />

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            style={{
              padding: '11px 0', borderRadius: 9, fontSize: 14, fontWeight: 700,
              background: 'var(--accent)', color: 'white', border: 'none',
              cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !code.trim() ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <ShieldCheck size={15} />
            {loading ? 'Verifying…' : 'Verify Code'}
          </button>
        </form>

        <div style={{ margin: '24px 0 0', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <button
            onClick={onLogout}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-sec)',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
