import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { BrainCircuit, Terminal, CheckCircle, ChevronDown } from 'lucide-react';
import { LiquidButton as Button } from '../liquid-glass-button';

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
        className={triggerClassName || `h-12 flex items-center justify-between px-5 border rounded-xl cursor-pointer text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-indigo-500/30 ${open ? 'border-indigo-500/40 bg-black/60 text-white' : 'bg-black/40 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20'}`}>
        <span className={`truncate pr-2 tracking-wide ${selected ? 'text-white' : ''}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div id={listId} role="listbox" ref={listRef} aria-label={ariaLabel || placeholder} className={`absolute z-[9999] w-full border border-white/10 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-200 ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'}`} style={{ backgroundColor: 'var(--bg-elevated)', backdropFilter: 'blur(16px)' }}>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              return (<div key={opt.value} role="option" aria-selected={isSelected} onClick={() => commit(i)} onMouseEnter={() => setActiveIdx(i)} className={`px-5 py-3 text-[13px] font-semibold tracking-wide cursor-pointer transition-colors mx-2 my-0.5 rounded-lg ${isSelected ? 'bg-indigo-500/15 text-indigo-400' : i === activeIdx ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>{opt.label}</div>);
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const SEVERITIES = ['S1', 'S2', 'S3', 'S4'];

export default function MLPredictor({ user }) {
  const [summary,            setSummary]            = useState("");
  const [component,          setComponent]          = useState("Frontend");
  const [platform,           setPlatform]           = useState("Windows");
  const [res,                setRes]                = useState(null);
  const [loading,            setLoading]            = useState(false);
  const [saved,              setSaved]              = useState(false);
  const [feedbackSent,       setFeedbackSent]       = useState(false);
  const [error,              setError]              = useState(null);
  const [showCorrectionPick, setShowCorrectionPick] = useState(false);

  const components = ["Frontend", "Backend", "Database", "Networking", "Security", "DevTools", "Core"];
  const platforms  = ["Windows", "MacOS", "Linux", "Android", "iOS"];

  const predict = async () => {
    if (!summary) return;
    setLoading(true); setRes(null); setSaved(false); setFeedbackSent(false); setError(null); setShowCorrectionPick(false);
    try {
      const r = await axios.post('/api/predict', { summary, component, platform });
      setRes(r.data);
    } catch (err) {
      if (import.meta.env.DEV) console.error("Prediction error:", err);
      setError("Prediction failed. Make sure you are logged in and the backend is reachable.");
    }
    setLoading(false);
  };

  const saveToDb = async () => {
    if (!res) return;
    try {
      await axios.post('/api/bug', { bug: { summary, component, severity: res.prediction, status: "NEW", platform }, company_id: user.company_id });
      setSaved(true);
      setError(null);
    } catch (e) {
      if (import.meta.env.DEV) console.error("Save error:", e);
      setError("Failed to save bug to database.");
    }
  };

  const sendFeedback = async (actual) => {
    try {
      await axios.post('/api/feedback', { summary, predicted_severity: res.prediction, actual_severity: actual, company_id: user.company_id });
      setFeedbackSent(true);
      setShowCorrectionPick(false);
    } catch (e) {
      if (import.meta.env.DEV) console.error("Feedback error:", e);
    }
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
        {error && (
          <div style={{marginTop:16, padding:'10px 14px', borderRadius:8, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', fontSize:13, fontWeight:600}}>
            {error}
          </div>
        )}
        <Button className="w-full" onClick={predict} disabled={loading} style={{marginTop:24}}>
          {loading ? "PROCESSING..." : "PREDICT SEVERITY"}
        </Button>
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
               <div style={{display:'flex', flexDirection:'column', gap:8, paddingTop:10, borderTop:'1px dashed #cbd5e1'}}>
                 <div style={{display:'flex', gap:10}}>
                   <button className="sys-btn outline" onClick={() => sendFeedback(res.prediction)} style={{flex:1, color:'#16a34a', borderColor:'#22c55e'}}>✓ Correct</button>
                   <button className="sys-btn outline" onClick={() => setShowCorrectionPick(p => !p)} style={{flex:1, color:'#ef4444', borderColor:'#ef4444'}}>✕ Wrong</button>
                 </div>
                 {showCorrectionPick && (
                   <div style={{display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap'}}>
                     <span style={{fontSize:11, fontWeight:700, color:'#64748b', width:'100%', textAlign:'center', marginBottom:2}}>SELECT CORRECT SEVERITY</span>
                     {SEVERITIES.map(sev => (
                       <button key={sev} className="sys-btn outline" onClick={() => sendFeedback(sev)}
                         style={{minWidth:52, fontWeight:800, color: sev === 'S1' ? '#ef4444' : sev === 'S2' ? '#f59e0b' : sev === 'S3' ? '#6366f1' : '#94a3b8'}}>
                         {sev}
                       </button>
                     ))}
                   </div>
                 )}
               </div>
             )}
             {feedbackSent && <div style={{paddingTop:10, borderTop:'1px dashed #cbd5e1', textAlign:'center', color:'#16a34a', fontWeight:700, fontSize:13}}>✓ Feedback recorded</div>}
             {!saved && (
               <Button className="w-full" onClick={saveToDb} style={{background:'#10b981', marginTop:15, color:'white'}}>
                  <CheckCircle size={16}/> SUBMIT TO DATABASE
               </Button>
             )}
             {saved && <div style={{textAlign:'center', color:'#10b981', fontWeight:700, marginTop:15}}>✓ Saved to Database</div>}
          </div>
        )}
      </div>
    </div>
  );
}
