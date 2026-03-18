import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Database, Activity, AlertTriangle, ExternalLink, Zap, RefreshCw, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function LiveFeedRow({ bug }) {
  const isCritical = bug.severity === 'S1';
  return (
    <div className="live-feed-item" style={{ gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: isCritical ? 'var(--danger)' : 'var(--text-sec)',
          boxShadow: isCritical ? '0 0 0 3px rgba(239,68,68,0.2)' : 'none'
        }} />
        <span className="feed-id">#{bug.id}</span>
      </div>
      <span className="feed-summary" title={bug.summary}>{bug.summary}</span>
      <span className={`pill ${bug.severity}`} style={{ flexShrink: 0, fontSize: 10 }}>
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
      setData(res.data);
      setError(false);
      setLastUpdated(new Date());
    } catch (err) {
      setError(true);
    }
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

  useEffect(() => {
    const handler = () => {
      setTimeout(fetchData, 800);
      setTimeout(fetchData, 2500);
    };
    window.addEventListener('apex:bug-submitted', handler);
    return () => window.removeEventListener('apex:bug-submitted', handler);
  }, [fetchData]);

  if (error && !data) {
    return (
      <div className="page-content centered-page" style={{ flexDirection: 'column', gap: 14, minHeight: '60vh' }}>
        <RefreshCw size={32} className="spin" color="var(--accent)" />
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)' }}>Connecting to server…</div>
        <div style={{ fontSize: 13, color: 'var(--text-sec)' }}>Waiting for the backend to respond.</div>
      </div>
    );
  }

  if (!data) return (
    <div className="page-content" style={{ textAlign: 'center', marginTop: 60, color: 'var(--text-sec)' }}>
      <RefreshCw size={22} className="spin" color="var(--accent)" style={{ display: 'block', margin: '0 auto 12px' }} />
      <span style={{ fontSize: 13 }}>Loading dashboard…</span>
    </div>
  );

  const topComponent = data.charts?.components?.[0]?.name || 'General';

  return (
    <div className="scroll-container fade-in">

      {/* ── Hero ── */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="live-pill" style={{
            borderColor: error ? 'rgba(239,68,68,0.3)' : '',
            color: error ? 'var(--danger)' : ''
          }}>
            <span className={error ? '' : 'pulse-dot'} style={{
              background: error ? 'var(--danger)' : '',
              width: 7, height: 7, borderRadius: '50%', display: 'inline-block'
            }} />
            {error ? 'Reconnecting…' : 'Live'}
          </div>
          <h1>Bug Priority <span style={{ color: 'var(--accent)' }}>OS</span></h1>
          <p className="subtitle">Intelligent defect triage and severity classification</p>
          {lastUpdated && !error && (
            <p style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 6, opacity: 0.7 }}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </section>

      {/* ── Stat cards ── */}
      <div className="stats-row">
        <div className="sys-card big-stat" onClick={() => onNavigate('database', '')} title="View all records">
          <div className="stat-top-row">
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Total records
            </span>
            <ExternalLink size={13} color="var(--text-sec)" />
          </div>
          <div className="stat-main-content">
            <Database size={36} strokeWidth={1.2} color="var(--text-sec)" />
            <div>
              <div className="stat-value">{data.stats.total_db.toLocaleString()}</div>
              <div className="stat-sub" style={{ fontSize: 10, opacity: 0.6 }}>All time</div>
            </div>
          </div>
        </div>

        <div className="sys-card big-stat" onClick={() => onNavigate('database', 'Fixed')} title="View processed bugs">
          <div className="stat-top-row">
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Processed
            </span>
            <ExternalLink size={13} color="var(--text-sec)" />
          </div>
          <div className="stat-main-content">
            <TrendingUp size={36} strokeWidth={1.2} color="var(--accent)" />
            <div>
              <div className="stat-value">{data.stats.analyzed.toLocaleString()}</div>
              <div className="stat-sub" style={{ fontSize: 10, opacity: 0.6 }}>Triaged & actioned</div>
            </div>
          </div>
        </div>

        <div className="sys-card big-stat highlight-blue" onClick={() => onNavigate('database', 'S1')} title="View critical bugs">
          <div className="stat-top-row">
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Critical
            </span>
            <AlertTriangle size={15} color="rgba(255,255,255,0.8)" />
          </div>
          <div className="stat-main-content">
            <Activity size={36} strokeWidth={1.2} color="#fff" />
            <div>
              <div className="stat-value">{data.stats.critical}</div>
              <div className="stat-sub" style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Needs attention</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Live feed ── */}
      <div className="feature-section right-align" style={{ alignItems: 'flex-start' }}>
        <div className="feature-text">
          <h2>Recent activity</h2>
          <div className="divider-line" />
          <p>
            The latest bug submissions from your team, updated every 15 seconds.
            Click any entry in the database view for full details.
          </p>
          <button className="sys-btn outline" onClick={() => onNavigate('database', '')}>
            Open database
          </button>
        </div>
        <div className="feature-visual">
          <div className="sys-card feed-card">
            <div className="feed-header">
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', letterSpacing: 0.5 }}>
                Latest reports
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {error
                  ? <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)' }} />
                  : <div className="pulse-dot" />
                }
              </div>
            </div>
            <div className="feed-list custom-scrollbar">
              {(data.recent || []).length === 0
                ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-sec)', fontSize: 12 }}>
                    No reports yet — submit your first bug above.
                  </div>
                )
                : (data.recent || []).map((bug, i) => <LiveFeedRow key={i} bug={bug} />)
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── Component chart ── */}
      <div className="feature-section left-align">
        <div className="feature-visual">
          <div className="sys-card" style={{ width: '100%', padding: 24, height: 320 }}>
            <h3 style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 20,
              textTransform: 'uppercase', letterSpacing: 0.8
            }}>
              Top components by volume
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.charts.components} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name" type="category" width={120}
                  tick={{ fontSize: 11, fill: 'var(--text-sec)', fontWeight: 600 }}
                />
                <Tooltip
                  cursor={{ fill: 'var(--hover-bg)' }}
                  contentStyle={{
                    borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--card-bg)', color: 'var(--text-main)',
                    boxShadow: 'var(--shadow-md)', fontSize: 12
                  }}
                  itemStyle={{ color: 'var(--text-main)' }}
                  formatter={(v) => [`${v} bugs`, 'Count']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                  {data.charts.components.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--danger)' : 'var(--accent)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="feature-text">
          <h2>Component breakdown</h2>
          <div className="divider-line" />
          <p>
            Defect volume by component, ranked in real time.
            {topComponent !== 'General' && (
              <> <strong>{topComponent}</strong> is currently reporting the highest number of open issues.</>
            )}
          </p>
        </div>
      </div>

    </div>
  );
}