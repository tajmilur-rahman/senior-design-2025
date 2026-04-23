import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export const MultipleSelect = ({ tags, value = [], onChange }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        left: containerRef.current.scrollWidth,
        behavior: 'smooth',
      });
    }
  }, [value]);

  const onSelect = (item) => {
    onChange([...value, item.key]);
  };

  const onDeselect = (item) => {
    onChange(value.filter((k) => k !== item.key));
  };

  const selectedTags = value.map(k => tags.find(t => t.key === k)).filter(Boolean);
  const unselectedTags = tags.filter(t => !value.includes(t.key));

  return (
    <AnimatePresence mode="popLayout">
      <div className="flex flex-col gap-3 w-full">
        {selectedTags.length > 0 && (
          <motion.div
            layout
            ref={containerRef}
            className="flex w-full items-center overflow-x-auto custom-scrollbar rounded-xl border border-white/10 bg-black/20 p-2 min-h-[52px]"
          >
            <motion.div layout className="flex items-center gap-2">
              {selectedTags.map((item) => (
                <motion.div
                  layout
                  layoutId={`tag-${item.key}`}
                  key={item.key}
                  onClick={() => onDeselect(item)}
                  className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-widest border transition-all hover:brightness-110"
                  style={{ background: `${item.dot}18`, borderColor: `${item.dot}50`, color: item.dot }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.dot, boxShadow: `0 0 8px ${item.dot}80` }} />
                  <motion.span layout className="whitespace-nowrap">{item.label}</motion.span>
                  <X size={14} className="ml-1 opacity-70 hover:opacity-100" />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
        
        {unselectedTags.length > 0 && (
          <motion.div layout className="flex w-full flex-wrap gap-2">
            {unselectedTags.map((item) => (
              <motion.div
                layout
                layoutId={`tag-${item.key}`}
                key={item.key}
                onClick={() => onSelect(item)}
                className="flex items-center gap-2.5 cursor-pointer rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-all hover:bg-white/10"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-sec)' }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.dot, boxShadow: `0 0 8px ${item.dot}80` }} />
                <motion.span layout className="whitespace-nowrap">{item.label}</motion.span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
};