import React from "react";
import { ChevronLeft } from "lucide-react";

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function AnimatedNavFramer({ navItems = [], currentTab, onNavigate, rightActions, onBack, canGoBack }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] hidden md:block">
      <nav
        className="flex items-center rounded-full border shadow-lg backdrop-blur-xl h-16 relative"
        style={{ background: 'var(--nav-bg)', borderColor: 'var(--border)' }}
      >
        <div className="flex-shrink-0 flex items-center gap-3 font-semibold pl-4 pr-3" style={{ color: 'var(--text-main)' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onBack(); }}
            disabled={!canGoBack}
            className={cn("flex items-center justify-center w-9 h-9 rounded-full border transition-all", canGoBack ? "bg-white/5 border-white/10 hover:bg-white/15 cursor-pointer" : "bg-transparent border-transparent opacity-30 cursor-not-allowed")}
          >
            <ChevronLeft size={18} />
          </button>
          <span
            className="text-xl font-extrabold tracking-widest uppercase cursor-pointer transition-all hover:scale-105 hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
            onClick={(e) => { e.stopPropagation(); onNavigate('overview'); }}
          >
            SPOTFIXES
          </span>
        </div>

        <div className="flex items-center px-1 sm:px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={(e) => { e.stopPropagation(); onNavigate(item.id); }}
                className={cn(
                  "relative group rounded-full px-4 py-2.5 text-base font-semibold flex items-center whitespace-nowrap transition-colors",
                  isActive ? "" : "hover:bg-white/5 opacity-70 hover:opacity-100"
                )}
                style={{ color: 'var(--text-main)' }}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-full" style={{ background: 'var(--hover-bg)' }} />
                )}
                {Icon && <Icon size={18} className="relative z-10 flex-shrink-0" />}
                <span className="relative z-10 ml-1.5">{item.label}</span>
              </button>
            );
          })}
        </div>

        {rightActions && (
          <div className="flex items-center pl-2 pr-3">
            <div className="w-px h-7 mx-2" style={{ background: 'var(--border)' }} />
            {rightActions}
          </div>
        )}
      </nav>
    </div>
  );
}
