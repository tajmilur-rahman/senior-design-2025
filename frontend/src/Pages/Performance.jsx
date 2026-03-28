import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
    BrainCircuit, Target, Crosshair, Activity,
    TrendingUp, Database, Clock, ShieldCheck, Zap, History, Globe, AlertCircle, RefreshCw,
    Play, Upload, X, CheckCircle, Building2, Tag, Cpu, Trash2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis,
    Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

const classMetrics = [
    { subject: 'S1 Critical', precision: 95, recall: 98 },
    { subject: 'S2 High',     precision: 88, recall: 85 },
    { subject: 'S3 Normal',   precision: 92, recall: 94 },
    { subject: 'S4 Low',      precision: 85, recall: 82 },
];

const SEV_COLORS = { S1: '#ef4444', S2: '#f59e0b', S3: '#3b82f6', S4: '#64748b' };

// ── Reset model modal ───────────────────────────────────────────────────────────
// Company admin: one-click confirm that resets only their own artifacts.
// Super admin: list of scopes — Universal + every company — each with its own button.
function ResetModal({ isSuperAdmin, companies, onClose, onReset, resettingKey }) {
    const [confirmed, setConfirmed] = useState(null); // null | 'own' | 'global' | company_id

    const isResetting = (key) => resettingKey === key;
    const anyResetting = resettingKey !== null;

    if (!isSuperAdmin) {
        // Company admin — simple one-scope confirm
        return createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-[#0d0d14] border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
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
        { key: 'global', label: 'Universal Model', sub: 'Global artifacts in ml_training/', icon: <Globe size={14} className="text-blue-400" />, targetId: null },
        ...companies.map(co => ({
            key: String(co.id),
            label: co.name || `Company ${co.id}`,
            sub: co.has_own_model ? 'Has trained model' : 'No model trained',
            icon: <Building2 size={14} className={co.has_own_model ? 'text-emerald-400' : 'text-white/30'} />,
            targetId: co.id,
        })),
    ];

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0d0d14] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl">
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
                    <button onClick={onClose} disabled={anyResetting} className="text-white/30 hover:text-white transition-colors disabled:opacity-30"><X size={16} /></button>
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
                                    <div className="text-white/30 text-[10px]">{scope.sub}</div>
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
function TrainModal({ onClose, onDone, isSuperAdmin }) {
    const [phase, setPhase]       = useState('idle'); // idle | training | done | error
    const [step, setStep]         = useState('');
    const [pct, setPct]           = useState(0);
    const [result, setResult]     = useState(null);
    const [errMsg, setErrMsg]     = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadName, setUploadName] = useState('');
    const [uploading, setUploading]   = useState(false);
    const pollRef = useRef(null);

    const startTrain = async () => {
        setPhase('training'); setStep('Initializing…'); setPct(0);
        const token = localStorage.getItem('token');
        try {
            const res = await axios.post('/api/admin/model/train/start', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.data.success && res.data.message && !res.data.stream_url) {
                setErrMsg(res.data.message); setPhase('error'); return;
            }
            const key = res.data.stream_key || res.data.key || 'global';

            // Poll the status endpoint every second instead of an SSE connection.
            // SSE over nginx/Docker is unreliable -- polling is simple and bulletproof.
            let elapsed = 0;
            pollRef.current = setInterval(async () => {
                elapsed += 1;
                if (elapsed > 600) {
                    clearInterval(pollRef.current); pollRef.current = null;
                    setErrMsg('Training timed out after 10 minutes.'); setPhase('error');
                    return;
                }
                try {
                    const s = await axios.get(
                        `/api/admin/model/train/status?stream_key=${key}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const d = s.data;
                    setStep(d.step || ''); setPct(d.pct || 0);
                    if (d.done) {
                        clearInterval(pollRef.current); pollRef.current = null;
                        if (d.error) { setErrMsg(d.error); setPhase('error'); }
                        else { setResult(d); setPhase('done'); }
                    }
                } catch (_) {
                    // transient network hiccup -- keep polling
                }
            }, 1000);
        } catch (e) {
            setErrMsg(e.response?.data?.detail || e.message); setPhase('error');
        }
    };

    const handleBulkUpload = async () => {
        if (!uploadFile) return;
        setUploading(true);
        const token = localStorage.getItem('token');
        const form = new FormData();
        form.append('file', uploadFile);
        form.append('batch_name', uploadName || uploadFile.name);
        try {
            const res = await axios.post('/api/upload_and_train', form, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            setResult(res.data.retrain); setPhase('done');
        } catch (e) {
            setErrMsg(e.response?.data?.detail || 'Upload failed.'); setPhase('error');
        } finally { setUploading(false); }
    };

    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0d0d14] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"><X size={18} /></button>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <Cpu size={18} className="text-blue-400" />
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
                            <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/20 transition-colors">
                                <Play size={16} className="text-blue-400" />
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

                {phase === 'training' && (
                    <div className="flex flex-col items-center gap-6 py-4">
                        <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center relative">
                            <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-blue-500/20 to-transparent animate-pulse" />
                            <RefreshCw size={24} className="animate-spin text-blue-400 relative z-10" />
                        </div>
                        <div className="w-full">
                            <div className="flex justify-between text-xs text-white/50 mb-2">
                                <span className="font-medium">{step || 'Working…'}</span>
                                <span className="font-bold text-white">{pct}%</span>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                        <div className="text-white/30 text-xs text-center">Training in progress — this may take a minute</div>
                    </div>
                )}

                {phase === 'done' && (
                    <div className="flex flex-col items-center gap-4 py-4 text-center">
                        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <CheckCircle size={28} className="text-emerald-400" />
                        </div>
                        <div className="text-white font-bold text-lg">Model Trained!</div>
                        {result?.accuracy && (
                            <div className="text-white/60 text-sm">Accuracy: <strong className="text-emerald-400">{(result.accuracy * 100).toFixed(1)}%</strong></div>
                        )}
                        {result?.records_used && (
                            <div className="text-white/40 text-xs">{result.records_used.toLocaleString()} records used</div>
                        )}
                        <button onClick={() => { onDone(); onClose(); }} className="mt-2 px-8 py-2.5 bg-white text-black font-bold rounded-xl text-sm hover:bg-zinc-200 transition-all">
                            View Results
                        </button>
                    </div>
                )}

                {phase === 'error' && (
                    <div className="flex flex-col items-center gap-4 py-4 text-center">
                        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
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

export default function Performance({ user }) {
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
  const [resettingKey, setResettingKey]         = useState(null); // null | 'global' | company_id int
  const [companies, setCompanies]               = useState([]);

  const isSuperAdmin = user?.role === 'super_admin';

  // Fetch company list for super admin reset modal
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

  const fetchMetrics = async () => {
      setLoading(true); setError(null);
      try {
          const token = localStorage.getItem('token');
          const res = await axios.get('/api/hub/ml_metrics', {
              headers: { Authorization: `Bearer ${token}` }
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
      } finally { setLoading(false); }
  };

  useEffect(() => { fetchMetrics(); }, []);

  const baseMetrics = modelData.baseline || fallbackCurrent;
  const currMetrics = modelData.current  || fallbackCurrent;
  const prevMetrics = modelData.previous || fallbackCurrent;

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

  const MAX_MATRIX_VAL = Math.max(1, ...realConfusionMatrix.flatMap(row => [row.S1, row.S2, row.S3, row.S4]));

  const feedbackStats = modelData.feedback_stats || { total_corrections: 0, correction_rate: 0, weak_components: [] };

  const formatPct = (val) => `${(val * 100).toFixed(1)}%`;

  const getHeatmapColor = (val, max) => {
      const ratio = val / max;
      return `rgb(${Math.round(4 + 251*ratio)}, ${Math.round(43 + 212*ratio)}, ${Math.round(89 + 166*ratio)})`;
  };

  const getDelta = (key) => {
      if (viewVersion === 'enterprise' || viewVersion === 'previous') return null;
      const diff = (currMetrics[key] - prevMetrics[key]) * 100;
      if (diff === 0) return null;
      const sign = diff > 0 ? '+' : '';
      const cls = diff > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20';
      return <span className={`text-[10px] font-bold ml-3 px-2 py-0.5 rounded-md border ${cls}`}>{sign}{diff.toFixed(1)}%</span>;
  };

  const modelSourceBadge = () => {
      if (meta.model_source === 'company') return { label: `${meta.company_name} Model`, cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', icon: <Building2 size={11} /> };
      if (meta.model_source === 'global')  return { label: 'Global Model', cls: 'bg-blue-500/10 border-blue-500/20 text-blue-400', icon: <Globe size={11} /> };
      return { label: 'No Model Trained', cls: 'bg-white/5 border-white/10 text-white/40', icon: <AlertCircle size={11} /> };
  };
  const badge = modelSourceBadge();

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/20 to-transparent animate-pulse" />
        <RefreshCw size={24} className="animate-spin text-white/50 relative z-10" />
      </div>
      <div className="text-white font-bold text-xl tracking-tight">Evaluating Telemetry</div>
      <div className="text-white/40 text-sm">Loading model metrics...</div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-2">
        <AlertCircle size={24} className="text-red-500" />
      </div>
      <div className="text-white font-bold text-xl tracking-tight">Access Denied</div>
      <div className="text-white/50 text-sm max-w-xs text-center leading-relaxed">{error}</div>
    </div>
  );

  // ── No model trained empty state ─────────────────────────────────────────────
  if (meta.model_status === 'not_trained') return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      {showTrainModal && <TrainModal onClose={() => setShowTrainModal(false)} onDone={fetchMetrics} isSuperAdmin={user?.role === 'super_admin'} />}
      {showResetModal && <ResetModal isSuperAdmin={isSuperAdmin} companies={companies} onClose={() => setShowResetModal(false)} onReset={handleReset} resettingKey={resettingKey} />}
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent" />
          <BrainCircuit size={32} className="text-white/20 relative z-10" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">No Model Trained Yet</h2>
          <p className="text-white/40 text-sm max-w-sm leading-relaxed">
            Train a model on your company's bug data to unlock severity predictions, performance metrics, and the confusion matrix.
          </p>
        </div>
        <button onClick={() => setShowTrainModal(true)}
          className="flex items-center gap-3 px-8 py-3.5 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)]">
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
    <div className="w-full max-w-7xl mx-auto p-6 lg:px-8 lg:py-12 animate-in fade-in duration-700 font-sans relative z-10">
      {showTrainModal && <TrainModal onClose={() => setShowTrainModal(false)} onDone={fetchMetrics} isSuperAdmin={user?.role === 'super_admin'} />}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-400">
              <BrainCircuit size={12} className="text-blue-500" />
              <span className="text-[10px] font-bold tracking-widest uppercase">ML Evaluation</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Model <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Performance</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
            Live evaluation metrics and telemetry for the Random Forest classifier.
          </p>
        </div>

        <div className="relative z-10 flex flex-col items-start md:items-end gap-3">
          <div className="flex gap-1 bg-white/5 border border-white/10 p-1 rounded-2xl backdrop-blur-md">
            {[
              {
                id: 'enterprise', icon: <Globe size={13} />, label: 'Main brain',
                tip: 'Static baseline — trained on your full company bug database. Only updates when you run "Train on Company Data".',
                meta: baseMetrics,
              },
              {
                id: 'current', icon: <Zap size={13} />, label: 'Active build',
                tip: 'Your most recently trained model (bulk upload or feedback retrain).',
                meta: currMetrics,
              },
              {
                id: 'previous', icon: <History size={13} />, label: 'Previous',
                tip: 'The build that was active before the latest training run.',
                meta: prevMetrics,
              },
            ].map(v => (
              <div key={v.id} className="relative group/tab">
                <button onClick={() => setViewVersion(v.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    viewVersion === v.id ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:bg-white/[0.05] hover:text-white/80'
                  }`}>
                  {v.icon} {v.label}
                </button>
                {/* Hover tooltip */}
                <div className="absolute right-0 top-full mt-2 z-50 w-64 opacity-0 pointer-events-none group-hover/tab:opacity-100 transition-opacity duration-150">
                  <div className="bg-black/90 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-left">
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">{v.label}</div>
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
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${
            viewVersion === 'current' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            viewVersion === 'previous' ? 'bg-white/5 border-white/10 text-white/50' :
            'bg-blue-500/10 border-blue-500/20 text-blue-400'
          }`}>
            {viewVersion === 'current'
              ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
              : viewVersion === 'enterprise' ? <Globe size={9} /> : <History size={9} />}
            {metricsToUse.status}
          </div>
        </div>
        <div className="absolute -bottom-4 left-0 right-0 h-px bg-gradient-to-r from-blue-500/20 via-white/5 to-transparent" />
      </div>

      {/* Dataset source banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8 p-4 bg-white/[0.02] border border-white/10 rounded-2xl">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${badge.cls}`}>
            {badge.icon} {badge.label}
          </div>
          {meta.dataset_label && (
            <div className="flex items-center gap-1.5 text-white/40 text-xs">
              <Tag size={11} />
              <span>Trained on: <strong className="text-white/60">{meta.dataset_label}</strong></span>
            </div>
          )}
          {currMetrics.last_trained && currMetrics.last_trained !== '—' && (
            <div className="flex items-center gap-1.5 text-white/30 text-xs">
              <Clock size={11} />
              <span>{currMetrics.last_trained}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchMetrics} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-white/50 hover:text-white text-xs font-bold rounded-xl transition-all hover:bg-white/10">
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={() => setShowTrainModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 text-xs font-bold rounded-xl transition-all">
            <Play size={12} /> Retrain
          </button>
          <button onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-bold rounded-xl transition-all">
            <Trash2 size={12} /> Reset
          </button>
        </div>
      </div>

      {showResetModal && <ResetModal isSuperAdmin={isSuperAdmin} companies={companies} onClose={() => setShowResetModal(false)} onReset={handleReset} resettingKey={resettingKey} />}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 lg:gap-6 mb-8">
        {[
          { key: 'accuracy',   label: 'Accuracy',       icon: <Target size={14} />,      val: formatPct(metricsToUse.accuracy),  accent: 'text-blue-400' },
          { key: 'f1_score',   label: 'F1 Score',        icon: <Activity size={14} />,    val: formatPct(metricsToUse.f1_score),  accent: '#6366f1' },
          { key: 'precision',  label: 'Precision',       icon: <Crosshair size={14} />,   val: formatPct(metricsToUse.precision), accent: '#38bdf8' },
          { key: 'recall',     label: 'Recall',          icon: <TrendingUp size={14} />,  val: formatPct(metricsToUse.recall),    accent: 'text-emerald-400' },
          { key: 'correction', label: 'Correction Rate', icon: <AlertCircle size={14} />, val: `${(feedbackStats.correction_rate * 100).toFixed(1)}%`, accent: 'text-amber-500', sub: `${feedbackStats.total_corrections} engineer corrections` },
        ].map(s => (
          <div key={s.key} className="bg-white/[0.02] border border-white/10 rounded-3xl p-5 lg:p-6 backdrop-blur-md shadow-2xl relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <span className={s.accent.startsWith('text-') ? s.accent : `text-[${s.accent}]`}>{s.icon}</span>
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{s.label}</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl font-bold text-white font-mono tracking-tight">{s.val}</span>
              {s.key !== 'correction' && getDelta(s.key)}
            </div>
            {s.sub && <div className="text-[10px] text-white/40 mt-3 font-medium relative z-10">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Cross-build bar chart + Class Accuracy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        <div className="lg:col-span-7 bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
            <div className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Globe size={14} className="text-white/40" /> Cross-Build Performance
            </div>
            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-white/50">
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded bg-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.8)] inline-block" /> Main brain</span>
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded bg-white/20 inline-block" /> Previous</span>
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] inline-block" /> Active</span>
            </div>
          </div>
          <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={t => `${t}%`} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)', color: '#fff', fontSize: '13px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', padding: '10px 14px' }}
                itemStyle={{ color: '#fff', fontWeight: 700 }} formatter={v => [`${v.toFixed(1)}%`, '']} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="Enterprise" fill="#38bdf8" radius={[4,4,0,0]} barSize={14} opacity={0.85} />
              <Bar dataKey="Previous"   fill="rgba(255,255,255,0.1)" radius={[4,4,0,0]} barSize={14} />
              <Bar dataKey="Active"     fill="#3b82f6" radius={[4,4,0,0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="mb-8">
            <div className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-3">
              <Target size={14} className="text-white/40" /> Class Accuracy
            </div>
            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-white/50">
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] inline-block" /> Precision</span>
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] inline-block" /> Recall</span>
            </div>
          </div>
          <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={classMetrics} layout="vertical" margin={{ left: -10, right: 20, top: 0, bottom: 0 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} />
              <YAxis dataKey="subject" type="category" width={90} tick={{ fontSize: 11, fontWeight: 600, fill: 'rgba(255,255,255,0.6)' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)', color: '#fff', fontSize: '13px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', padding: '10px 14px' }}
                itemStyle={{ color: '#fff', fontWeight: 700 }} formatter={v => [`${v}%`, '']} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="precision" name="Precision" fill="#3b82f6" radius={[0,4,4,0]} barSize={10} />
              <Bar dataKey="recall"    name="Recall"    fill="#10b981" radius={[0,4,4,0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Confusion matrix + Training metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="flex justify-between items-center mb-8">
            <div className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Crosshair size={14} className="text-white/40" /> Confusion Matrix
            </div>
            <span className="text-[10px] font-bold bg-white/5 border border-white/10 text-white/50 px-2.5 py-1 rounded-md tracking-widest uppercase">
              {feedbackStats.total_corrections > 0 ? `${feedbackStats.total_corrections} real corrections` : 'Submit corrections to populate'}
            </span>
          </div>
          <div className="flex items-center mt-4">
            <div className="transform -rotate-90 text-[10px] font-bold text-white/30 uppercase tracking-widest w-6 whitespace-nowrap mr-6 text-center">Actual</div>
            <div className="flex-1">
              <div className="grid grid-cols-[36px_repeat(4,1fr)] gap-2 lg:gap-3">
                <div />
                {['S1','S2','S3','S4'].map(l => (
                  <div key={l} className="text-center text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: SEV_COLORS[l] }}>{l}</div>
                ))}
                {realConfusionMatrix.map(row => (
                  <React.Fragment key={row.actual}>
                    <div className="flex items-center justify-end pr-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: SEV_COLORS[row.actual] }}>{row.actual}</div>
                    {['S1','S2','S3','S4'].map(col => {
                      const val = row[col]; const ratio = val / MAX_MATRIX_VAL;
                      return (
                        <div key={col} className="aspect-square flex items-center justify-center text-sm font-bold rounded-xl transition-all hover:scale-105"
                          style={{ background: getHeatmapColor(val, MAX_MATRIX_VAL), color: ratio > 0.4 ? '#000' : '#fff', boxShadow: ratio > 0.6 ? '0 4px 15px rgba(37,99,235,0.4)' : 'none' }}>
                          {val.toLocaleString()}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div className="text-center text-[10px] font-bold text-white/30 uppercase tracking-widest mt-6 pl-9">Predicted</div>
            </div>
          </div>
        </div>

        {/* Training metadata */}
        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden flex flex-col justify-center">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-8">
            <Database size={14} className="text-white/40" /> Training Metadata
          </div>
          <div className="flex flex-col gap-4">
            {[
              { icon: <Database size={18} className="text-blue-400" />, label: 'Training Volume', value: `${metricsToUse.dataset_size?.toLocaleString() || 0} verified bug reports` },
              { icon: <Tag size={18} className="text-purple-400" />,    label: 'Dataset',         value: meta.dataset_label || '—' },
              { icon: <ShieldCheck size={18} className="text-emerald-400" />, label: 'Algorithm',  value: `Random Forest — ${metricsToUse.total_trees || 0} estimators` },
              { icon: <Clock size={18} className="text-white/40" />,   label: 'Last Trained',     value: metricsToUse.last_trained || '—' },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                <div className="w-10 h-10 bg-black/40 rounded-xl border border-white/10 flex items-center justify-center flex-shrink-0 shadow-inner">{icon}</div>
                <div>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">{label}</div>
                  <div className="text-sm font-bold text-white">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {feedbackStats.weak_components.length > 0 && (
        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 lg:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden mt-6">
          <div className="flex justify-between items-center mb-8">
            <div className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Target size={14} className="text-white/40" /> Model Weak Spots
            </div>
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{feedbackStats.total_corrections} engineer corrections</span>
          </div>
          <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={feedbackStats.weak_components} layout="vertical" margin={{ left: 10, right: 40, top: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="component" type="category" width={140} tick={{ fontSize: 12, fontWeight: 600, fill: 'rgba(255,255,255,0.6)' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)', color: '#fff', fontSize: '13px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', padding: '10px 14px' }}
                itemStyle={{ color: '#fff', fontWeight: 700 }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={val => [`${val} corrections`, '']} />
              <Bar dataKey="corrections" fill="#f59e0b" radius={[0,4,4,0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
          </div>
          <div className="text-xs text-white/40 mt-4 text-center">Components with the most engineer corrections — consider these retraining priority areas.</div>
        </div>
      )}
    </div>
  );
}
