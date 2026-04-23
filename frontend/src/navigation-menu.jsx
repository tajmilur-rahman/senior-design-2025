import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";

// Lightweight utility to merge classes 
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const EXPAND_SCROLL_THRESHOLD = 80;

const containerVariants = {
  expanded: {
    y: 0,
    opacity: 1,
    width: "auto",
    transition: {
      y: { type: "spring", damping: 18, stiffness: 250 },
      opacity: { duration: 0.3 },
      type: "spring",
      damping: 20,
      stiffness: 300,
      staggerChildren: 0.07,
      delayChildren: 0.2,
    },
  },
  collapsed: {
    y: 0,
    opacity: 1,
    width: "auto",
    transition: {
      type: "spring",
      damping: 20,
      stiffness: 300,
      when: "afterChildren",
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const itemVariants = {
  expanded: { opacity: 1, scale: 1 },
  collapsed: { opacity: 1, scale: 1 },
};

const labelVariants = {
  expanded: { opacity: 1, width: "auto", display: "block", transition: { type: "spring", damping: 20, stiffness: 250 } },
  collapsed: { opacity: 0, width: 0, transitionEnd: { display: "none" }, transition: { duration: 0.2 } },
};

export function AnimatedNavFramer({ navItems = [], currentTab, onNavigate, rightActions, onBack, canGoBack }) {
  const [isExpanded, setExpanded] = useState(false);
  const isHovered = useRef(false);
  const collapseTimeout = useRef(null);
  
  const lastScrollY = useRef(0);
  const scrollPositionOnCollapse = useRef(0);

  useEffect(() => {
    const scrollContainer = document.querySelector('.main-scroll');
    if (!scrollContainer) return;

    const handleScroll = () => {
      const latest = scrollContainer.scrollTop;
      const previous = lastScrollY.current;

      if (collapseTimeout.current) clearTimeout(collapseTimeout.current);

      if (latest > previous && latest > 50) {
        if (!isHovered.current) setExpanded(false);
        scrollPositionOnCollapse.current = latest; 
      } else if (latest < previous && (scrollPositionOnCollapse.current - latest > EXPAND_SCROLL_THRESHOLD)) {
        setExpanded(true);
        collapseTimeout.current = setTimeout(() => {
          if (!isHovered.current) setExpanded(false);
        }, 2000);
      }
      lastScrollY.current = latest;
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (collapseTimeout.current) clearTimeout(collapseTimeout.current);
    };
  }, []);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] hidden md:block">
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={isExpanded ? "expanded" : "collapsed"}
        variants={containerVariants}
        onMouseEnter={() => {
          isHovered.current = true;
          setExpanded(true);
        }}
        onMouseLeave={() => { 
          isHovered.current = false;
          setExpanded(false); 
        }}
        whileTap={!isExpanded ? { scale: 0.95 } : {}}
        className={cn(
          "flex items-center rounded-full border shadow-lg backdrop-blur-xl h-12 relative transition-all"
        )}
        style={{ background: 'var(--nav-bg)', borderColor: 'var(--border)' }}
      >
        <motion.div variants={itemVariants} className="flex-shrink-0 flex items-center gap-2 font-semibold pl-3 pr-2" style={{ color: 'var(--text-main)' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onBack(); }}
            disabled={!canGoBack}
            className={cn("flex items-center justify-center w-7 h-7 rounded-full border transition-all", canGoBack ? "bg-white/5 border-white/10 hover:bg-white/15 cursor-pointer" : "bg-transparent border-transparent opacity-30 cursor-not-allowed")}
          >
            <ChevronLeft size={14} />
          </button>
          <motion.div variants={labelVariants} className="overflow-hidden whitespace-nowrap flex items-center">
            <span className="text-lg font-extrabold tracking-tight cursor-pointer transition-all hover:scale-105 hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" onClick={(e) => { e.stopPropagation(); onNavigate('overview'); }}>Spot<span className="text-indigo-400">fixes</span></span>
          </motion.div>
        </motion.div>
        
        <motion.div className="flex items-center px-1 sm:px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <motion.button key={item.id} variants={itemVariants} onClick={(e) => { e.stopPropagation(); onNavigate(item.id); }} className={cn("relative group rounded-full px-3 py-1.5 text-sm font-medium flex items-center whitespace-nowrap transition-colors", isActive ? "" : "hover:bg-white/5 opacity-70 hover:opacity-100")} style={{ color: 'var(--text-main)' }}>
                {isActive && <motion.div layoutId="active-framer-nav-pill" className="absolute inset-0 rounded-full" style={{ background: 'var(--hover-bg)' }} transition={{ type: 'spring', stiffness: 380, damping: 35 }} />}
                {Icon && <Icon size={14} className="relative z-10 flex-shrink-0" />}
                <motion.div variants={labelVariants} className="relative z-10 overflow-hidden flex items-center">
                  <span className="ml-1.5">{item.label}</span>
                </motion.div>
              </motion.button>
            );
          })}
        </motion.div>

        {rightActions && (
          <motion.div variants={itemVariants} className="flex items-center pl-1 pr-2">
            <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />
            {rightActions}
          </motion.div>
        )}
      </motion.nav>
    </div>
  );
}