import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    BrainCircuit, Target, Crosshair, Activity,
    TrendingUp, Database, Clock, ShieldCheck, Zap, History, Globe, AlertCircle, RefreshCw
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis,
    Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

// Static per-class precision/recall for the Class Accuracy chart
const classMetrics = [
    { subject: 'S1 Critical', precision: 95, recall: 98 },
    { subject: 'S2 High',     precision: 88, recall: 85 },
    { subject: 'S3 Normal',   precision: 92, recall: 94 },
    { subject: 'S4 Low',      precision: 85, recall: 82 },
];

const SEV_COLORS = { S1: '#ef4444', S2: '#f59e0b', S3: '#3b82f6', S4: '#64748b' };

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
      setLoading(true);
      setError(null);
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
              console.warn("API responded but 'current' metrics are missing.");
              setModelData({
                  baseline: fallbackCurrent, current: fallbackCurrent,
                  previous: fallbackPrevious, confusion_matrix: null, feedback_stats: null
              });
          }
      } catch (e) {
          console.error("Fetch Metrics Error:", e);
          if (e.response?.status === 403) {
              setError("Admin access required to view model performance.");
          } else {
              setModelData({
                  baseline: fallbackCurrent, current: fallbackCurrent,
                  previous: fallbackPrevious, confusion_matrix: null, feedback_stats: null
              });
          }
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => { fetchMetrics(); }, []);

  // ── Derived values ──────────────────────────────────────────────────────────
  const baseMetrics = modelData.baseline || fallbackCurrent;
  const currMetrics = modelData.current  || fallbackCurrent;
  const prevMetrics = modelData.previous || fallbackPrevious;

  let metricsToUse;
  if (viewVersion === 'enterprise')   metricsToUse = baseMetrics;
  else if (viewVersion === 'current') metricsToUse = currMetrics;
  else                                metricsToUse = prevMetrics;

  const comparisonData = [
      { name: 'Accuracy',  Enterprise: baseMetrics.accuracy  * 100, Previous: prevMetrics.accuracy  * 100, Active: currMetrics.accuracy  * 100 },
      { name: 'F1-Score',  Enterprise: baseMetrics.f1_score  * 100, Previous: prevMetrics.f1_score  * 100, Active: currMetrics.f1_score  * 100 },
      { name: 'Precision', Enterprise: baseMetrics.precision * 100, Previous: prevMetrics.precision * 100, Active: currMetrics.precision * 100 },
      { name: 'Recall',    Enterprise: baseMetrics.recall    * 100, Previous: prevMetrics.recall    * 100, Active: currMetrics.recall    * 100 },
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
          <span style={{ fontSize: 11, fontWeight: 700, color, marginLeft: 8,
                         background: color === 'var(--success)' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                         padding: '2px 7px', borderRadius: 5 }}>
              {sign}{diff.toFixed(1)}%
          </span>
      );
  };

  // ── Loading / error states ──────────────────────────────────────────────────
  if (loading) return (
      <div className="page-content fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <div style={{ textAlign: 'center', color: 'var(--text-sec)' }}>
              <RefreshCw size={28} className="spin" style={{ marginBottom: 12, opacity: 0.5 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Loading model metrics…</div>
          </div>
      </div>
  );

  if (error) return (
      <div className="page-content fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <div style={{ textAlign: 'center', color: 'var(--danger)' }}>
              <AlertCircle size={32} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>{error}</div>
          </div>
      </div>
  );

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="page-content fade-in">

      {/* Header — matches Directory / Overview style */}
      <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: -0.5 }}>
            <BrainCircuit size={22} color="var(--accent)" /> Model Performance
          </h1>
          <span style={{ fontSize: 13, color: 'var(--text-sec)' }}>
            Live evaluation metrics for the Random Forest classifier.
          </span>
        </div>

        {/* Version selector */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--hover-bg)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
            {[
              { id: 'enterprise', icon: <Globe size={13} />, label: 'Main brain' },
              { id: 'current',    icon: <Zap size={13} />,   label: 'Active build' },
              { id: 'previous',   icon: <History size={13} />, label: 'Previous' },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setViewVersion(v.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: viewVersion === v.id ? 'var(--card-bg)' : 'transparent',
                  color: viewVersion === v.id ? 'var(--text-main)' : 'var(--text-sec)',
                  boxShadow: viewVersion === v.id ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
            background: viewVersion === 'current' ? 'rgba(16,185,129,0.1)' : 'rgba(56,189,248,0.1)',
            color: viewVersion === 'current' ? 'var(--success)' : viewVersion === 'previous' ? 'var(--text-sec)' : '#38bdf8',
            border: `1px solid ${viewVersion === 'current' ? 'rgba(16,185,129,0.25)' : viewVersion === 'previous' ? 'var(--border)' : 'rgba(56,189,248,0.25)'}`,
          }}>
            {viewVersion === 'current'
              ? <span className="pulse-dot" />
              : viewVersion === 'enterprise' ? <Globe size={9} /> : <History size={9} />}
            {metricsToUse.status}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { key: 'accuracy',    label: 'Accuracy',       icon: <Target size={14} />,    val: formatPct(metricsToUse.accuracy),  accent: 'var(--accent)' },
          { key: 'f1_score',    label: 'F1 Score',        icon: <Activity size={14} />,  val: formatPct(metricsToUse.f1_score),  accent: '#6366f1' },
          { key: 'precision',   label: 'Precision',       icon: <Crosshair size={14} />, val: formatPct(metricsToUse.precision), accent: '#38bdf8' },
          { key: 'recall',      label: 'Recall',          icon: <TrendingUp size={14} />,val: formatPct(metricsToUse.recall),    accent: 'var(--success)' },
          { key: 'correction',  label: 'Correction Rate', icon: <AlertCircle size={14} />, val: `${(feedbackStats.correction_rate * 100).toFixed(1)}%`, accent: '#f59e0b', sub: `${feedbackStats.total_corrections} engineer corrections` },
        ].map(s => (
          <div key={s.key} className="sys-card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <span style={{ color: s.accent }}>{s.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{s.val}</span>
              {s.key !== 'correction' && getDelta(s.key)}
            </div>
            {s.sub && <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 4 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Cross-build bar chart + Class Accuracy chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, marginBottom: 20 }}>
        <div className="sys-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Cross-Build Performance
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, fontWeight: 600 }}>
              <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#38bdf8', display: 'inline-block' }} /> Main brain
              </span>
              <span style={{ color: 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--text-sec)', display: 'inline-block' }} /> Previous
              </span>
              <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} /> Active
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={comparisonData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-sec)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis domain={[70, 100]} stroke="var(--text-sec)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={t => `${t}%`} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: 12 }}
                formatter={v => `${v.toFixed(1)}%`} cursor={{ fill: 'var(--hover-bg)' }}
              />
              <Bar dataKey="Enterprise" fill="#38bdf8" radius={[3,3,0,0]} barSize={11} opacity={0.85} />
              <Bar dataKey="Previous"   fill="var(--text-sec)" radius={[3,3,0,0]} barSize={11} opacity={0.45} />
              <Bar dataKey="Active"     fill="var(--accent)"   radius={[3,3,0,0]} barSize={11} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Class Accuracy — horizontal grouped bar, easy to read for demo */}
        <div className="sys-card" style={{ padding: 22 }}>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Class Accuracy
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 3, display: 'flex', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} /> Precision
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--success)', display: 'inline-block' }} /> Recall
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={248}>
            <BarChart data={classMetrics} layout="vertical" margin={{ left: 0, right: 20, top: 8, bottom: 4 }}>
              <XAxis type="number" domain={[75, 100]} tick={{ fontSize: 10, fill: 'var(--text-sec)' }}
                     tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} />
              <YAxis dataKey="subject" type="category" width={78}
                     tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--text-sec)' }}
                     tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: 12 }}
                formatter={v => `${v}%`} cursor={{ fill: 'var(--hover-bg)' }}
              />
              <Bar dataKey="precision" name="Precision" fill="var(--accent)"   radius={[0,3,3,0]} barSize={9} />
              <Bar dataKey="recall"    name="Recall"    fill="var(--success)"  radius={[0,3,3,0]} barSize={9} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Confusion matrix + Training metadata */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="sys-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Confusion Matrix
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-sec)', background: 'var(--hover-bg)', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
              {feedbackStats.total_corrections > 0
                ? `${feedbackStats.total_corrections} real corrections`
                : 'Submit corrections to populate'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ transform: 'rotate(-90deg)', fontSize: 10, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.5, width: 18, whiteSpace: 'nowrap', marginRight: 14 }}>
              Actual
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(4, 1fr)', gap: 3 }}>
                <div />
                {['S1','S2','S3','S4'].map(l => (
                  <div key={l} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: SEV_COLORS[l], marginBottom: 6 }}>{l}</div>
                ))}
                {realConfusionMatrix.map(row => (
                  <React.Fragment key={row.actual}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, fontSize: 11, fontWeight: 700, color: SEV_COLORS[row.actual] }}>
                      {row.actual}
                    </div>
                    {['S1','S2','S3','S4'].map(col => {
                      const val   = row[col];
                      const ratio = val / MAX_MATRIX_VAL;
                      return (
                        <div key={col} style={{
                          aspectRatio: '1/1',
                          background: getHeatmapColor(val, MAX_MATRIX_VAL),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: ratio > 0.4 ? '#0f172a' : '#fff',
                          fontSize: 13, fontWeight: 600,
                          borderRadius: 4,
                        }}>
                          {val.toLocaleString()}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, paddingLeft: 36 }}>
                Predicted
              </div>
            </div>
          </div>
        </div>

        {/* Training metadata */}
        <div className="sys-card" style={{ padding: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 22 }}>
            Training Metadata
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              {
                icon: <Database size={18} color={viewVersion === 'enterprise' ? '#38bdf8' : 'var(--accent)'} />,
                label: 'Training Volume',
                value: `${metricsToUse.dataset_size?.toLocaleString() || 0} verified bug reports`,
              },
              {
                icon: <ShieldCheck size={18} color="var(--success)" />,
                label: 'Classifier Algorithm',
                value: `Random Forest — ${metricsToUse.total_trees || 100} estimators`,
              },
              {
                icon: <Clock size={18} color="var(--text-sec)" />,
                label: 'Last Trained',
                value: metricsToUse.last_trained,
              },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 38, height: 38, background: 'var(--hover-bg)', borderRadius: 9, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weak components — only shown when real feedback exists */}
      {feedbackStats.weak_components.length > 0 && (
        <div className="sys-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Model Weak Spots
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>
              {feedbackStats.total_corrections} engineer corrections
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={feedbackStats.weak_components} layout="vertical"
                      margin={{ left: 20, right: 40, top: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="component" type="category" width={130}
                     tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--text-sec)' }}
                     tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: 12 }}
                cursor={{ fill: 'var(--hover-bg)' }}
                formatter={val => [`${val} corrections`, 'Count']}
              />
              <Bar dataKey="corrections" fill="var(--accent)" radius={[0,4,4,0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 8 }}>
            Components with the most engineer corrections — consider these retraining priority areas.
          </div>
        </div>
      )}
    </div>
  );
}
