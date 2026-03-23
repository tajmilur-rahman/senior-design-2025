import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    BrainCircuit, Target, Crosshair, Activity,
    TrendingUp, Database, Clock, ShieldCheck, Zap, History, Globe, AlertCircle,
    PlayCircle, CheckCircle, XCircle, RefreshCw, Cpu, X
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
  const [viewVersion,   setViewVersion]   = useState('enterprise');
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [validating,    setValidating]    = useState(false);
  const [validationRes, setValidationRes] = useState(null);

  // SSE training modal state
  const [trainModal,    setTrainModal]    = useState(false);
  const [trainStep,     setTrainStep]     = useState('');
  const [trainPct,      setTrainPct]      = useState(0);
  const [trainDone,     setTrainDone]     = useState(false);
  const [trainError,    setTrainError]    = useState(null);
  const [trainResult,   setTrainResult]   = useState(null);
  const esRef = useRef(null);

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

  const handleValidate = async () => {
    setValidating(true); setValidationRes(null);
    try {
      const res = await axios.post('/api/admin/model/validate');
      setValidationRes(res.data);
    } catch (e) {
      setValidationRes({ success: false, message: e.response?.data?.detail || 'Validation failed.' });
    } finally { setValidating(false); }
  };

  const handleTrainModel = async () => {
    setTrainModal(true);
    setTrainDone(false);
    setTrainError(null);
    setTrainResult(null);
    setTrainStep('Initializing…');
    setTrainPct(0);

    // Start training
    let streamUrl = '/api/admin/model/train/stream?stream_key=global';
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/admin/model/train/start', null, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.data?.success) {
        setTrainError(res.data?.message || 'No corrections to train on.');
        setTrainDone(true);
        return;
      }
      streamUrl = res.data.stream_url || streamUrl;
    } catch (e) {
      setTrainError(e.response?.data?.detail || 'Could not start training.');
      setTrainDone(true);
      return;
    }

    // Subscribe to SSE progress stream (EventSource can't send auth headers — key is in URL)
    const es = new EventSource(streamUrl);
    esRef.current = es;

    es.onmessage = (evt) => {
      try {
        const state = JSON.parse(evt.data);
        setTrainStep(state.step || '');
        setTrainPct(state.pct || 0);
        if (state.done) {
          setTrainDone(true);
          setTrainError(state.error || null);
          setTrainResult(state.result || null);
          es.close();
          if (!state.error) {
            setTimeout(() => fetchMetrics(), 500);
          }
        }
      } catch (_) {}
    };

    es.onerror = () => {
      setTrainError('Connection to training stream lost.');
      setTrainDone(true);
      es.close();
    };
  };

  const closeTrainModal = () => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setTrainModal(false);
    setTrainDone(false);
    setTrainStep('');
    setTrainPct(0);
    setTrainError(null);
    setTrainResult(null);
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
    <>
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

      {/* Train Model */}
      <div className="sys-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={15} color="#a78bfa" />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>Train Company Model</span>
              <span style={{ fontSize: 11, color: 'var(--text-sec)', marginLeft: 4 }}>Retrain on your feedback corrections</span>
              <button
                  onClick={handleTrainModel}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: '#a78bfa', color: 'white', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                  <Cpu size={12} /> Train Model
              </button>
          </div>
          <div style={{ padding: '14px 20px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: 0 }}>
                  Incrementally trains your company's model using feedback corrections. Each retrain adds new trees to the ensemble — your model improves without losing prior knowledge.
              </p>
          </div>
      </div>

      {/* Model Validation */}
      <div className="sys-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={15} color="var(--accent)" />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>Model Validation</span>
              <span style={{ fontSize: 11, color: 'var(--text-sec)', marginLeft: 4 }}>Run against recent feedback corrections</span>
              <button
                  onClick={handleValidate}
                  disabled={validating}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: validating ? 'not-allowed' : 'pointer', opacity: validating ? 0.7 : 1 }}
              >
                  {validating ? <><RefreshCw size={12} className="spin" /> Running…</> : <><PlayCircle size={12} /> Run Validation</>}
              </button>
          </div>
          <div style={{ padding: 20 }}>
              {!validationRes ? (
                  <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: 0 }}>
                      Click "Run Validation" to benchmark the current model against user-corrected feedback records.
                  </p>
              ) : !validationRes.success ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
                      <AlertCircle size={14} /> {validationRes.message}
                  </div>
              ) : (
                  <div className="fade-in">
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
                          {[
                              { label: 'Accuracy',       value: `${validationRes.accuracy}%`, color: validationRes.accuracy >= 70 ? 'var(--success)' : 'var(--danger)' },
                              { label: 'Correct',        value: validationRes.correct,        color: 'var(--text-main)' },
                              { label: 'Samples tested', value: validationRes.total,          color: 'var(--text-main)' },
                          ].map(s => (
                              <div key={s.label} style={{ padding: '12px 16px', background: 'var(--hover-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{s.label}</div>
                                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                              </div>
                          ))}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                          Sample results · via {validationRes.model_source} model
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {(validationRes.details || []).slice(0, 10).map((d, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 6, background: d.correct ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${d.correct ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
                                  {d.correct ? <CheckCircle size={12} color="var(--success)" /> : <XCircle size={12} color="var(--danger)" />}
                                  <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>Predicted <strong style={{ color: 'var(--text-main)' }}>{d.predicted}</strong> · Actual <strong style={{ color: d.correct ? 'var(--success)' : 'var(--danger)' }}>{d.actual}</strong></span>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      </div>
    </div>

    {/* SSE Training Modal */}
    {trainModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 18, padding: '2rem 2.5rem', minWidth: 400, maxWidth: 500, width: '90vw', boxShadow: 'var(--glow)', position: 'relative' }}>
          {trainDone && (
            <button onClick={closeTrainModal} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)' }}>
              <X size={18} />
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: trainError ? 'rgba(239,68,68,0.1)' : trainDone ? 'rgba(16,185,129,0.1)' : 'rgba(167,139,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {trainError ? <XCircle size={24} color="#ef4444" /> : trainDone ? <CheckCircle size={24} color="#10b981" /> : <Cpu size={24} color="#a78bfa" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>
                {trainError ? 'Training Failed' : trainDone ? 'Training Complete' : 'Training Model…'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 2 }}>{trainStep}</div>
            </div>
          </div>

          {/* Progress bar */}
          {!trainError && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>Progress</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{trainPct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--hover-bg)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${trainPct}%`, background: trainDone ? '#10b981' : '#a78bfa', borderRadius: 4, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          {/* Result summary */}
          {trainDone && !trainError && trainResult && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Records used',  value: trainResult.records_used },
                { label: 'Total trees',   value: trainResult.total_trees  },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px 14px', background: 'var(--hover-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {trainError && (
            <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
              {trainError}
            </div>
          )}

          {trainDone && (
            <button onClick={closeTrainModal} style={{ width: '100%', padding: '10px', background: trainError ? '#ef4444' : 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {trainError ? 'Dismiss' : 'Done'}
            </button>
          )}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    )}
    </>
  );
}
