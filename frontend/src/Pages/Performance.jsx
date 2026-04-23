import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useEscapeKey } from '../Components/Modal';
import {
    BrainCircuit, Target, Crosshair, Activity,
    TrendingUp, Database, Clock, ShieldCheck, Zap, History, Globe, AlertCircle, RefreshCw,
    Play, Upload, X, CheckCircle, Building2, Tag, Cpu, Trash2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
    Tooltip, ResponsiveContainer
} from 'recharts';
import { ModelShowcase } from '../spatial-model-showcase';
import { LiquidButton as Button } from '../liquid-glass-button';
import { BentoCard } from '../bento-card';

// Two opposing hues — Indigo (baseline) vs Emerald (live). Clean SaaS aesthetic.
const BUILD_COLORS = {
    Enterprise: '#6366f1', // indigo — static baseline
    Active:     '#10b981', // emerald — live build
};

const SEV_COLORS = { S1: '#ef4444', S2: '#f59e0b', S3: '#3b82f6', S4: '#64748b' };

// ── Reset model modal ───────────────────────────────────────────────────────────
// Company admin: one-click confirm that resets only their own artifacts.
// Super admin: list of scopes — Universal + every company — each with its own button.
function ResetModal({ isSuperAdmin, companies, onClose, onReset, resettingKey }) {
    const [confirmed, setConfirmed] = useState(null); // null | 'own' | 'global' | company_id

    const isResetting = (key) => resettingKey === key;
    const anyResetting = resettingKey !== null;
    useEscapeKey(() => { if (!anyResetting) onClose?.(); }, true);

    if (!isSuperAdmin) {
        // Company admin — simple one-scope confirm
        return createPortal(
            <div role="dialog" aria-modal="true" aria-label="Reset your model" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                <div className="border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center" style={{ background: 'var(--card-bg)' }}>
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <Trash2 size={24} className="text-red-400" />
                    </div>
                    <div className="text-white font-bold text-lg mb-2">Reset Your Model?</div>
                    <p className="text-white/40 text-sm leading-relaxed mb-6">
                        Deletes your company's PKL artifacts and all build metrics. Returns to "No Model Trained". <strong className="text-white/60">Cannot be undone.</strong>
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={onClose} disabled={anyResetting}
                            className="px-6 py-2.5 bg-white/5 border border-white/10 text-white/60 font-bold rounded-xl text-sm hover:bg-white/10 transition-all disabled:opacity-50">
                            Cancel
                        </button>
                        <button onClick={() => onReset(undefined)} disabled={anyResetting}
                            className="flex items-center gap-2 px-6 py-2.5 bg-red-500/20 border border-red-500/30 text-red-400 font-bold rounded-xl text-sm hover:bg-red-500/30 transition-all disabled:opacity-50">
                            {isResetting('own') ? <><RefreshCw size={12} className="animate-spin" /> Resetting…</> : <><Trash2 size={12} /> Delete &amp; Reset</>}
                        </button>
                    </div>
                </div>
            </div>
        , document.body);
    }

    // Super admin — choose which scope to reset
    const scopes = [
        { key: 'global', label: 'Universal Model', sub: 'Global artifacts in ml_training/', icon: <Globe size={14} className="text-indigo-400" />, targetId: null },
        ...companies.map(co => ({
            key: String(co.id),
            label: co.name || `Company ${co.id}`,
            sub: co.has_own_model ? 'Has trained model' : 'No model trained',
            icon: <Building2 size={14} className={co.has_own_model ? 'text-emerald-400' : 'text-white/30'} />,
            targetId: co.id,
        })),
    ];

    return createPortal(
        <div role="dialog" aria-modal="true" aria-label="Reset model artifacts" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ background: 'var(--card-bg)' }}>
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <Trash2 size={16} className="text-red-400" />
                        </div>
                        <div>
                            <div className="text-white font-bold text-sm">Reset Model Artifacts</div>
                            <div className="text-white/30 text-xs">Select which scope to wipe</div>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={anyResetting} aria-label="Close dialog" className="text-white/30 hover:text-white transition-colors disabled:opacity-30"><X size={16} /></button>
                </div>

                <p className="text-white/40 text-xs leading-relaxed mb-4 px-1">
                    Each row resets independently — PKL files, all metrics JSONs, and model cache. <strong className="text-red-400/80">Cannot be undone.</strong>
                </p>

                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                    {scopes.map(scope => (
                        <div key={scope.key} className="flex items-center justify-between gap-3 p-3 bg-white/[0.03] border border-white/[0.07] rounded-2xl">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">{scope.icon}</div>
                                <div className="min-w-0">
                                    <div className="text-white text-sm font-semibold truncate">{scope.label}</div>
                                    <div className="text-white/30 text-[11px]">{scope.sub}</div>
                                </div>
                            </div>
                            {confirmed === scope.key ? (
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button onClick={() => setConfirmed(null)} disabled={anyResetting}
                                        className="px-3 py-1.5 bg-white/5 border border-white/10 text-white/50 text-xs font-bold rounded-lg hover:bg-white/10 transition-all disabled:opacity-40">
                                        No
                                    </button>
                                    <button onClick={() => { onReset(scope.targetId); setConfirmed(null); }} disabled={anyResetting}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-40">
                                        {isResetting(scope.key) ? <RefreshCw size={10} className="animate-spin" /> : <Trash2 size={10} />} Yes, reset
                                    </button>
                                </div>
                            ) : (
                                <button onClick={() => setConfirmed(scope.key)} disabled={anyResetting}
                                    className="flex-shrink-0 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-bold rounded-lg transition-all disabled:opacity-40">
                                    Reset
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    , document.body);
}


// ── Training modal with SSE progress ───────────────────────────────────────────
function TrainModal({ onClose, onDone, isSuperAdmin, onTrainStart }) {
    const [phase, setPhase]       = useState('idle'); // idle | background | uploading | done | error
    const [errMsg, setErrMsg]     = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadName, setUploadName] = useState('');
    const [uploading, setUploading]   = useState(false);
    useEscapeKey(() => { if (!uploading) onClose?.(); }, true);

    const startTrain = async () => {
        setPhase('background');
        try {
            const res = await axios.post('/api/admin/model/train/start');
            if (!res.data.success && res.data.message && !res.data.stream_url) {
                setErrMsg(res.data.message); setPhase('error'); return;
            }
            const key = res.data.stream_key || res.data.key || 'global';
            // Hand off to the global Dashboard banner — close this modal
            if (onTrainStart) onTrainStart(key);
            onClose();
        } catch (e) {
            setErrMsg(e.response?.data?.detail || e.message); setPhase('error');
        }
    };

    const handleBulkUpload = async () => {
        if (!uploadFile) return;
        setUploading(true);
        const form = new FormData();
        form.append('file', uploadFile);
        form.append('batch_name', uploadName || uploadFile.name);
        try {
            const res = await axios.post('/api/upload_and_train', form, { headers: { 'Content-Type': 'multipart/form-data' } });
            const key = res.data?.key;
            if (key && onTrainStart) onTrainStart(key);
            onDone();
            onClose();
        } catch (e) {
            setErrMsg(e.response?.data?.detail || 'Upload failed.'); setPhase('error');
        } finally { setUploading(false); }
    };

    return createPortal(
        <div role="dialog" aria-modal="true" aria-label="Train model" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl relative" style={{ background: 'var(--card-bg)' }}>
                <button onClick={onClose} aria-label="Close dialog" className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"><X size={18} /></button>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <Cpu size={18} className="text-indigo-400" />
                    </div>
                    <div>
                        <div className="text-white font-bold text-sm">
                            {isSuperAdmin ? 'Train Universal Model' : 'Train Company Model'}
                        </div>
                        <div className="text-white/40 text-xs">
                            {isSuperAdmin ? 'Aggregates all company tables + Firefox baseline' : "Uses your company's bug data"}
                        </div>
                    </div>
                </div>

                {phase === 'idle' && (
                    <div className="flex flex-col gap-4">
                        {/* Option A: Train on existing data */}
                        <button onClick={startTrain}
                            className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-left group">
                            <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                                <Play size={16} className="text-indigo-400" />
                            </div>
                            <div>
                                <div className="text-white font-bold text-sm">
                                {isSuperAdmin ? 'Train on Universal Data' : 'Train on Company Data'}
                            </div>
                            <div className="text-white/40 text-xs mt-0.5">
                                {isSuperAdmin
                                    ? 'Aggregates every company table + Firefox baseline data'
                                    : 'Uses bugs & feedback corrections already in your database'}
                            </div>
                            </div>
                        </button>

                        {/* Option B: Bulk upload + retrain */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Upload size={16} className="text-emerald-400" />
                                </div>
                                <div>
                                    <div className="text-white font-bold text-sm">Bulk Upload &amp; Retrain</div>
                                    <div className="text-white/40 text-xs mt-0.5">Upload CSV/JSON — columns: summary, component, severity, status</div>
                                </div>
                            </div>
                            <input type="text" placeholder="Batch name (optional)"
                                value={uploadName} onChange={e => setUploadName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs mb-2 focus:outline-none focus:border-white/20 placeholder:text-white/30" />
                            <label className="block w-full cursor-pointer">
                                <div className={`w-full py-2.5 px-4 rounded-xl border text-xs font-bold text-center transition-all ${uploadFile ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}>
                                    {uploadFile ? uploadFile.name : 'Choose CSV or JSON file'}
                                </div>
                                <input type="file" accept=".csv,.json" className="hidden" onChange={e => setUploadFile(e.target.files[0])} />
                            </label>
                            {uploadFile && (
                                <button onClick={handleBulkUpload} disabled={uploading}
                                    className="mt-2 w-full py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                    {uploading ? <><RefreshCw size={12} className="animate-spin" /> Uploading…</> : <><Upload size={12} /> Upload &amp; Train</>}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {phase === 'background' && (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                            <BrainCircuit size={22} className="text-indigo-400 animate-pulse" />
                        </div>
                        <div className="text-white font-bold">Training started</div>
                        <div className="text-white/40 text-xs max-w-xs leading-relaxed">
                            Running in the background — watch the status bar at the bottom of the screen. You can freely navigate between tabs.
                        </div>
                        <button onClick={onClose} className="mt-2 px-6 py-2 bg-white/5 border border-white/10 text-white/60 font-bold rounded-xl text-sm hover:bg-white/10 transition-all">
                            Got it
                        </button>
                    </div>
                )}

                {phase === 'error' && (
                    <div className="flex flex-col items-center gap-4 py-4 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <AlertCircle size={28} className="text-red-400" />
                        </div>
                        <div className="text-white font-bold">Training Failed</div>
                        <div className="text-white/50 text-xs max-w-xs leading-relaxed">{errMsg}</div>
                        <div className="flex gap-2">
                            <button onClick={() => { setPhase('idle'); setErrMsg(''); }} className="px-6 py-2.5 bg-white/5 border border-white/10 text-white/60 font-bold rounded-xl text-sm hover:bg-white/10 transition-all">
                                Try Again
                            </button>
                            <button onClick={onClose} className="px-6 py-2.5 bg-white/5 border border-white/10 text-white/60 font-bold rounded-xl text-sm hover:bg-white/10 transition-all">
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    , document.body);
}

export default function Performance({ user, onTrainStart }) {
  const [modelData, setModelData] = useState({
      baseline: null, current: null, previous: null,
      confusion_matrix: null, feedback_stats: null,
  });
  const [meta, setMeta]               = useState({ model_source: 'none', model_status: 'not_trained', dataset_label: '', company_name: '' });
  const [viewVersion, setViewVersion] = useState('enterprise');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [showTrainModal, setShowTrainModal]     = useState(false);
  const [showResetModal, setShowResetModal]     = useState(false);
  const [resettingKey, setResettingKey]         = useState(null);
  const [refreshing, setRefreshing]             = useState(false);
  const [companies, setCompanies]               = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(''); // '' = universal (super admin only)

  const isSuperAdmin = user?.role === 'super_admin';

  // Fetch company list for super admin — used for both reset modal and company selector
  useEffect(() => {
    if (!isSuperAdmin) return;
    const token = localStorage.getItem('token');
    axios.get('/api/superadmin/companies', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setCompanies(r.data || []))
      .catch(() => {});
  }, [isSuperAdmin]);

  const handleReset = async (targetCompanyId) => {
    // targetCompanyId: undefined = own company (company admin), null = global (super admin), int = specific company (super admin)
    const key = targetCompanyId === null ? 'global' : (targetCompanyId ?? 'own');
    setResettingKey(key);
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (isSuperAdmin && targetCompanyId !== undefined) {
        // Pass null → no param (resets global), or int → pass as query param
        if (targetCompanyId !== null) params.target_company_id = targetCompanyId;
      }
      await axios.delete('/api/admin/model/reset', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      if (!isSuperAdmin) setShowResetModal(false);
      await fetchMetrics();
    } catch (e) {
      console.error('Reset failed:', e.response?.data || e.message);
    } finally {
      setResettingKey(null);
    }
  };

  const fallbackCurrent = {
      accuracy: 0.0, f1_score: 0.0, precision: 0.0, recall: 0.0,
      dataset_size: null, status: 'Not Trained', last_trained: '—', total_trees: 0
  };

  const fetchMetrics = async (overrideCompanyId) => {
      setLoading(true); setError(null);
      if (!refreshing) setRefreshing(true);
      try {
          const token = localStorage.getItem('token');
          const params = {};
          const cid = overrideCompanyId !== undefined ? overrideCompanyId : selectedCompanyId;
          if (isSuperAdmin && cid !== '') params.target_company_id = Number(cid);
          const res = await axios.get('/api/hub/ml_metrics', {
              headers: { Authorization: `Bearer ${token}` },
              params,
          });
          const { current, baseline, previous, confusion_matrix, feedback_stats,
                  model_source, model_status, dataset_label, company_name } = res.data;
          setMeta({ model_source: model_source || 'none', model_status: model_status || 'not_trained',
                    dataset_label: dataset_label || '', company_name: company_name || '' });
          if (current) {
              setModelData({
                  baseline:         baseline || current,
                  current:          current,
                  previous:         previous || current,
                  confusion_matrix: confusion_matrix || null,
                  feedback_stats:   feedback_stats || null,
              });
          } else {
              setModelData({ baseline: fallbackCurrent, current: fallbackCurrent, previous: fallbackCurrent, confusion_matrix: null, feedback_stats: null });
          }
      } catch (e) {
          if (e.response?.status === 403) setError('Admin access required to view model performance.');
          else setModelData({ baseline: fallbackCurrent, current: fallbackCurrent, previous: fallbackCurrent, confusion_matrix: null, feedback_stats: null });
      } finally {
          setLoading(false);
          setTimeout(() => setRefreshing(false), 500);
      }
  };

  useEffect(() => { fetchMetrics(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const baseMetrics = modelData.baseline || fallbackCurrent;
  const currMetrics = modelData.current  || fallbackCurrent;
  const prevMetrics = modelData.previous || fallbackCurrent;

  let metricsToUse;
  if (viewVersion === 'enterprise')   metricsToUse = baseMetrics;
  else if (viewVersion === 'current') metricsToUse = currMetrics;
  else                                metricsToUse = prevMetrics;

  // Robust validation to prevent React crashes from malformed legacy JSON structures
  let realConfusionMatrix = modelData.confusion_matrix;
  const isValidMatrix = Array.isArray(realConfusionMatrix) && 
                        realConfusionMatrix.length === 4 &&
                        realConfusionMatrix.every(r => r && typeof r === 'object' && typeof r.actual === 'string');

  if (!isValidMatrix) {
      realConfusionMatrix = [
          { actual: 'S1', S1: 0, S2: 0, S3: 0, S4: 0 },
          { actual: 'S2', S1: 0, S2: 0, S3: 0, S4: 0 },
          { actual: 'S3', S1: 0, S2: 0, S3: 0, S4: 0 },
          { actual: 'S4', S1: 0, S2: 0, S3: 0, S4: 0 },
      ];
  }

  // Dynamically calculate per-class Precision and Recall from the live Confusion Matrix
  const classMetrics = ['S1', 'S2', 'S3', 'S4'].map(cls => {
      const tpRow = realConfusionMatrix.find(r => r.actual === cls);
      const tp = tpRow ? (tpRow[cls] || 0) : 0;
      const actualTotal = tpRow ? ((tpRow.S1 || 0) + (tpRow.S2 || 0) + (tpRow.S3 || 0) + (tpRow.S4 || 0)) : 0;
      const predictedTotal = realConfusionMatrix.reduce((sum, r) => sum + (r[cls] || 0), 0);

      return {
          subject: cls,
          precision: predictedTotal > 0 ? Math.round((tp / predictedTotal) * 100) : 0,
          recall: actualTotal > 0 ? Math.round((tp / actualTotal) * 100) : 0,
      };
  });

  const MAX_MATRIX_VAL = Math.max(1, ...realConfusionMatrix.flatMap(row => [row.S1 || 0, row.S2 || 0, row.S3 || 0, row.S4 || 0]));

  const feedbackStats = modelData.feedback_stats || { total_corrections: 0, correction_rate: 0, weak_components: [] };

  const chartTooltipStyle = {
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    backdropFilter: 'blur(12px)',
    color: 'var(--text-main)',
    fontSize: '13px',
    boxShadow: 'var(--shadow-md)',
    padding: '10px 14px',
  };
  const chartItemStyle  = { color: 'var(--text-main)', fontWeight: 700 };
  const chartCursorFill = 'var(--hover-bg)';
  const axisTickDim     = 'var(--text-dim)';
  const axisTickBright  = 'var(--text-sec)';
  const gridStroke      = 'var(--border)';

  const formatPct = (val) => `${((Number(val) || 0) * 100).toFixed(1)}%`;

  const getHeatmapColor = (val, max) => {
      const ratio = val / max;
      return `rgb(${Math.round(4 + 251*ratio)}, ${Math.round(43 + 212*ratio)}, ${Math.round(89 + 166*ratio)})`;
  };

  const getDelta = (key) => {
      if (viewVersion === 'enterprise' || viewVersion === 'previous') return null;
      if (currMetrics[key] === undefined || prevMetrics[key] === undefined) return null;

      // Handle raw numerical diffs for dataset sizes instead of percentage shifts
      if (key === 'dataset_size') {
          const diff = currMetrics[key] - prevMetrics[key];
          if (diff === 0) return null;
          const sign = diff > 0 ? '+' : '';
          const cls = diff > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20';
          return <span className={`text-[11px] font-bold ml-3 px-2 py-0.5 rounded-md border ${cls}`}>{sign}{diff.toLocaleString()}</span>;
      }

      const diff = (currMetrics[key] - prevMetrics[key]) * 100;
      if (diff === 0) return null;
      const sign = diff > 0 ? '+' : '';
      const cls = diff > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20';
      return <span className={`text-[11px] font-bold ml-3 px-2 py-0.5 rounded-md border ${cls}`}>{sign}{diff.toFixed(1)}%</span>;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent animate-pulse" />
        <RefreshCw size={24} className="animate-spin text-white/50 relative z-10" />
      </div>
      <div className="text-white font-bold text-xl tracking-tight">Evaluating Telemetry</div>
      <div className="text-white/40 text-sm">Loading model metrics...</div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-2">
        <AlertCircle size={24} className="text-red-500" />
      </div>
      <div className="text-white font-bold text-xl tracking-tight">Access Denied</div>
      <div className="text-white/50 text-sm max-w-xs text-center leading-relaxed">{error}</div>
    </div>
  );

  // ── Global model banner (shown when company hasn't trained yet) ──────────────
  const GlobalModelBanner = () => (
    <div className="mb-8 p-6 lg:p-8 rounded-2xl border-2 border-indigo-500/30 bg-indigo-500/5 backdrop-blur-md relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none" />
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative z-10">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
          <Globe size={24} className="text-indigo-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-white">Global Model (Shared)</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 uppercase tracking-widest">Active</span>
          </div>
          <p className="text-sm text-white/60 leading-relaxed max-w-2xl">
            Your company is currently using the <strong className="text-white">universal Random Forest model</strong> trained on 220,000+ real-world bugs.
            Submit feedback corrections or bulk-upload your own data on the Performance tab to train an isolated company model — improving predictions for your specific bug patterns.
          </p>
        </div>
        <button onClick={() => setShowTrainModal(true)}
          className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-indigo-500/20 hover:bg-blue-500/30 border border-indigo-500/30 text-blue-300 font-bold rounded-2xl transition-all text-sm whitespace-nowrap">
          <Play size={15} /> Train Company Model
        </button>
      </div>
    </div>
  );

  // ── No model trained empty state ─────────────────────────────────────────────
  if (meta.model_status === 'not_trained') return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      {showTrainModal && <TrainModal onClose={() => setShowTrainModal(false)} onDone={fetchMetrics} isSuperAdmin={user?.role === 'super_admin'} onTrainStart={onTrainStart} />}
      {showResetModal && <ResetModal isSuperAdmin={isSuperAdmin} companies={companies} onClose={() => setShowResetModal(false)} onReset={handleReset} resettingKey={resettingKey} />}
      {!isSuperAdmin && <GlobalModelBanner />}
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent" />
          <BrainCircuit size={32} className="text-white/20 relative z-10" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">{isSuperAdmin ? 'No Universal Model Trained Yet' : 'No Company Model Trained Yet'}</h2>
          <p className="text-white/40 text-sm max-w-sm leading-relaxed">
            {isSuperAdmin 
              ? 'Train the universal baseline model on the aggregated dataset to unlock global severity predictions and analytics.' 
              : "Train a model on your company's bug data to unlock isolated severity predictions, performance metrics, and the confusion matrix."}
          </p>
        </div>
        <button onClick={() => setShowTrainModal(true)}
          className="flex items-center gap-3 px-8 py-3.5 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all ">
          <Play size={18} /> Train Your Model
        </button>
        <p className="text-white/20 text-xs">You can also bulk upload a CSV to train on your data</p>
        <button onClick={() => setShowResetModal(true)} className="flex items-center gap-1.5 text-white/20 hover:text-red-400 text-xs transition-colors mt-2">
          <Trash2 size={11} /> Reset model artifacts
        </button>
      </div>
    </div>
  );

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-10 animate-in fade-in duration-700 font-sans" style={{ background: 'var(--bg)' }}>
      {showTrainModal && <TrainModal onClose={() => setShowTrainModal(false)} onDone={fetchMetrics} isSuperAdmin={isSuperAdmin} onTrainStart={onTrainStart} />}
      {showResetModal && <ResetModal isSuperAdmin={isSuperAdmin} companies={companies} onClose={() => setShowResetModal(false)} onReset={handleReset} resettingKey={resettingKey} />}

      {/* Global model banner — shown when company hasn't yet trained their own model */}
      {!isSuperAdmin && meta.model_source === 'global' && <GlobalModelBanner />}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight leading-tight" style={{ color: 'var(--text-main)' }}>
            Model performance
          </h1>
          <p className="text-sm mt-1.5 max-w-xl" style={{ color: 'var(--text-sec)' }}>
            Evaluation metrics for the active severity classification model.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowResetModal(true)}
            className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-red-400 border border-red-500/20 hover:bg-red-500/5 transition-colors flex items-center gap-2"
          >
            <Trash2 size={15} />
            Reset Model
          </button>
          <Button
            onClick={() => setShowTrainModal(true)}
            className="px-5 py-2.5 font-bold text-xs uppercase tracking-widest text-black"
            style={{ background: 'var(--accent)' }}
          >
            <BrainCircuit size={15} />
            Train Model
          </Button>
        </div>
      </div>

      <ModelShowcase liveDataProp={modelData} isSuperAdmin={isSuperAdmin} />

      {/* Super admin: company selector to act on behalf of a tenant */}
      {isSuperAdmin && (
        <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl border border-white/10" style={{ background: 'var(--card-bg)' }}>
          <Building2 size={15} className="text-amber-400 flex-shrink-0" />
          <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest whitespace-nowrap">Viewing model for</span>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setSelectedCompanyId(''); fetchMetrics(''); }}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${selectedCompanyId === '' ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}
            >
              <Globe size={11} className="inline mr-1.5" />Universal
            </button>
            {companies.map(co => (
              <button
                key={co.id}
                onClick={() => { setSelectedCompanyId(String(co.id)); fetchMetrics(String(co.id)); }}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${String(selectedCompanyId) === String(co.id) ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}
              >
                {co.name}
                {co.has_own_model && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
              </button>
            ))}
          </div>
          {meta.company_name && (
            <span className="ml-auto text-[11px] font-bold text-white/30 whitespace-nowrap">{meta.company_name}</span>
          )}
        </div>
      )}

      {/* Version Selector */}
      <div className="flex items-center gap-2 p-1 w-max rounded-full border border-white/10 mb-8" style={{ background: 'var(--bg-elevated)' }}>
        {[
          {
            id: 'enterprise',
            label: isSuperAdmin ? 'Universal Baseline' : 'Enterprise Build',
            tip: isSuperAdmin
              ? 'Static baseline — trained on the full universal dataset (all companies + Firefox). Only updates when you run "Train on Universal Data".'
              : 'Static baseline — trained on your full company bug database. Only updates when you run "Train on Company Data".',
            meta: baseMetrics,
          },
          {
            id: 'current',
            label: isSuperAdmin ? 'Active Universal Build' : 'Active Build',
            tip: isSuperAdmin ? 'Your most recently trained universal model.' : 'Your most recently trained model (bulk upload or feedback retrain).',
            meta: currMetrics,
          },
        ].map(v => (
          <div key={v.id} className="relative group/tab">
            <button
              onClick={() => setViewVersion(v.id)}
              className={`px-5 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 ${
                viewVersion === v.id
                  ? 'text-[var(--accent)] shadow-sm border border-white/10'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
              style={viewVersion === v.id ? { background: 'var(--card-bg)' } : {}}
            >
              {viewVersion === v.id && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              )}
              {v.label}
            </button>
            {/* Hover tooltip */}
            <div className="absolute left-0 top-full mt-2 z-50 w-64 opacity-0 pointer-events-none group-hover/tab:opacity-100 transition-opacity duration-150">
              <div className="border border-white/10 rounded-2xl p-4 shadow-2xl text-left" style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)' }}>
                <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2">{v.label}</div>
                <p className="text-xs text-white/70 leading-relaxed mb-3">{v.tip}</p>
                {v.meta?.dataset_label && v.meta.dataset_label !== '—' && (
                  <div className="flex items-start gap-2 text-xs text-white/50 mb-1">
                    <Tag size={10} className="mt-0.5 flex-shrink-0 text-purple-400" />
                    <span><span className="text-white/30">Dataset:</span> <strong className="text-white/70">{v.meta.dataset_label}</strong></span>
                  </div>
                )}
                {v.meta?.last_trained && v.meta.last_trained !== '—' && (
                  <div className="flex items-start gap-2 text-xs text-white/50">
                    <Clock size={10} className="mt-0.5 flex-shrink-0" />
                    <span>{v.meta.last_trained}</span>
                  </div>
                )}
                {(!v.meta?.dataset_label || v.meta.dataset_label === '—') && (
                  <div className="text-xs text-white/30 italic">No data yet for this build</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { key: 'accuracy',  label: 'Accuracy',  icon: <Target size={14} />,     val: formatPct(metricsToUse.accuracy),  accentBar: 'var(--accent)', tip: 'Overall correctness of the model across all records.' },
          { key: 'f1_score',  label: 'F1 Score',  icon: <Activity size={14} />,   val: formatPct(metricsToUse.f1_score),  accentBar: '#51df9c', tip: 'Harmonic mean of precision and recall.' },
          { key: 'precision', label: 'Precision', icon: <Crosshair size={14} />,  val: formatPct(metricsToUse.precision), accentBar: 'var(--accent)', tip: 'Measures the exactness of severity predictions.' },
          { key: 'recall',    label: 'Recall',    icon: <TrendingUp size={14} />, val: formatPct(metricsToUse.recall),    accentBar: '#f59e0b', tip: "Measures the model's ability to capture all relevant cases." },
        ].map(s => (
          <BentoCard
            key={s.key}
            className="hover:brightness-105 group/stat relative !overflow-visible"
            style={{ background: 'var(--card-bg)' }}
          >
            {/* Left accent bar */}
            <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ background: s.accentBar }} />

            {/* Hover Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-52 p-3 backdrop-blur-xl border rounded-xl text-xs text-left opacity-0 scale-95 group-hover/stat:opacity-100 group-hover/stat:scale-100 group-hover/stat:-translate-y-1 transition-all duration-200 pointer-events-none z-50 shadow-2xl" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
              <div className="font-bold uppercase tracking-widest mb-1 text-[10px]" style={{ color: 'var(--text-dim)' }}>{s.label} Explained</div>
              <div className="leading-relaxed font-medium whitespace-normal" style={{ color: 'var(--text-main)' }}>{s.tip}</div>
            </div>

            <div className="relative z-10 p-4 lg:p-5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/50 truncate pr-2">
                  {s.label}
                </h3>
                {getDelta(s.key)}
              </div>
              <div className={`font-bold tracking-tighter mt-1 text-white truncate ${typeof s.val === 'string' && s.val.length > 5 && !s.val.includes('%') ? 'text-2xl pt-2' : 'text-4xl'}`} title={s.val}>
                {s.val}
              </div>
            </div>
          </BentoCard>
        ))}
      </div>

      {/* Two-column Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Left: Precision / Recall by Class */}
        <BentoCard
          className="p-6 flex flex-col"
          style={{ background: 'var(--card-bg)' }}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold tracking-wide text-white">
              Precision / Recall by Class
            </h2>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: BUILD_COLORS.Enterprise }} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Precision</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: BUILD_COLORS.Active }} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Recall</span>
              </div>
            </div>
          </div>
          <div className="h-[220px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classMetrics} margin={{ top: 24, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis 
                  dataKey="subject" 
                  tick={{ fontSize: 12, fill: axisTickBright, fontWeight: 600 }} 
                  axisLine={false} tickLine={false} dy={10} 
                />
                <YAxis 
                  type="number" domain={[0, 100]} 
                  tick={{ fontSize: 11, fill: axisTickDim }} 
                  tickFormatter={v => `${v}%`} 
                  axisLine={false} tickLine={false} 
                />
                <Tooltip contentStyle={chartTooltipStyle} itemStyle={chartItemStyle} formatter={v => [`${v}%`, '']} cursor={{ fill: chartCursorFill }} />
                <Bar dataKey="precision" name="Precision" fill={BUILD_COLORS.Enterprise} radius={[4, 4, 0, 0]} maxBarSize={48}>
                  <LabelList dataKey="precision" position="top" formatter={v => `${v}%`} fill={axisTickBright} fontSize={11} fontWeight={600} />
                </Bar>
                <Bar dataKey="recall" name="Recall" fill={BUILD_COLORS.Active} radius={[4, 4, 0, 0]} maxBarSize={48}>
                  <LabelList dataKey="recall" position="top" formatter={v => `${v}%`} fill={axisTickBright} fontSize={11} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </BentoCard>

        {/* Right: Confusion Matrix */}
        <BentoCard
          className="p-6 flex flex-col"
          style={{ background: 'var(--card-bg)' }}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold tracking-wide text-white">
              Confusion Matrix
            </h2>
            <span className="text-[11px] font-bold border border-white/10 text-white/50 px-2.5 py-1 rounded-md tracking-widest uppercase" style={{ background: 'var(--bg-elevated)' }}>
              {modelData.confusion_matrix
                ? `${MAX_MATRIX_VAL.toLocaleString()} peak cell — training data`
                : feedbackStats.total_corrections > 0
                  ? `${feedbackStats.total_corrections} real corrections`
                  : 'Train model to populate'}
            </span>
          </div>
          <div className="flex items-center flex-1">
            <div className="transform -rotate-90 text-[11px] font-bold text-white/30 uppercase tracking-widest w-6 whitespace-nowrap mr-6 text-center">Actual</div>
            <div className="flex-1 group/matrix">
              <div className="grid grid-cols-[36px_repeat(4,1fr)] gap-2 lg:gap-3">
                <div />
                {['S1','S2','S3','S4'].map(l => (
                  <div key={l} className="text-center text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: SEV_COLORS[l] }}>{l}</div>
                ))}
                {realConfusionMatrix.map(row => (
                  <React.Fragment key={row.actual}>
                    <div className="flex items-center justify-end pr-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: SEV_COLORS[row.actual] }}>{row.actual}</div>
                    {['S1','S2','S3','S4'].map(col => {
                      const val = row[col] || 0; const ratio = val / MAX_MATRIX_VAL;
                      const isDiagonal = row.actual === col;
                      return (
                        <div key={col} className={`aspect-square flex items-center justify-center text-sm font-bold rounded-xl transition-all duration-200 group-hover/matrix:opacity-60 hover:!opacity-100 hover:scale-105 ${isDiagonal ? 'ring-2 ring-white/30' : ''}`}
                          style={{ background: getHeatmapColor(val, MAX_MATRIX_VAL), color: ratio > 0.4 ? '#000' : '#fff', boxShadow: ratio > 0.6 ? '0 4px 15px rgba(37,99,235,0.4)' : 'none' }}>
                          {Number(val).toLocaleString()}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div className="text-center text-[11px] font-bold text-white/30 uppercase tracking-widest mt-6 pl-9">Predicted</div>
            </div>
          </div>
        </BentoCard>
      </div>

    </div>
  );
}
