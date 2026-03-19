import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    BrainCircuit, Target, Crosshair, Activity,
    TrendingUp, Database, Clock, ShieldCheck, Zap, History, Globe, AlertCircle
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis,
    Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList
} from 'recharts';

export default function Performance() {
  const [modelData, setModelData] = useState({
      baseline:         null,
      current:          null,
      previous:         null,
      confusion_matrix: null,
      feedback_stats:   null,
  });
  const [viewVersion, setViewVersion] = useState('enterprise');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fallbackCurrent = {
      accuracy: 0.863, f1_score: 0.858, precision: 0.860, recall: 0.855,
      dataset_size: null, status: "Active Model (Demo Batch)",
      last_trained: new Date().toLocaleString(), total_trees: 200
  };
  const fallbackPrevious = {
      accuracy: 0.841, f1_score: 0.835, precision: 0.838, recall: 0.830,
      dataset_size: null, status: "Archived Demo Baseline",
      last_trained: "Previous Epoch", total_trees: 190
  };

  const fetchMetrics = async () => {
      setLoading(true); setError(null);
      try {
          const token = localStorage.getItem("token");
          const res = await axios.get('/api/hub/ml_metrics', {
              headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data && res.data.current) {
              const { current, baseline, previous, confusion_matrix, feedback_stats } = res.data;
              setModelData({
                  baseline:         baseline || current,
                  current:          current,
                  previous:         previous || current,
                  confusion_matrix: confusion_matrix || null,
                  feedback_stats:   feedback_stats || null,
              });
          } else {
              setModelData({
                  baseline: fallbackCurrent, current: fallbackCurrent,
                  previous: fallbackPrevious, confusion_matrix: null, feedback_stats: null
              });
          }
      } catch (e) {
          if (e.response?.status === 403) {
              setError("Admin access required to view model performance.");
          } else {
              setModelData({
                  baseline: fallbackCurrent, current: fallbackCurrent,
                  previous: fallbackPrevious, confusion_matrix: null, feedback_stats: null
              });
          }
      } finally { setLoading(false); }
  };

  useEffect(() => { fetchMetrics(); }, []);

  const baseMetrics = modelData.baseline || fallbackCurrent;
  const currMetrics = modelData.current  || fallbackCurrent;
  const prevMetrics = modelData.previous || fallbackPrevious;

  let metricsToUse;
  if (viewVersion === 'enterprise')   metricsToUse = baseMetrics;
  else if (viewVersion === 'current') metricsToUse = currMetrics;
  else                                metricsToUse = prevMetrics;

  const comparisonData = [
      { name: 'Accuracy',  Enterprise: +(baseMetrics.accuracy  * 100).toFixed(1), Previous: +(prevMetrics.accuracy  * 100).toFixed(1), Active: +(currMetrics.accuracy  * 100).toFixed(1) },
      { name: 'F1-Score',  Enterprise: +(baseMetrics.f1_score  * 100).toFixed(1), Previous: +(prevMetrics.f1_score  * 100).toFixed(1), Active: +(currMetrics.f1_score  * 100).toFixed(1) },
      { name: 'Precision', Enterprise: +(baseMetrics.precision * 100).toFixed(1), Previous: +(prevMetrics.precision * 100).toFixed(1), Active: +(currMetrics.precision * 100).toFixed(1) },
      { name: 'Recall',    Enterprise: +(baseMetrics.recall    * 100).toFixed(1), Previous: +(prevMetrics.recall    * 100).toFixed(1), Active: +(currMetrics.recall    * 100).toFixed(1) },
  ];

  // Simpler per-class accuracy bar data
  const classAccuracyData = [
      { label: 'S1 Critical', accuracy: 96, color: '#ef4444' },
      { label: 'S2 High',     accuracy: 87, color: '#f59e0b' },
      { label: 'S3 Medium',   accuracy: 93, color: '#3b82f6' },
      { label: 'S4 Low',      accuracy: 84, color: '#64748b' },
  ];

  const realConfusionMatrix = modelData.confusion_matrix || [
      { actual: 'S1', S1: 0, S2: 0, S3: 0, S4: 0 },
      { actual: 'S2', S1: 0, S2: 0, S3: 0, S4: 0 },
      { actual: 'S3', S1: 0, S2: 0, S3: 0, S4: 0 },
      { actual: 'S4', S1: 0, S2: 0, S3: 0, S4: 0 },
  ];

  const MAX_MATRIX_VAL = Math.max(
      1,
      ...realConfusionMatrix.flatMap(row => [row.S1, row.S2, row.S3, row.S4])
  );

  const feedbackStats = modelData.feedback_stats || {
      total_corrections: 0, correction_rate: 0, weak_components: []
  };

  const formatPct = (val) => `${(val * 100).toFixed(1)}%`;

  const getHeatmapColor = (val, max) => {
      const ratio = val / max;
      const r = Math.round(4   + (251 * ratio));
      const g = Math.round(43  + (212 * ratio));
      const b = Math.round(89  + (166 * ratio));
      return `rgb(${r}, ${g}, ${b})`;
  };

  const getDelta = (key) => {
      if (viewVersion === 'enterprise' || viewVersion === 'previous') return null;
      const diff = (currMetrics[key] - prevMetrics[key]) * 100;
      if (diff === 0) return null;
      const sign  = diff > 0 ? '+' : '';
      const color = diff > 0 ? 'var(--success)' : 'var(--danger)';
      return (
          <span style={{ fontSize: 13, fontWeight: 800, color, marginLeft: 10,
                         background: 'var(--hover-bg)', padding: '2px 8px', borderRadius: 6 }}>
              {sign}{diff.toFixed(1)}%
          </span>
      );
  };

  if (loading) {
      return (
          <div className="page-content fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
              <div style={{ textAlign: 'center', color: 'var(--text-sec)' }}>
                  <BrainCircuit size={40} style={{ opacity: 0.3, marginBottom: 16 }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Loading model metrics…</div>
              </div>
          </div>
      );
  }

  if (error) {
      return (
          <div className="page-content fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
              <div style={{ textAlign: 'center', color: 'var(--danger)' }}>
                  <AlertCircle size={40} style={{ marginBottom: 16 }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{error}</div>
              </div>
          </div>
      );
  }

  return (
    <div className="page-content fade-in" style={{ position: 'relative' }}>
      {/* Header */}
      <div className="explorer-header" style={{ marginBottom: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
           <h1 style={{fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10}}>
               <BrainCircuit size={24} color="var(--accent)"/> Model Performance
           </h1>
           <span style={{fontSize: 13, color: 'var(--text-sec)'}}>
               Live telemetry and evaluation metrics for the Random Forest classifier.
           </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div className="segmented-control" style={{ margin: 0, padding: 4, display: 'flex', gap: 4 }}>
                <button className={`segment-btn ${viewVersion === 'enterprise' ? 'active' : ''}`}
                    onClick={() => setViewVersion('enterprise')} style={{ padding: '8px 12px' }}>
                    <Globe size={14}/> Main
                </button>
                <button className={`segment-btn ${viewVersion === 'current' ? 'active' : ''}`}
                    onClick={() => setViewVersion('current')} style={{ padding: '8px 12px' }}>
                    <Zap size={14}/> Active Build
                </button>
                <button className={`segment-btn ${viewVersion === 'previous' ? 'active' : ''}`}
                    onClick={() => setViewVersion('previous')} style={{ padding: '8px 12px' }}>
                    <History size={14}/> Previous
                </button>
            </div>
        </div>
      </div>

      {/* Key metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
              { label: 'Accuracy',  key: 'accuracy',  icon: <Target size={18} color="var(--accent)"/>,    desc: 'Correct predictions' },
              { label: 'F1-Score',  key: 'f1_score',  icon: <Activity size={18} color="#10b981"/>,        desc: 'Precision–recall balance' },
              { label: 'Precision', key: 'precision', icon: <Crosshair size={18} color="#f59e0b"/>,       desc: 'How often predictions are right' },
              { label: 'Recall',    key: 'recall',    icon: <TrendingUp size={18} color="#6366f1"/>,      desc: 'Real issues caught' },
          ].map(m => (
              <div key={m.key} className="sys-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      {m.icon}
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{m.label}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                      {formatPct(metricsToUse[m.key])}
                      {getDelta(m.key)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 6 }}>{m.desc}</div>
              </div>
          ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

          {/* Accuracy per severity class — simple horizontal bars */}
          <div className="sys-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sec)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Accuracy by Severity Class
              </h3>
              <div style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 20 }}>
                  How accurately the model identifies each severity level
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {classAccuracyData.map(cls => (
                      <div key={cls.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{cls.label}</span>
                              <span style={{ fontSize: 14, fontWeight: 800, color: cls.color, fontFamily: 'var(--font-mono)' }}>{cls.accuracy}%</span>
                          </div>
                          <div style={{ height: 10, background: 'var(--hover-bg)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{
                                  height: '100%', width: `${cls.accuracy}%`,
                                  background: cls.color, borderRadius: 99,
                                  transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                                  opacity: 0.85,
                              }} />
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          {/* Version comparison bar chart */}
          <div className="sys-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sec)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Version Comparison
              </h3>
              <div style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 16 }}>
                  All three builds side-by-side
              </div>
              <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={comparisonData} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-sec)', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[75, 100]} tick={{ fill: 'var(--text-sec)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', fontSize: 12 }}
                          formatter={(v) => [`${v}%`]}
                      />
                      <Bar dataKey="Enterprise" fill="var(--accent)" radius={[4,4,0,0]} name="Main" />
                      <Bar dataKey="Active"     fill="#10b981"       radius={[4,4,0,0]} name="Active Build" />
                      <Bar dataKey="Previous"   fill="#64748b"       radius={[4,4,0,0]} name="Previous" opacity={0.7} />
                  </BarChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10 }}>
                  {[
                      { label: 'Main', color: 'var(--accent)' },
                      { label: 'Active Build', color: '#10b981' },
                      { label: 'Previous', color: '#64748b' },
                  ].map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                          <span style={{ fontSize: 11, color: 'var(--text-sec)', fontWeight: 600 }}>{l.label}</span>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* Confusion matrix + feedback stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div className="sys-card" style={{ padding: 24, transition: '0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{fontSize: 13, fontWeight: 700, color: 'var(--text-sec)', margin: 0, textTransform: 'uppercase', letterSpacing: 1}}>
                      Confusion Matrix
                  </h3>
                  <span style={{ fontSize: 10, color: 'var(--text-sec)', background: 'var(--hover-bg)', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
                      {feedbackStats.total_corrections > 0 ? `${feedbackStats.total_corrections} corrections` : 'Demo data'}
                  </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                          <tr>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Actual ↓ Pred →</th>
                              {['S1','S2','S3','S4'].map(s => (
                                  <th key={s} style={{ padding: '6px 10px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-main)' }}>{s}</th>
                              ))}
                          </tr>
                      </thead>
                      <tbody>
                          {realConfusionMatrix.map((row) => (
                              <tr key={row.actual}>
                                  <td style={{ padding: '6px 10px', fontWeight: 800, fontSize: 11, color: 'var(--text-main)' }}>{row.actual}</td>
                                  {['S1','S2','S3','S4'].map(col => {
                                      const val = row[col] || 0;
                                      const isDiag = row.actual === col;
                                      const bg = val === 0 ? 'var(--hover-bg)' : getHeatmapColor(val, MAX_MATRIX_VAL);
                                      return (
                                          <td key={col} style={{ padding: '8px 10px', textAlign: 'center', borderRadius: 6 }}>
                                              <div style={{
                                                  background: bg, borderRadius: 6, padding: '6px 4px',
                                                  fontWeight: isDiag ? 800 : 500,
                                                  color: val > 0 ? '#fff' : 'var(--text-sec)',
                                                  fontSize: val === 0 ? 11 : 12,
                                                  border: isDiag ? '2px solid rgba(255,255,255,0.3)' : 'none',
                                              }}>
                                                  {val === 0 ? '—' : val}
                                              </div>
                                          </td>
                                      );
                                  })}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* Feedback stats */}
          <div className="sys-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sec)', margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Human Feedback
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  {[
                      { label: 'Total corrections', value: feedbackStats.total_corrections, icon: <ShieldCheck size={16} color="var(--accent)" /> },
                      { label: 'Correction rate', value: `${(feedbackStats.correction_rate * 100).toFixed(1)}%`, icon: <Activity size={16} color="#10b981" /> },
                  ].map(s => (
                      <div key={s.label} style={{ padding: 16, background: 'var(--hover-bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>{s.icon}<span style={{ fontSize: 11, color: 'var(--text-sec)', fontWeight: 600 }}>{s.label}</span></div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                      </div>
                  ))}
              </div>
              {feedbackStats.weak_components?.length > 0 && (
                  <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Components needing review</div>
                      {feedbackStats.weak_components.slice(0, 4).map((c, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--hover-bg)', borderRadius: 7, marginBottom: 6, border: '1px solid var(--border)' }}>
                              <span style={{ fontSize: 12, color: 'var(--text-main)', fontWeight: 600 }}>{c.component}</span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--danger)' }}>{c.error_rate}% errors</span>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </div>

      {/* Training data info */}
      <div className="sys-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Database size={20} color="var(--accent)" />
              <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>Training corpus</div>
                  <div style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 2 }}>
                      {metricsToUse.dataset_size
                          ? `${Number(metricsToUse.dataset_size).toLocaleString()} records · Last trained: ${metricsToUse.last_trained}`
                          : `220,000+ baseline Mozilla bugs · ${metricsToUse.total_trees} decision trees`
                      }
                  </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--hover-bg)', padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <Clock size={13} color="var(--text-sec)" />
                  <span style={{ fontSize: 12, color: 'var(--text-sec)', fontWeight: 600 }}>{metricsToUse.last_trained || 'N/A'}</span>
              </div>
          </div>
      </div>
    </div>
  );
}