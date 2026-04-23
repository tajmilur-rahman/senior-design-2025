import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

function useMouseGlow(ref) {
    useEffect(() => {
        const item = ref.current;
        if (!item) return;
        const handleMouseMove = (e) => {
            const rect = item.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            item.style.setProperty('--mouse-x', `${x}px`);
            item.style.setProperty('--mouse-y', `${y}px`);
        };
        item.addEventListener('mousemove', handleMouseMove);
        return () => item.removeEventListener('mousemove', handleMouseMove);
    }, [ref]);
}

export const BentoCard = React.forwardRef(({ className = '', children, ...props }, ref) => {
    const internalRef = useRef(null);
    const resolvedRef = ref || internalRef;
    useMouseGlow(resolvedRef);

    return (
        <div
            ref={resolvedRef}
            className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md transition-all group hover:border-white/20 ${className}`}
            {...props}
        >
            <div
                className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
                style={{ background: 'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.06), transparent 40%)' }}
            />
            <div className="relative z-10 h-full w-full">{children}</div>
        </div>
    );
});

export const MotionBentoCard = motion(BentoCard);