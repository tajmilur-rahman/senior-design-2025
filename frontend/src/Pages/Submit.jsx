import { useState, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, RotateCcw, AlertTriangle, Trash2 } from 'lucide-react';

export default function SubmitTab({ user }) {
  const [mode, setMode] = useState('single');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");
  const [recent, setRecent] = useState([]);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [lastBatchIds, setLastBatchIds] = useState([]);
  const [sSummary, setSSummary] = useState("");
  const [sComp, setSComp] = useState("Frontend");
  const [sSev, setSSev] = useState("S3");

  useEffect(() => { fetchRecent(); }, []);

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
      setMsg("✅ "+r.data.message);
      if (r.data.ids) setLastBatchIds(r.data.ids);
      fetchRecent();
    } catch { setMsg("❌ Upload failed"); }
  };

  const handleUndoBatch = async () => {
      if(lastBatchIds.length === 0) return;
      if(!window.confirm(`Delete ${lastBatchIds.length} uploaded records?`)) return;
      try {
          await axios.post('http://127.0.0.1:8000/api/bugs/batch_delete', { ids: lastBatchIds, company_id: user.company_id });
          setMsg(`✅ Deleted ${lastBatchIds.length} records.`);
          setLastBatchIds([]);
          fetchRecent();
      } catch { setMsg("❌ Batch delete failed"); }
  };

  const handleSingle = async () => {
    try {
      const bug = { summary: sSummary, component: sComp, severity: sSev, status: "NEW" };
      await axios.post('http://127.0.0.1:8000/api/bug', { bug, company_id: user.company_id });
      setMsg("✅ Saved");
      setSSummary("");
      fetchRecent();
    } catch { setMsg("❌ Error saving bug"); }
  };

  const confirmDelete = async () => {
      if (!deleteTargetId) return;
      try {
          await axios.delete(`http://127.0.0.1:8000/api/bug/${deleteTargetId}`, { data: { company_id: user.company_id } });
          setRecent(recent.filter(item => item.id !== deleteTargetId));
          setDeleteTargetId(null);
      } catch (err) {
          alert("Could not delete. It may already be gone.");
          setDeleteTargetId(null);
      }
  };

  return (
    <div className="page-content centered-page">
      {deleteTargetId && (
        <div className="modal-overlay">
            <div className="modal-card">
               <div style={{width:60, height:60, background:'#fee2e2', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px'}}>
                  <AlertTriangle size={30} color="#ef4444"/>
               </div>
               <h3 style={{margin:'0 0 10px 0', fontSize:20, fontWeight:800}}>Delete Record?</h3>
               <p style={{margin:0, color:'#64748b', fontSize:14, lineHeight:1.5}}>Are you sure you want to delete Bug <strong>#{deleteTargetId}</strong>? This action cannot be undone.</p>
               <div style={{display:'flex', gap:12, marginTop:24}}>
                  <button onClick={()=>setDeleteTargetId(null)} className="sys-btn outline full" style={{fontSize:13}}>Cancel</button>
                  <button onClick={confirmDelete} className="sys-btn full" style={{background:'var(--danger)', fontSize:13}}>Delete Forever</button>
               </div>
            </div>
        </div>
      )}

      <div className="sys-card form-wrapper">
        <div className="form-header">
          <h2 style={{fontSize:24, fontWeight:800}}>SUBMIT DATA</h2>
          <div style={{display:'flex', background:'#f1f5f9', padding:4, borderRadius:10, marginTop:24}}>
            <button style={{flex:1, padding:10, border:'none', background:mode==='single'?'white':'transparent', boxShadow:mode==='single'?'var(--shadow-sm)':'none', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer', color:mode==='single'?'var(--accent)':'#64748b', transition:'0.2s'}} onClick={() => setMode('single')}>Manual Entry</button>
            <button style={{flex:1, padding:10, border:'none', background:mode==='bulk'?'white':'transparent', boxShadow:mode==='bulk'?'var(--shadow-sm)':'none', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer', color:mode==='bulk'?'var(--accent)':'#64748b', transition:'0.2s'}} onClick={() => setMode('bulk')}>Bulk Upload</button>
          </div>
        </div>

        {mode === 'bulk' ? (
          <div className="fade-in">
            <div className="drop-area" style={{border:'2px dashed #cbd5e1', borderRadius:12, height:180, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#64748b', marginBottom:24, background:'#f8fafc', position:'relative', transition:'0.2s'}}>
                <UploadCloud size={48} style={{marginBottom:16, opacity:0.5}}/>
                <p style={{fontSize:14, fontWeight:600}}>Click to Upload JSON</p>
                <input type="file" onChange={e=>setFile(e.target.files[0])} style={{opacity:0, position:'absolute', height:'100%', width:'100%', cursor:'pointer', top:0, left:0}}/>
            </div>
            {file && <div style={{textAlign:'center', fontSize:13, marginBottom:16, fontWeight:600, color:'var(--accent)'}}>{file.name}</div>}

            <button className="sys-btn full" onClick={handleBulk}>UPLOAD & TRAIN</button>

            {/* NEW BATCH DELETE BUTTON */}
            {lastBatchIds.length > 0 && (
                <button
                    className="sys-btn full"
                    onClick={handleUndoBatch}
                    style={{marginTop:12, background:'#fee2e2', color:'#ef4444', border:'1px solid #fecaca'}}
                >
                    <RotateCcw size={14}/> UNDO LAST BATCH ({lastBatchIds.length})
                </button>
            )}
          </div>
        ) : (
          <div className="fade-in" style={{display:'flex', flexDirection:'column', gap:15}}>
            <div>
                <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>SUMMARY</label>
                <input className="sys-input" placeholder="Bug description..." value={sSummary} onChange={e=>setSSummary(e.target.value)} style={{marginBottom:0}}/>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:15}}>
              <div>
                <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>COMPONENT</label>
                <select className="sys-input" value={sComp} onChange={e=>setSComp(e.target.value)} style={{marginBottom:0}}><option>Frontend</option><option>Backend</option><option>Database</option></select>
              </div>
              <div>
                <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>SEVERITY</label>
                <select className="sys-input" value={sSev} onChange={e=>setSSev(e.target.value)} style={{marginBottom:0}}><option>S1</option><option>S2</option><option>S3</option></select>
              </div>
            </div>
            <button className="sys-btn full" onClick={handleSingle} style={{marginTop:10}}>SUBMIT RECORD</button>
          </div>
        )}

        {msg && <div style={{marginTop:24, textAlign:'center', fontSize:14, fontWeight:600, color:msg.includes('Error')||msg.includes('fail')?'var(--danger)':'var(--success)'}}>{msg}</div>}

        {recent.length > 0 && (
            <div style={{marginTop:30, paddingTop:24, borderTop:'1px dashed #e2e8f0'}}>
                <h4 style={{fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase', marginBottom:12}}>Recent Submissions</h4>
                <div style={{maxHeight:150, overflowY:'auto'}}>
                    {recent.map((item) => (
                        <div key={item.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', padding:'8px 12px', borderRadius:8, marginBottom:8, border:'1px solid #f1f5f9'}}>
                            <div style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:13, color:'#334155'}}>
                                <span style={{fontWeight:700, color:'var(--accent)', marginRight:8}}>#{item.id}</span>
                                {item.summary}
                            </div>
                            <button onClick={() => setDeleteTargetId(item.id)} style={{background:'none', border:'none', cursor:'pointer', color:'#ef4444', padding:4}} title="Delete Bug">
                                <Trash2 size={14}/>
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