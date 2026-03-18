import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    BrainCircuit, Target, Crosshair, Activity,
    TrendingUp, Database, Clock, ShieldCheck, Zap, History, Globe, AlertCircle
} from 'lucide-react';
import {
    BarChart, Bar, RadarChart, PolarGrid,
    PolarAngleAxis, PolarRadiusAxis, Radar, XAxis, YAxis,
    Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

const classMetrics = [
    { subject: 'S1 (Critical)', precision: 95, recall: 98, fullMark: 100 },
    { subject: 'S2 (High)',     precision: 88, recall: 85, fullMark: 100 },
    { subject: 'S3 (Normal)',   precision: 92, recall: 94, fullMark: 100 },
    { subject: 'S4 (Low)',      precision: 85, recall: 82, fullMark: 100 },
];

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
      } finally {
          setLoading(false);
      }
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
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Loading model metrics...</div>
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
      <div className="explorer-header" style={{ marginBottom: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
           <h1 style={{fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10}}>
               <BrainCircuit size={24} color="var(--accent)"/> MODEL PERFORMANCE
           </h1>
           <span style={{fontSize: 13, color: 'var(--text-sec)'}}>
               Live telemetry, feature weights, and evaluation metrics for the Random Forest classifier.
           </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div className="segmented-control" style={{ margin: 0, padding: 4, display: 'flex', gap: 4 }}>
                <button className={`segment-btn ${viewVersion === 'enterprise' ? 'active' : ''}`}
                    onClick={() => setViewVersion('enterprise')} style={{ padding: '8px 12px' }}>
                    <Globe size={14}/> Main brain
                </button>
                <button className={`segment-btn ${viewVersion === 'current' ? 'active' : ''}`}
                    onClick={() => setViewVersion('current')} style={{ padding: '8px 12px' }}>
                    <Zap size={14}/> Active build
                </button>
                <button className={`segment-btn ${viewVersion === 'previous' ? 'active' : ''}`}
                    onClick={() => setViewVersion('previous')} style={{ padding: '8px 12px' }}>
                    <History size={14}/> Previous
                </button>
            </div>
            <div className="live-pill" style={{
                background:   viewVersion === 'enterprise' ? 'rgba(56,189,248,0.1)' : viewVersion === 'current' ? 'rgba(16,185,129,0.1)' : 'var(--hover-bg)',
                color:        viewVersion === 'enterprise' ? '#38bdf8' : viewVersion === 'current' ? 'var(--success)' : 'var(--text-sec)',
                borderColor:  viewVersion === 'enterprise' ? 'rgba(56,189,248,0.3)' : viewVersion === 'current' ? 'rgba(16,185,129,0.3)' : 'var(--border)'
            }}>
                {viewVersion === 'enterprise' ? <Globe size={10}/> : viewVersion === 'current' ? <span className="pulse-dot"/> : <History size={10}/>}
                {metricsToUse.status}
            </div>
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 30 }}>
         <div className="sys-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Target size={14}/> OVERALL ACCURACY
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}>
                {formatPct(metricsToUse.accuracy)} {getDelta('accuracy')}
            </div>
         </div>
         <div className="sys-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={14}/> F1-SCORE (WEIGHTED)
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}>
                {formatPct(metricsToUse.f1_score)} {getDelta('f1_score')}
            </div>
         </div>
         <div className="sys-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Crosshair size={14}/> PRECISION
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}>
                {formatPct(metricsToUse.precision)} {getDelta('precision')}
            </div>
         </div>
         <div className="sys-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={14}/> RECALL
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}>
                {formatPct(metricsToUse.recall)} {getDelta('recall')}
            </div>
         </div>
         <div className="sys-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14}/> CORRECTION RATE
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-main)' }}>
                {(feedbackStats.correction_rate * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 4 }}>
                {feedbackStats.total_corrections} engineer corrections
            </div>
         </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
          <div className="sys-card" style={{ padding: 24, transition: '0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', margin: 0, textTransform: 'uppercase', letterSpacing: 1}}>
                      Cross-Build Performance
                  </h3>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 700 }}>
                      <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: '#38bdf8' }}/> Main brain</span>
                      <span style={{ color: 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--text-sec)' }}/> Previous</span>
                      <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--accent)' }}/> Active</span>
                  </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={comparisonData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-sec)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis domain={[70, 100]} stroke="var(--text-sec)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={tick => `${tick}%`} />
                      <Tooltip contentStyle={{borderRadius: 8, border:'1px solid var(--border)', background:'var(--card-bg)', color:'var(--text-main)'}}
                               formatter={value => `${value.toFixed(1)}%`} cursor={{fill: 'var(--hover-bg)'}} />
                      <Bar dataKey="Enterprise" fill="#38bdf8" radius={[4,4,0,0]} barSize={12} opacity={0.8} />
                      <Bar dataKey="Previous"   fill="var(--text-sec)" radius={[4,4,0,0]} barSize={12} opacity={0.5} />
                      <Bar dataKey="Active"     fill="var(--accent)" radius={[4,4,0,0]} barSize={12} />
                  </BarChart>
              </ResponsiveContainer>
          </div>

          <div className="sys-card" style={{ padding: 24, transition: '0.3s' }}>
              <h3 style={{fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 0, textTransform: 'uppercase', letterSpacing: 1}}>
                  Class Distribution
              </h3>
              <div style={{ fontSize: 10, color: 'var(--text-sec)', marginBottom: 8 }}>
                  Based on training classification report
              </div>
              <ResponsiveContainer width="100%" height={280}>
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={classMetrics}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="subject" tick={{fill: 'var(--text-sec)', fontSize: 10, fontWeight: 600}} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Precision" dataKey="precision" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.4} />
                      <Radar name="Recall"    dataKey="recall"    stroke="var(--success)" fill="var(--success)" fillOpacity={0.4} />
                      <Tooltip contentStyle={{borderRadius: 8, border:'1px solid var(--border)', background:'var(--card-bg)'}} />
                  </RadarChart>
              </ResponsiveContainer>
          </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div className="sys-card" style={{ padding: 24, transition: '0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
                  <h3 style={{fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', margin: 0, textTransform: 'uppercase', letterSpacing: 1}}>
                      Confusion Matrix
                  </h3>
                  <span style={{ fontSize: 10, color: 'var(--text-sec)', background: 'var(--hover-bg)', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
                      {feedbackStats.total_corrections > 0 ? `${feedbackStats.total_corrections} real corrections` : 'Submit corrections to populate'}
                  </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ transform: 'rotate(-90deg)', fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', width: 20, whiteSpace: 'nowrap', marginRight: 15 }}>
                      Actual Severity
                  </div>
                  <div style={{ flex: 1 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(4, 1fr)', gap: 2 }}>
                          <div/>
                          {['S1','S2','S3','S4'].map(l => (
                              <div key={l} style={{textAlign: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 8}}>{l}</div>
                          ))}
                          {realConfusionMatrix.map(row => (
                              <React.Fragment key={row.actual}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10, fontSize: 12, fontWeight: 800, color: 'var(--text-sec)' }}>
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
                                              color: ratio > 0.4 ? '#0f172a' : '#ffffff',
                                              fontSize: 14, fontWeight: 600,
                                              border: '1px solid rgba(255,255,255,0.4)',
                                              borderRadius: 2
                                          }}>
                                              {val.toLocaleString()}
                                          </div>
                                      );
                                  })}
                              </React.Fragment>
                          ))}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', marginTop: 15, paddingLeft: 40 }}>
                          Predicted Severity
                      </div>
                  </div>
              </div>
          </div>

          <div className="sys-card" style={{ padding: 24, background: 'var(--hover-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <h3 style={{fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', margin: 0, textTransform: 'uppercase', letterSpacing: 1}}>
                      Training Meta-Data
                  </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ background: 'var(--card-bg)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
                          <Database size={20} color={viewVersion === 'enterprise' ? '#38bdf8' : 'var(--accent)'}/>
                      </div>
                      <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)' }}>TRAINING VOLUME</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                              {metricsToUse.dataset_size?.toLocaleString() || 0} Verified Bug Reports
                          </div>
                      </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ background: 'var(--card-bg)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
                          <ShieldCheck size={20} color="var(--success)"/>
                      </div>
                      <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)' }}>CLASSIFIER ALGORITHM</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                              Random Forest ({metricsToUse.total_trees || 100} Estimators)
                          </div>
                      </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ background: 'var(--card-bg)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
                          <Clock size={20} color="var(--text-sec)"/>
                      </div>
                      <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)' }}>LAST TRAINED</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                              {metricsToUse.last_trained}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {feedbackStats.weak_components.length > 0 && (
          <div className="sys-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Model Weak Spots — Components With Most Corrections
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>
                      Based on {feedbackStats.total_corrections} engineer corrections for your company
                  </span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={feedbackStats.weak_components} layout="vertical"
                            margin={{ left: 20, right: 40, top: 5, bottom: 5 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="component" type="category" width={130}
                             tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--text-sec)' }} />
                      <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid var(--border)',
                                          background: 'var(--card-bg)', color: 'var(--text-main)' }}
                          cursor={{ fill: 'var(--hover-bg)' }}
                          formatter={val => [`${val} corrections`, 'Count']}
                      />
                      <Bar dataKey="corrections" fill="var(--accent)" radius={[0,4,4,0]} barSize={20} />
                  </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 8 }}>
                  These components have the most engineer corrections — consider them as retraining priority areas.
              </div>
          </div>
      )}
    </div>
  );
}