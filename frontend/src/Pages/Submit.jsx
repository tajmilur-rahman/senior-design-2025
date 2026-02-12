import { useState, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, RotateCcw, AlertTriangle, Trash2, CheckCircle, AlertCircle, FileText, PenTool } from 'lucide-react';

export default function SubmitTab({ user }) {
  const [mode, setMode] = useState('single');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState({ text: "", type: "" }); // { text: "Saved", type: "success" }
  const [recent, setRecent] = useState([]);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [lastBatchIds, setLastBatchIds] = useState([]);

  // Form State
  const [sSummary, setSSummary] = useState("");
  const [sComp, setSComp] = useState("Frontend");
  const [sSev, setSSev] = useState("S3");

  useEffect(() => { fetchRecent(); }, []);

  // SWITCH TABS HELPER (Clears messages)
  const switchMode = (newMode) => {
      setMode(newMode);
      setMsg({ text: "", type: "" }); // [FIX] Clear message on tab switch
      setFile(null);
  };

  const fetchRecent = async () => {
      try {
          const res = await axios.get(`http://127.0.0.1:8000/api/hub/explorer?company_id=${user.company_id}&limit=10`);
          setRecent(res.data);
      } catch (err) { }
  };

  const handleBulk = async () => {
    if(!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("company_id", user.company_id);
    try {
      const r = await axios.post('http://127.0.0.1:8000/api/upload', fd);
      setMsg({ text: r.data.message, type: "success" });
      if (r.data.ids) setLastBatchIds(r.data.ids);
      fetchRecent();
    } catch { setMsg({ text: "Upload failed", type: "error" }); }
  };

  const handleUndoBatch = async () => {
      if(lastBatchIds.length === 0) return;
      if(!window.confirm(`Delete ${lastBatchIds.length} uploaded records?`)) return;
      try {
          await axios.post('http://127.0.0.1:8000/api/bugs/batch_delete', { ids: lastBatchIds, company_id: user.company_id });
          setMsg({ text: `Deleted ${lastBatchIds.length} records.`, type: "success" });
          setLastBatchIds([]);
          fetchRecent();
      } catch { setMsg({ text: "Undo Failed", type: "error" }); }
  };

  const handleSingle = async () => {
    if (!sSummary) { setMsg({ text: "Please enter a bug summary.", type: "error" }); return; }

    // OPTIMISTIC UPDATE
    const tempId = Date.now();
    const newBug = { id: tempId, bug_id: tempId, summary: sSummary, component: sComp, severity: sSev, status: "NEW" };
    setRecent([newBug, ...recent]);
    setSSummary("");
    setMsg({ text: "Bug submitted successfully", type: "success" });

    try {
        const bugPayload = { summary: newBug.summary, component: sComp, severity: sSev, status: "NEW" };
        await axios.post('http://127.0.0.1:8000/api/bug', { bug: bugPayload, company_id: user.company_id });
        fetchRecent(); // Get real ID
    } catch {
        setMsg({ text: "Error saving bug", type: "error" });
        setRecent(recent.filter(b => b.id !== tempId));
    }
  };

  const confirmDelete = async () => {
      if (!deleteTargetId) return;
      const backupRecent = [...recent];
      setRecent(recent.filter(item => (item.bug_id || item.id) !== deleteTargetId));
      setDeleteTargetId(null);
      setMsg({ text: "Record deleted.", type: "success" });

      try {
          await axios.delete(`http://127.0.0.1:8000/api/bug/${deleteTargetId}`, { data: { company_id: user.company_id } });
      } catch (err) {
          if (!err.response || err.response.status !== 404) {
              alert(`Error: ${err.response?.data?.detail || "Server Error"}`);
              setRecent(backupRecent);
          }
      }
  };

  const getSummary = (item) => item.summary || item.data?.summary || "No Summary";
  const getDisplayId = (item) => item.bug_id || item.id;

  return (
    <div className="page-content centered-page">
      {/* DELETE MODAL */}
      {deleteTargetId && (
        <div className="modal-overlay">
            <div className="modal-card fade-in">
               <div className="modal-icon-wrapper"><AlertTriangle size={28} color="#ef4444"/></div>
               <h3 className="modal-title">Delete Record?</h3>
               <p className="modal-desc">Are you sure you want to delete Bug <strong>#{deleteTargetId}</strong>? This action cannot be undone.</p>
               <div className="modal-actions">
                  <button onClick={()=>setDeleteTargetId(null)} className="sys-btn outline">Cancel</button>
                  <button onClick={confirmDelete} className="sys-btn danger">Delete Forever</button>
               </div>
            </div>
        </div>
      )}

      <div className="sys-card form-wrapper" style={{maxWidth: '700px', padding: '40px'}}>
        <div className="form-header" style={{marginBottom: 30}}>
          <h2 style={{fontSize:22, fontWeight:800, color:'var(--text-main)', margin:0, display:'flex', alignItems:'center', gap:10}}>
              <div style={{background:'var(--accent)', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <UploadCloud size={18} color="white"/>
              </div>
              SUBMIT DATA
          </h2>

          {/* MODERN SEGMENTED CONTROL */}
          <div className="segmented-control">
            <button
                className={`segment-btn ${mode==='single'?'active':''}`}
                onClick={() => switchMode('single')}
            >
                <PenTool size={14}/> Manual Entry
            </button>
            <button
                className={`segment-btn ${mode==='bulk'?'active':''}`}
                onClick={() => switchMode('bulk')}
            >
                <FileText size={14}/> Bulk Upload
            </button>
          </div>
        </div>

        {/* MODE: BULK UPLOAD */}
        {mode === 'bulk' && (
          <div className="fade-in">
            <div className="drop-area-modern">
                <UploadCloud size={40} className="drop-icon"/>
                <p><strong>Click to upload</strong> or drag and drop</p>
                <span className="drop-sub">JSON or CSV files allowed</span>
                <input type="file" onChange={e=>setFile(e.target.files[0])} />
            </div>
            {file && <div className="file-pill"><FileText size={14}/> {file.name}</div>}

            <button className="sys-btn full" onClick={handleBulk} style={{marginTop: 20}}>UPLOAD & PROCESS</button>

            {lastBatchIds.length > 0 && (
                <button className="sys-btn outline full" onClick={handleUndoBatch} style={{marginTop:12, borderColor:'#fecaca', color:'#ef4444'}}>
                    <RotateCcw size={14}/> Undo Last Batch ({lastBatchIds.length})
                </button>
            )}
          </div>
        )}

        {/* MODE: MANUAL ENTRY */}
        {mode === 'single' && (
          <div className="fade-in submit-grid">
            <div className="form-group">
                <label>Bug Summary</label>
                <textarea className="sys-input modern-input" rows={4} placeholder="Describe the issue..." value={sSummary} onChange={e=>setSSummary(e.target.value)} />
            </div>
            <div className="form-row-2">
                <div className="form-group">
                    <label>Component</label>
                    <select className="sys-input modern-input" value={sComp} onChange={e=>setSComp(e.target.value)}><option>Frontend</option><option>Backend</option><option>Database</option><option>Auth</option></select>
                </div>
                <div className="form-group">
                    <label>Severity</label>
                    <select className="sys-input modern-input" value={sSev} onChange={e=>setSSev(e.target.value)}><option>S1</option><option>S2</option><option>S3</option><option>S4</option></select>
                </div>
            </div>
            <button className="sys-btn full" onClick={handleSingle} style={{marginTop:10}}>SUBMIT RECORD</button>
          </div>
        )}

        {/* ALERTS (Only show if msg.text exists) */}
        {msg.text && (
            <div className={`alert-banner-modern ${msg.type} fade-in`}>
                {msg.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle size={18}/>}
                <span>{msg.text}</span>
            </div>
        )}

        {/* RECENT LIST */}
        {recent.length > 0 && (
            <div className="recent-list-container">
                <h4 className="section-label">RECENT SUBMISSIONS</h4>
                <div className="custom-scrollbar recent-scroll">
                    {recent.map((item) => (
                        <div key={item.id} className="recent-item">
                            <div className="recent-info">
                                <span className="recent-id">#{getDisplayId(item)}</span>
                                <span className="recent-summary" title={getSummary(item)}>{getSummary(item)}</span>
                            </div>
                            <button onClick={() => setDeleteTargetId(item.bug_id || item.id)} className="icon-btn danger">
                                <Trash2 size={15}/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  )
}