import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { BrainCircuit, Terminal, CheckCircle, ChevronDown } from 'lucide-react';

function CustomSelect({ value, onChange, options, placeholder, disabled = false, ariaLabel, triggerClassName, dropUp = false }) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);
  const listId = useRef(`sf-listbox-${Math.random().toString(36).slice(2, 9)}`).current;
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const selectedIdx = options.findIndex(o => String(o.value) === String(value));
  const selected = selectedIdx >= 0 ? options[selectedIdx] : null;
  useEffect(() => { if (!open) return; setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0); }, [open]);
  const openAnd = (idx) => { if (disabled) return; setOpen(true); setActiveIdx(idx); };
  const commit = (idx) => { if (idx < 0 || idx >= options.length) return; onChange(options[idx].value); setOpen(false); };
  const onKeyDown = (e) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter': case ' ': e.preventDefault(); if (!open) openAnd(selectedIdx >= 0 ? selectedIdx : 0); else commit(activeIdx); break;
      case 'ArrowDown': e.preventDefault(); if (!open) openAnd(selectedIdx >= 0 ? selectedIdx : 0); else setActiveIdx(i => Math.min(options.length - 1, i + 1)); break;
      case 'ArrowUp': e.preventDefault(); if (!open) openAnd(Math.max(0, selectedIdx)); else setActiveIdx(i => Math.max(0, i - 1)); break;
      case 'Escape': if (open) { e.preventDefault(); setOpen(false); } break;
      case 'Tab': setOpen(false); break;
      default: break;
    }
  };
  return (
    <div ref={ref} className={`relative select-none w-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div role="combobox" tabIndex={disabled ? -1 : 0} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-disabled={disabled} aria-label={ariaLabel || placeholder} onClick={() => { if (!disabled) setOpen(o => !o); }} onKeyDown={onKeyDown}
        className={triggerClassName || `h-12 flex items-center justify-between px-4 border rounded-xl cursor-pointer text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-indigo-500/30 ${open ? 'border-indigo-500/40 bg-white/[0.08] text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20'}`}>
        <span className={`truncate pr-2 ${selected ? 'text-white' : ''}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div id={listId} role="listbox" ref={listRef} aria-label={ariaLabel || placeholder} className={`absolute z-[9999] w-full border border-white/10 rounded-xl shadow-md overflow-hidden py-1.5 ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`} style={{ background: 'var(--card-bg)' }}>
          <div className="max-h-52 overflow-y-auto custom-scrollbar">
            {options.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              return (<div key={opt.value} role="option" aria-selected={isSelected} onClick={() => commit(i)} onMouseEnter={() => setActiveIdx(i)} className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors mx-1.5 rounded-xl ${isSelected ? 'bg-indigo-500/15 text-indigo-400' : i === activeIdx ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>{opt.label}</div>);
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MLPredictor({ user }) {
  const [summary,      setSummary]      = useState("");
  const [component,    setComponent]    = useState("Frontend");
  const [platform,     setPlatform]     = useState("Windows");
  const [res,          setRes]          = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const components = ["Frontend", "Backend", "Database", "Networking", "Security", "DevTools", "Core"];
  const platforms  = ["Windows", "MacOS", "Linux", "Android", "iOS"];

  const getAuthHeader = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  const predict = async () => {
    if (!summary) return;
    setLoading(true); setRes(null); setSaved(false); setFeedbackSent(false);
    try {
      const r = await axios.post('/api/predict', { summary, component, platform }, { headers: getAuthHeader() });
      setRes(r.data);
    } catch (err) {
      console.error("API Error:", err);
      alert("Error: Prediction failed. Ensure backend is running and you are logged in.");
    }
    setLoading(false);
  };

  const saveToDb = async () => {
    if (!res) return;
    try {
      await axios.post('/api/bug', { bug: { summary, component, severity: res.prediction, status: "NEW", platform }, company_id: user.company_id }, { headers: getAuthHeader() });
      setSaved(true);
    } catch (e) {
      console.error("Save Error:", e);
      alert("Error saving bug to database.");
    }
  };

  const sendFeedback = async (actual) => {
    try {
      await axios.post('/api/feedback', { summary, predicted_severity: res.prediction, actual_severity: actual, company_id: user.company_id }, { headers: getAuthHeader() });
      setFeedbackSent(true);
    } catch (e) { console.error("Feedback Error:", e); }
  };

  return (
    <div className="page-content centered-page fade-in">
      <div className="sys-card form-wrapper" style={{maxWidth: 600}}>
        <div className="form-header">
          <div style={{background:'#eff6ff', width:64, height:64, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', boxShadow:'0 10px 15px -3px rgba(37, 99, 235, 0.2)'}}>
             <BrainCircuit size={32} color="var(--accent)"/>
          </div>
          <h2 style={{fontSize:24, fontWeight:800, color:'var(--text-main)', textAlign:'center'}}>NEW BUG ANALYSIS</h2>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap: 15}}>
          <div>
            <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>BUG SUMMARY</label>
            <div className="spotlight-search" style={{width:'100%'}}>
               <Terminal size={18} color="#94a3b8" />
               <input placeholder="e.g. Application crashes when clicking Login..." value={summary} onChange={e => setSummary(e.target.value)} />
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:15}}>
            <div>
              <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>COMPONENT</label>
              <CustomSelect
                value={component} onChange={v=>setComponent(v)}
                options={components.map(c => ({ value: c, label: c }))}
              />
            </div>
            <div>
              <label style={{fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6, display:'block'}}>PLATFORM</label>
              <CustomSelect
                value={platform} onChange={v=>setPlatform(v)}
                options={platforms.map(p => ({ value: p, label: p }))}
              />
            </div>
          </div>
        </div>
        <button className="sys-btn full" onClick={predict} disabled={loading} style={{marginTop:24}}>
          {loading ? "PROCESSING..." : "PREDICT SEVERITY"}
        </button>
        {res && (
          <div className="result-box fade-in" style={{marginTop:24, background:'#f8fafc', padding:24, borderRadius:12, border:'1px solid #e2e8f0'}}>
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:15}}>
                <span className={`pill ${res.prediction}`} style={{fontSize:16, padding:'6px 14px'}}>{res.prediction}</span>
                <span style={{fontWeight:800, fontSize:18, color:'#0f172a'}}>{(res.confidence * 100).toFixed(0)}% Conf.</span>
             </div>
             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:15}}>
                <div style={{background:'white', padding:10, borderRadius:8, border:'1px solid #e2e8f0'}}>
                  <div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>DIAGNOSIS</div>
                  <div style={{fontSize:13, fontWeight:600}}>{res.diagnosis || "Structural Crash"}</div>
                </div>
                <div style={{background:'white', padding:10, borderRadius:8, border:'1px solid #e2e8f0'}}>
                  <div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>TEAM</div>
                  <div style={{fontSize:13, fontWeight:600, color:'#2563eb'}}>{res.team || "Core Engine"}</div>
                </div>
             </div>
             {!feedbackSent && !saved && (
               <div style={{display:'flex', gap:10, paddingTop:10, borderTop:'1px dashed #cbd5e1'}}>
                 <button className="sys-btn outline" onClick={() => sendFeedback(res.prediction)} style={{flex:1, color:'#16a34a', borderColor:'#22c55e'}}>✓ Correct</button>
                 <button className="sys-btn outline" onClick={() => {const c=prompt("Correct Severity?"); if(c) sendFeedback(c.toUpperCase())}} style={{flex:1, color:'#ef4444', borderColor:'#ef4444'}}>✕ Wrong</button>
               </div>
             )}
             {!saved && (
               <button className="sys-btn full" onClick={saveToDb} style={{background:'#10b981', marginTop:15, color:'white'}}>
                  <CheckCircle size={16}/> SUBMIT TO DATABASE
               </button>
             )}
             {saved && <div style={{textAlign:'center', color:'#10b981', fontWeight:700, marginTop:15}}>✓ Saved to Database</div>}
          </div>
        )}
      </div>
    </div>
  );
}
