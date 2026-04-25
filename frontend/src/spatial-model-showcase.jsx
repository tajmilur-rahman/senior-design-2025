import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Cpu } from 'lucide-react';

export function ModelShowcase({ liveDataProp, isSuperAdmin }) {
  const [localData, setLocalData] = useState(null);

  useEffect(() => {
    if (!liveDataProp) {
      axios.get('/api/hub/ml_metrics')
        .then(res => setLocalData(res.data))
        .catch(() => {});
    }
  }, [liveDataProp]);

  const liveData = liveDataProp || localData;

  const accent   = '#10b981';
  const accentFg = '#6ee7b7';

  let status   = 'Learning';
  let metadata = ['Algorithm','Estimators','Volume','Features','Top Weakness','Updated']
    .map(label => ({ label, value: '—' }));

  if (liveData) {
    const curr    = liveData.current || {};
    const fb      = liveData.feedback_stats || {};
    const trained = curr.model_source === 'company' || curr.model_status === 'ready';
    status = trained ? 'Active' : 'Learning';
    metadata = [
      { label: 'Algorithm',    value: trained ? 'Random Forest'                                   : '—' },
      { label: 'Estimators',   value: trained ? `${curr.total_trees || 0}`                        : '—' },
      { label: 'Volume',       value: trained ? `${(curr.dataset_size||0).toLocaleString()} rec.` : '—' },
      { label: 'Features',     value: trained ? 'TF-IDF + Meta'                                   : '—' },
      { label: 'Top Weakness', value: fb.weak_components?.[0]?.component || 'None'                },
      { label: 'Updated',      value: trained ? (curr.last_trained || '—')                        : '—' },
    ];
  }

  const isActive = status === 'Active';

  return (
    <div className="relative w-full rounded-2xl border overflow-hidden mb-6"
      style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 35% 100% at 0% 50%, ${accent}12, transparent 60%)` }} />

      <div className="relative z-10 flex flex-col sm:flex-row items-stretch divide-y sm:divide-y-0 sm:divide-x"
        style={{ borderColor: 'var(--border)' }}>

        {/* Col 1: Identity */}
        <div className="flex items-center gap-3.5 px-5 py-4 sm:w-60 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0"
            style={{ background: `${accent}1a`, borderColor: `${accent}40` }}>
            <Cpu size={17} style={{ color: accentFg }} strokeWidth={1.6} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: accentFg }}>
              Company Model
            </div>
            <div className="text-sm font-bold leading-tight" style={{ color: 'var(--text-main)' }}>
              Company Fine-Tuned
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'animate-pulse' : ''}`}
                style={{ background: accent }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accentFg }}>
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* Col 2: Metadata grid */}
        <div className="flex-1 px-5 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={status}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-3 sm:grid-cols-6 gap-x-5 gap-y-3 h-full content-center">
              {metadata.map((m, i) => (
                <div key={i}>
                  <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{m.label}</div>
                  <div className="text-[11px] font-semibold mt-0.5 truncate" style={{ color: 'var(--text-sec)' }} title={m.value}>{m.value}</div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
