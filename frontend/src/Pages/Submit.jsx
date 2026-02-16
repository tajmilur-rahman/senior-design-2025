import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  UploadCloud, RotateCcw, AlertCircle, FileText, PenTool,
  Cpu, Activity, Layers, BarChart3, Database, CheckCircle
} from 'lucide-react';

export default function SubmitTab({ user }) {
  const [mode, setMode] = useState('bulk');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [batches, setBatches] = useState([]);

  const [isTraining, setIsTraining] = useState(false);
  const [trainStats, setTrainStats] = useState(null);

  // Form State
  const [sSummary, setSSummary] = useState("");
  const [sComp, setSComp] = useState("Frontend");
  const [sSev, setSSev] = useState("S3");

  useEffect(() => { fetchBatches(); }, []);

  const fetchBatches = async () => {
      try {
          const res = await axios.get(`http://127.0.0.1:8000/api/batches?company_id=${user.company_id}`);
          const formatted = res.data.map(b => ({
              id: b.batch_id,
              filename: b.filename,
              count: b.record_count,
              time: b.upload_time,
              accuracy: b.accuracy || 0
          }));
          setBatches(formatted);
      } catch (err) { console.error("Error fetching batches", err); }
  };

  const handleBulkUpload = async () => {
    if(!file) return;
    setIsTraining(true);
    setMsg({ text: "Integrating data & retraining model...", type: "loading" });

    const fd = new FormData();
    fd.append("file", file);
    fd.append("company_id", user.company_id);

    try {
      const r = await axios.post('http://127.0.0.1:8000/api/upload_and_train', fd);

      const stats = r.data.training.metrics;
      setTrainStats({ accuracy: stats.accuracy, added: r.data.added });
      setMsg({ text: "Training Complete", type: "success" });

      setFile(null);
      fetchBatches();

    } catch (err) {
        setMsg({ text: "Failed: " + (err.response?.data?.detail || err.message), type: "error" });
    } finally {
        setIsTraining(false);
    }
  };

  const handleUndoBatch = async (batchId) => {
      if(!window.confirm(`Undo this training batch? This will remove the records and the model knowledge associated with them.`)) return;
      try {
          await axios.post('http://127.0.0.1:8000/api/undo_batch', { batch_id: batchId });
          setMsg({ text: "Batch reverted successfully.", type: "success" });
          fetchBatches();
      } catch {
          setMsg({ text: "Undo Failed", type: "error" });
      }
  };

  const handleSingle = async () => {
    if (!sSummary) { setMsg({ text: "Summary required", type: "error" }); return; }
    try {
        await axios.post('http://127.0.0.1:8000/api/bug', {
            bug: { summary: sSummary, component: sComp, severity: sSev, status: "NEW" },
            company_id: user.company_id
        });
        setSSummary("");
        setMsg({ text: "Bug logged manually", type: "success" });
    } catch {
        setMsg({ text: "Error saving bug", type: "error" });
    }
  };

  // Helper for Accuracy Color
  const getAccColor = (acc) => {
      if(acc >= 90) return '#16a34a'; // Green
      if(acc >= 80) return '#ea580c'; // Orange
      return '#dc2626'; // Red
  };

  return (
    <div className="page-content centered-page" style={{alignItems:'flex-start', gap: 40}}>

      {/* --- LEFT PANEL: ACTION STATION --- */}
      <div className="sys-card" style={{flex: 1.5, padding: 0, overflow:'hidden', minHeight: 500, display:'flex', flexDirection:'column'}}>

        {/* HEADER */}
        <div style={{padding: '30px 30px 20px', borderBottom: '1px solid var(--border)', background: '#f8fafc'}}>
            <h2 style={{fontSize: 20, fontWeight: 800, margin: 0, display:'flex', alignItems:'center', gap: 10}}>
                <Database size={20} color="var(--accent)"/> Data Ingestion
            </h2>
            <p style={{fontSize: 13, color: 'var(--text-sec)', marginTop: 6}}>
                Feed the model new data to improve prediction accuracy.
            </p>

            {/* TOGGLE */}
            <div className="segmented-control" style={{marginTop: 20}}>
                <button className={`segment-btn ${mode==='bulk'?'active':''}`} onClick={()=>setMode('bulk')}>
                    <UploadCloud size={14}/> Bulk Train
                </button>
                <button className={`segment-btn ${mode==='single'?'active':''}`} onClick={()=>setMode('single')}>
                    <PenTool size={14}/> Manual Entry
                </button>
            </div>
        </div>

        {/* CONTENT AREA */}
        <div style={{padding: 40, flex: 1, display:'flex', flexDirection:'column', justifyContent:'center'}}>

            {mode === 'bulk' && (
                <div className="fade-in">
                    <div className={`drop-area-modern ${isTraining ? 'pulsing' : ''}`} style={{borderStyle:'dashed', borderWidth:2}}>
                        {isTraining ? (
                            <div style={{padding: 30}}>
                                <Activity size={48} className="spin" color="var(--accent)"/>
                                <h3 style={{fontSize: 16, fontWeight: 700, marginTop: 20, marginBottom: 5}}>Retraining Neural Network</h3>
                                <p style={{color:'var(--text-sec)', fontSize:13}}>Optimizing weights based on new patterns...</p>
                            </div>
                        ) : (
                            <>
                                <div style={{width: 60, height: 60, background: '#eff6ff', borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px'}}>
                                    <FileText size={28} color="var(--accent)"/>
                                </div>
                                <h3 style={{fontSize: 16, fontWeight: 700, margin: 0}}>Upload Training Data</h3>
                                <p style={{fontSize: 13, color: 'var(--text-sec)', marginTop: 8, marginBottom: 20}}>
                                    Supports CSV or JSON. Auto-detects 'Summary' and 'Severity'.
                                </p>
                                <input
                                    type="file"
                                    id="fileUpload"
                                    style={{display:'none'}}
                                    onChange={e=>setFile(e.target.files[0])}
                                />
                                <label htmlFor="fileUpload" className="sys-btn outline" style={{width: 'fit-content', margin: '0 auto', cursor:'pointer'}}>
                                    {file ? file.name : "Select File"}
                                </label>
                            </>
                        )}
                    </div>

                    <button
                        className="sys-btn full"
                        onClick={handleBulkUpload}
                        disabled={!file || isTraining}
                        style={{marginTop: 24, height: 48, fontSize: 14}}
                    >
                        {isTraining ? 'PROCESSING...' : 'INITIATE TRAINING RUN'}
                    </button>

                    {/* SUCCESS STATS */}
                    {trainStats && (
                        <div className="fade-in" style={{marginTop: 24, padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12}}>
                            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 8}}>
                                <span style={{fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase'}}>Training Success</span>
                                <CheckCircle size={16} color="#16a34a"/>
                            </div>
                            <div style={{display:'flex', gap: 20}}>
                                <div>
                                    <div style={{fontSize: 20, fontWeight: 800, color: '#15803d'}}>{trainStats.accuracy}%</div>
                                    <div style={{fontSize: 11, color: '#166534'}}>New Accuracy</div>
                                </div>
                                <div style={{width: 1, background: '#bbf7d0'}}></div>
                                <div>
                                    <div style={{fontSize: 20, fontWeight: 800, color: '#15803d'}}>+{trainStats.added}</div>
                                    <div style={{fontSize: 11, color: '#166534'}}>Patterns Learned</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {mode === 'single' && (
                <div className="fade-in">
                    <label style={{display:'block', fontSize:12, fontWeight:700, color:'var(--text-sec)', marginBottom:8}}>BUG SUMMARY</label>
                    <textarea
                        className="sys-input"
                        rows={5}
                        placeholder="Describe the defect..."
                        value={sSummary}
                        onChange={e=>setSSummary(e.target.value)}
                        style={{resize:'none', marginBottom: 20}}
                    />

                    <div className="form-row-2">
                        <div>
                            <label style={{display:'block', fontSize:12, fontWeight:700, color:'var(--text-sec)', marginBottom:8}}>COMPONENT</label>
                            <select className="sys-input" value={sComp} onChange={e=>setSComp(e.target.value)}>
                                <option>Frontend</option><option>Backend</option><option>Database</option><option>API</option>
                            </select>
                        </div>
                        <div>
                            <label style={{display:'block', fontSize:12, fontWeight:700, color:'var(--text-sec)', marginBottom:8}}>SEVERITY</label>
                            <select className="sys-input" value={sSev} onChange={e=>setSSev(e.target.value)}>
                                <option>S3</option><option>S2</option><option>S1</option><option>S4</option>
                            </select>
                        </div>
                    </div>

                    <button className="sys-btn full" onClick={handleSingle} style={{marginTop: 24, height: 48}}>
                        LOG DEFECT
                    </button>
                </div>
            )}

            {msg.text && !trainStats && (
                <div className={`alert-banner-modern ${msg.type} fade-in`} style={{marginTop: 20}}>
                    {msg.type === 'loading' ? <Activity size={16} className="spin"/> : <AlertCircle size={16}/>}
                    {msg.text}
                </div>
            )}
        </div>
      </div>

      {/* --- RIGHT PANEL: TRAINING HISTORY --- */}
      <div className="sys-card" style={{flex: 1, padding: 0, minHeight: 500, display:'flex', flexDirection:'column'}}>
          <div style={{padding: '30px 30px 20px', borderBottom: '1px solid var(--border)'}}>
              <h2 style={{fontSize: 18, fontWeight: 800, margin: 0, display:'flex', alignItems:'center', gap: 10}}>
                  <BarChart3 size={20} color="var(--text-sec)"/> Model Ledger
              </h2>
          </div>

          <div className="custom-scrollbar" style={{flex: 1, overflowY: 'auto', padding: 0}}>
              {batches.length === 0 && (
                  <div style={{padding: 40, textAlign: 'center', color: 'var(--text-sec)', fontSize: 13}}>
                      <Layers size={32} style={{opacity: 0.2, marginBottom: 10}}/>
                      <p>No training history found.</p>
                  </div>
              )}

              {batches.map((b, i) => (
                  <div key={b.id} style={{
                      padding: '20px 30px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: i===0 ? '#f8fafc' : 'white' // Highlight newest
                  }}>
                      <div style={{display:'flex', gap: 16, alignItems:'center'}}>
                          {/* Accuracy Badge */}
                          <div style={{
                              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                              width: 50, height: 50, borderRadius: 12,
                              background: b.accuracy > 0 ? `${getAccColor(b.accuracy)}15` : '#f1f5f9',
                              border: `1px solid ${b.accuracy > 0 ? getAccColor(b.accuracy) : '#e2e8f0'}`
                          }}>
                              <span style={{fontSize: 14, fontWeight: 800, color: getAccColor(b.accuracy)}}>
                                  {b.accuracy > 0 ? Math.round(b.accuracy) : '--'}%
                              </span>
                          </div>

                          <div>
                              <div style={{fontSize: 14, fontWeight: 700, color: 'var(--text-main)'}}>{b.filename}</div>
                              <div style={{fontSize: 12, color: 'var(--text-sec)', marginTop: 2, display:'flex', alignItems:'center', gap: 6}}>
                                  <span>{b.time}</span>
                                  <span>•</span>
                                  <span>{b.count} Records</span>
                              </div>
                          </div>
                      </div>

                      <button
                          onClick={() => handleUndoBatch(b.id)}
                          className="icon-btn danger"
                          title="Undo Training Batch"
                          style={{padding: 8}}
                      >
                          <RotateCcw size={16}/>
                      </button>
                  </div>
              ))}
          </div>
      </div>
    </div>
  )
}