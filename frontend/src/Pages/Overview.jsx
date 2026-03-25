import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Database, Activity, AlertTriangle, ExternalLink, RefreshCw, TrendingUp, ShieldCheck, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const SEV_COLORS = { S1: '#ef4444', S2: '#f59e0b', S3: '#3b82f6', S4: '#64748b' };

function SevDot({ sev }) {
  return <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: SEV_COLORS[sev] || 'var(--text-sec)', boxShadow: sev === 'S1' ? '0 0 0 3px rgba(239,68,68,0.18)' : 'none' }} />;
}

function LiveFeedRow({ bug }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <SevDot sev={bug.severity} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>#{bug.id}</span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={bug.summary}>{bug.summary}</span>
      <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 4, fontFamily: 'var(--font-mono)', background: SEV_COLORS[bug.severity] ? `${SEV_COLORS[bug.severity]}15` : 'var(--hover-bg)', color: SEV_COLORS[bug.severity] || 'var(--text-sec)', flexShrink: 0 }}>
        {bug.severity || 'S3'}
      </span>
    </div>
  );
}

export default function Overview({ user, onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get('/api/hub/overview');
      setData(res.data); setError(false); setLastUpdated(new Date());
    } catch { setError(true); }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!error) return;
    const fastPoll = setInterval(fetchData, 3000);
    return () => clearInterval(fastPoll);
  }, [error, fetchData]);

  if (error && !data) return (
    <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 14 }}>
      <RefreshCw size={32} className="spin" color="var(--accent)" />
      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)' }}>Connecting…</div>
      <div style={{ fontSize: 13, color: 'var(--text-sec)' }}>Waiting for the backend to respond.</div>
    </div>
  );

  if (!data) return (
    <div className="page-content" style={{ textAlign: 'center', marginTop: 60, color: 'var(--text-sec)' }}>
      <RefreshCw size={22} className="spin" color="var(--accent)" style={{ display: 'block', margin: '0 auto 12px' }} />
      <span style={{ fontSize: 13 }}>Loading dashboard…</span>
    </div>
  );

  const topComponent = data.charts?.components?.[0]?.name || 'General';

  return (
    <div className="page-content fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 32, paddingBottom: 28, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: error ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${error ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: 99 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: error ? 'var(--danger)' : '#10b981', boxShadow: error ? 'none' : '0 0 0 3px rgba(16,185,129,0.2)' }} className={error ? '' : 'pulse-dot'} />
                <span style={{ fontSize: 11, fontWeight: 700, color: error ? 'var(--danger)' : '#10b981' }}>{error ? 'Reconnecting' : 'Live'}</span>
              </div>
              {lastUpdated && !error && (
                <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: -1.5, lineHeight: 1.1 }}>
              Bug Priority <span style={{ color: 'var(--accent)' }}>OS</span>
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-sec)', margin: '8px 0 0' }}>Intelligent defect triage and severity classification</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="sys-btn outline" onClick={() => onNavigate('submit')} style={{ fontSize: 12, padding: '8px 16px' }}>
              <Zap size={13} /> Submit a bug
            </button>
            <button className="sys-btn outline" onClick={() => onNavigate('database')} style={{ fontSize: 12, padding: '8px 16px' }}>
              <Database size={13} /> Open database
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <div className="sys-card" onClick={() => onNavigate('database', '')} style={{ padding: 22, cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Total records</span>
            <ExternalLink size={13} color="var(--text-sec)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <Database size={28} strokeWidth={1.3} color="var(--text-sec)" />
            <div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{data.stats.total_db.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 3 }}>All time</div>
            </div>
          </div>
        </div>

        <div className="sys-card" onClick={() => onNavigate('database', 'Fixed')} style={{ padding: 22, cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Processed</span>
            <ExternalLink size={13} color="var(--text-sec)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <TrendingUp size={28} strokeWidth={1.3} color="var(--accent)" />
            <div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{data.stats.analyzed.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 3 }}>Triaged & actioned</div>
            </div>
          </div>
        </div>

        <div className="sys-card" onClick={() => onNavigate('database', 'S1')} style={{ padding: 22, cursor: 'pointer', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(239,68,68,0.7)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Critical open</span>
            <AlertTriangle size={13} color="#ef4444" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <Activity size={28} strokeWidth={1.3} color="#ef4444" />
            <div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#ef4444', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{data.stats.critical}</div>
              <div style={{ fontSize: 11, color: 'rgba(239,68,68,0.6)', marginTop: 3 }}>Needs attention</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="sys-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Activity size={14} color="var(--accent)" /> Recent activity
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {error ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)' }} /> : <div className="pulse-dot" style={{ width: 6, height: 6 }} />}
              <button className="sys-btn outline" onClick={() => onNavigate('database', '')} style={{ fontSize: 11, padding: '4px 10px' }}>View all</button>
            </div>
          </div>
          <div style={{ minHeight: 240 }}>
            {(data.recent || []).length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-sec)', fontSize: 13 }}>No reports yet.</div>
            ) : (data.recent || []).map((bug, i) => <LiveFeedRow key={i} bug={bug} />)}
          </div>
        </div>

        <div className="sys-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <ShieldCheck size={14} color="var(--accent)" /> Top components
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>by bug volume</span>
          </div>
          {data.charts?.components?.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.charts.components} layout="vertical" margin={{ top: 0, right: 20, left: 30, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: 'var(--text-sec)', fontWeight: 600 }} />
                  <Tooltip
                    cursor={{ fill: 'var(--hover-bg)' }}
                    contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: 12 }}
                    formatter={(v) => [`${v} bugs`, 'Count']}
                  />
                  <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={16}>
                    {data.charts.components.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#ef4444' : 'var(--accent)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {topComponent !== 'General' && (
                <p style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 12, margin: '12px 0 0', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--text-main)' }}>{topComponent}</strong> has the highest number of open issues right now.
                </p>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, color: 'var(--text-sec)', fontSize: 13 }}>
              No component data yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
