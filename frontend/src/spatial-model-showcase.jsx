import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Activity,
  Sliders,
  ChevronRight,
  Zap,
  Database,
  BrainCircuit,
  CheckCircle,
} from 'lucide-react';

// =========================================
// 1. CONFIGURATION & DATA
// =========================================

const BASE_PRODUCT_DATA = {
  global: {
    id: 'global',
    label: 'Universal',
    title: 'Global Baseline Model',
    description: 'Trained on 222,000+ historical Mozilla Firefox records. Provides the foundational semantic understanding of bug severity across all tenants.',
    image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800&auto=format&fit=crop',
    datasetTooltip: 'Sourced from 220k+ open-source Mozilla Bugzilla reports. Contains multi-component historical data spanning 10+ years.',
    colors: {
      gradient: 'from-blue-600 to-indigo-900',
      glow: 'bg-blue-500',
      ring: 'border-l-blue-500/50',
    },
    stats: { connectionStatus: 'Not Trained', healthLevel: 100 },
    features: [
      { label: 'Base Accuracy', value: 0, icon: CheckCircle, tooltip: 'Overall correctness of the universal model across all baseline records.' },
      { label: 'F1 Score', value: 0, icon: Activity, tooltip: 'Harmonic mean of precision and recall for the universal baseline dataset.' },
    ],
  },
  tenant: {
    id: 'tenant',
    label: 'Tenant',
    title: 'Company Fine-Tuned',
    description: 'Continuously learns from your team\'s specific corrections. Adapts directly to your unique component structure and internal severity definitions.',
    image: 'https://images.unsplash.com/photo-1617791160505-6f00504e3519?q=80&w=800&auto=format&fit=crop',
    datasetTooltip: 'Sourced from your isolated company telemetry. Continuously updated via human feedback and batch ingestion.',
    colors: {
      gradient: 'from-emerald-600 to-teal-900',
      glow: 'bg-emerald-500',
      ring: 'border-r-emerald-500/50',
    },
    stats: { connectionStatus: 'Learning', healthLevel: 92 },
    features: [
      { label: 'Precision', value: 0, icon: Activity, tooltip: 'Measures the exactness of severity predictions on your isolated company data.' },
      { label: 'Recall', value: 0, icon: BrainCircuit, tooltip: 'Measures the model\'s ability to capture all relevant severity cases in your tenant.' },
    ],
  },
};

// =========================================
// 2. ANIMATION VARIANTS
// =========================================

const ANIMATIONS = {
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { type: 'spring', stiffness: 100, damping: 20 },
    },
    exit: { opacity: 0, y: -10, filter: 'blur(5px)' },
  },
  image: (isLeft) => ({
    initial: {
      opacity: 0,
      scale: 1.5,
      filter: 'blur(15px)',
      rotate: isLeft ? -30 : 30,
      x: isLeft ? -80 : 80,
    },
    animate: {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      rotate: 0,
      x: 0,
      transition: { type: 'spring', stiffness: 260, damping: 20 },
    },
    exit: {
      opacity: 0,
      scale: 0.6,
      filter: 'blur(20px)',
      transition: { duration: 0.25 },
    },
  }),
};

// =========================================
// 3. SUB-COMPONENTS
// =========================================

const BackgroundGradient = ({ isLeft }) => (
  <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden">
    <motion.div
      animate={{
        background: isLeft
          ? 'radial-gradient(circle at 0% 50%, rgba(59, 130, 246, 0.15), transparent 50%)'
          : 'radial-gradient(circle at 100% 50%, rgba(16, 185, 129, 0.15), transparent 50%)',
      }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0"
    />
  </div>
);

const ProductVisual = ({ data, isLeft }) => (
  <motion.div layout="position" className="relative group shrink-0">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      className={`absolute inset-[-20%] rounded-full border border-dashed border-white/10 ${data.colors.ring}`}
    />
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      className={`absolute inset-0 rounded-full bg-gradient-to-br ${data.colors.gradient} blur-2xl opacity-40`}
    />

    <div className="relative h-64 w-64 md:h-[350px] md:w-[350px] rounded-full border shadow-2xl flex items-center justify-center overflow-hidden bg-white/5 backdrop-blur-sm" style={{ borderColor: 'var(--border)' }}>
      <motion.div
        animate={{ y: [-10, 10, -10] }}
        transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
        className="relative z-10 w-full h-full flex items-center justify-center"
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={data.id}
            src={data.image}
            alt={`${data.title}`}
            variants={ANIMATIONS.image(isLeft)}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full h-full object-cover drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] mix-blend-screen opacity-90"
            draggable={false}
          />
        </AnimatePresence>
      </motion.div>
    </div>

    <motion.div
      layout="position"
      className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest px-4 py-2 rounded-full border backdrop-blur" style={{ color: 'var(--text-sec)', background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
        <span className={`h-1.5 w-1.5 rounded-full ${data.colors.glow} animate-pulse`} />
        {data.stats.connectionStatus}
      </div>
    </motion.div>
  </motion.div>
);

const ProductDetails = ({ data, isLeft }) => {
  const alignClass = isLeft ? 'items-start text-left' : 'items-end text-right';
  const flexDirClass = isLeft ? 'flex-row' : 'flex-row-reverse';
  const barColorClass = isLeft ? 'left-0 bg-blue-500' : 'right-0 bg-emerald-500';

  return (
    <motion.div
      variants={ANIMATIONS.container}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`flex flex-col ${alignClass}`}
    >
      <motion.h2 variants={ANIMATIONS.item} className="text-sm font-bold uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-dim)' }}>
        {data.label} Model
      </motion.h2>
      <motion.h1 variants={ANIMATIONS.item} className="text-3xl md:text-5xl font-bold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-b" style={{ backgroundImage: 'linear-gradient(to bottom, var(--text-main), var(--text-sec))' }}>
        {data.title}
      </motion.h1>
      <motion.p variants={ANIMATIONS.item} className={`mb-8 max-w-sm leading-relaxed ${isLeft ? 'mr-auto' : 'ml-auto'}`} style={{ color: 'var(--text-sec)' }}>
        {data.description}
      </motion.p>

      <motion.div variants={ANIMATIONS.item} className="w-full bg-white/5 p-6 rounded-2xl border backdrop-blur-sm" style={{ borderColor: 'var(--border)' }}>
        <div className="space-y-6">
          {data.features.map((feature, idx) => (
            <div key={feature.label} className="group relative">
              {/* Hover Tooltip */}
              <div className={`absolute bottom-full mb-3 ${isLeft ? 'left-0 text-left' : 'right-0 text-right'} w-56 p-3 backdrop-blur-xl border rounded-xl text-xs opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-hover:-translate-y-1 transition-all duration-200 pointer-events-none z-50 shadow-2xl`} style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                <div className="font-bold uppercase tracking-widest mb-1 text-[10px]" style={{ color: 'var(--text-dim)' }}>{feature.label} Explained</div>
                <div className="leading-relaxed font-medium" style={{ color: 'var(--text-main)' }}>{feature.tooltip}</div>
              </div>

              <div className={`flex items-center justify-between mb-2 text-sm ${flexDirClass}`}>
                <div className="flex items-center gap-2" style={{ color: feature.value > 50 ? 'var(--text-main)' : 'var(--text-sec)' }}>
                  <feature.icon size={16} /> <span>{feature.label}</span>
                </div>
                <span className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>{feature.value}%</span>
              </div>
              <div className="relative h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--hover-bg)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${feature.value}%` }}
                  transition={{ duration: 1, delay: 0.4 + idx * 0.15 }}
                  className={`absolute top-0 bottom-0 ${barColorClass} opacity-80`}
                />
              </div>
            </div>
          ))}
        </div>
        
        {data.metadata && (
          <div className="pt-5 mt-6 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-4">
              {data.metadata.map((meta, idx) => (
                <div key={idx} className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{meta.label}</span>
                  <span className="text-xs font-medium mt-1 truncate pr-2" style={{ color: 'var(--text-main)' }} title={meta.value}>{meta.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// =========================================
// 4. MAIN COMPONENT
// =========================================

export function ModelShowcase({ liveDataProp, isSuperAdmin }) {
  const [activeSide, setActiveSide] = useState('global');
  const [localData, setLocalData] = useState(null);
  const isLeft = activeSide === 'global';

  useEffect(() => {
    if (!liveDataProp) {
      axios.get('/api/hub/ml_metrics')
        .then(res => setLocalData(res.data))
        .catch(err => console.error("Failed to load live model metrics", err));
    }
  }, [liveDataProp]);

  const liveData = liveDataProp || localData;

  // Deep clone to safely inject live backend metrics
  const currentData = {
    ...BASE_PRODUCT_DATA[activeSide],
    features: BASE_PRODUCT_DATA[activeSide].features.map(f => ({ ...f })),
    stats: { ...BASE_PRODUCT_DATA[activeSide].stats }
  };

  if (liveData) {
    if (activeSide === 'global') {
      const base = liveData.baseline || {};
      const isBaseTrained = base.model_status === 'ready' || (base.accuracy && base.accuracy > 0);
      currentData.features[0].label = 'Base Accuracy';
      currentData.features[0].value = isBaseTrained && base.accuracy !== undefined ? Math.round(base.accuracy * 100) : 0;
      currentData.features[0].tooltip = 'Overall correctness of the universal model across all baseline records.';
      currentData.features[1].label = 'F1 Score';
      currentData.features[1].value = isBaseTrained && base.f1_score !== undefined ? Math.round(base.f1_score * 100) : 0;
      currentData.features[1].tooltip = 'Harmonic mean of precision and recall for the universal baseline dataset.';
      currentData.stats.connectionStatus = isBaseTrained ? 'Active' : 'Not Trained';
      if (!isBaseTrained) currentData.description = "No universal model trained yet. Run 'Train on Universal Data' to generate the baseline.";

      currentData.metadata = [
        { label: 'Algorithm', value: isBaseTrained ? 'Random Forest' : '—' },
        { label: 'Complexity', value: isBaseTrained ? `${base.total_trees || 0} Estimators` : '—' },
        { label: 'Training Volume', value: isBaseTrained ? `${(base.dataset_size || 0).toLocaleString()} records` : '—' },
        { label: 'Feature Space', value: isBaseTrained ? 'TF-IDF + Metadata' : '—' },
        { label: 'Classes', value: isBaseTrained ? 'S1, S2, S3, S4' : '—' },
        { label: 'Last Updated', value: isBaseTrained ? (base.last_trained || '—') : '—' }
      ];
    } else {
      const curr = liveData.current || {};
      const fb = liveData.feedback_stats || {};
      const isTrained = curr.model_source === 'company' || curr.model_status === 'ready';
      currentData.features[0].label = 'Precision';
      currentData.features[0].value = isTrained && curr.precision !== undefined ? Math.round(curr.precision * 100) : 0;
      currentData.features[0].tooltip = 'Measures the exactness of severity predictions on your isolated company data.';
      currentData.features[1].label = 'Recall';
      currentData.features[1].value = isTrained && curr.recall !== undefined ? Math.round(curr.recall * 100) : 0;
      currentData.features[1].tooltip = "Measures the model's ability to capture all relevant severity cases in your tenant.";
      currentData.stats.connectionStatus = isTrained ? 'Active' : 'Learning';
      if (!isTrained) currentData.description = "No company model trained yet. Start submitting corrections or bulk upload your dataset to build your isolated baseline.";
      
      const topWeakness = fb.weak_components?.[0]?.component || 'None identified';

      currentData.metadata = [
        { label: 'Feature Space', value: isTrained ? 'TF-IDF + Metadata' : '—' },
        { label: 'Top Weakness', value: topWeakness },
        { label: 'Training Volume', value: isTrained ? `${(curr.dataset_size || 0).toLocaleString()} records` : '—' },
        { label: 'Algorithm', value: isTrained ? 'Random Forest' : '—' },
        { label: 'Complexity', value: isTrained ? `${curr.total_trees || 0} Estimators` : '—' },
        { label: 'Last Updated', value: isTrained ? (curr.last_trained || '—') : '—' }
      ];
    }
  } else {
    currentData.metadata = [
      { label: 'Feature Space', value: 'Loading...' },
      { label: 'Top Weakness', value: 'Loading...' },
      { label: 'Training Volume', value: 'Loading...' },
      { label: 'Algorithm', value: 'Loading...' },
      { label: 'Complexity', value: 'Loading...' },
      { label: 'Last Updated', value: 'Loading...' }
    ];
  }

  return (
    <div className={`relative w-full rounded-3xl border overflow-hidden flex flex-col items-center py-16 mb-8 shadow-2xl ${isSuperAdmin ? '' : 'cursor-pointer'}`} style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--text-main)' }} onClick={() => !isSuperAdmin && setActiveSide(activeSide === 'global' ? 'tenant' : 'global')}>
      <BackgroundGradient isLeft={isLeft} />
      
      {!isSuperAdmin && (
        <div className="absolute top-6 flex items-center justify-center w-full z-20 text-xs font-bold uppercase tracking-widest bg-white/5 py-2 backdrop-blur-md border-y" style={{ color: 'var(--text-dim)', borderColor: 'var(--border)' }}>
          Click anywhere to compare architectures
        </div>
      )}

      <main className="relative z-10 w-full px-6 flex flex-col justify-center max-w-6xl mx-auto mt-6">
        <motion.div layout transition={{ type: 'spring', bounce: 0, duration: 0.9 }} className={`flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24 w-full ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
          <ProductVisual data={currentData} isLeft={isLeft} />
          <motion.div layout="position" className="w-full max-w-md">
            <AnimatePresence mode="wait">
              <ProductDetails key={activeSide} data={currentData} isLeft={isLeft} />
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}