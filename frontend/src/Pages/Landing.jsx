import React, { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion"
import {
  ArrowRight, ShieldCheck, BrainCircuit, CheckCircle,
  Star, GitFork, ExternalLink, Database, Layers,
  ArrowUp, Target, Copy, BarChart3, Box,
} from "lucide-react"
import TechStackCarousel from "../tech-stack-carousel"
import { DottedSurface } from "../Components/ui/dotted-surface"

const GITHUB_REPO = "https://github.com/tajmilur-rahman/senior-design-2025"

// ROG Astral signature gradient: magenta → white → cyan
const ROG_GRADIENT = 'linear-gradient(90deg, #fa67ff, #ffffff, #7ef9ff)'
// Diagonal bottom-right corner cut — ROG card motif
const DIAG_CUT = 'polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)'
const DIAG_CUT_LG = 'polygon(0 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%)'

function GithubIcon({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23A11.52 11.52 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

export function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

// ─── SaaS-style Button ───────────────────────────────────────────────────────
// Primary: white fill, dark text — clean contrast on dark bg
// Outline: white border, white text, transparent bg

function ROGButton({ children, onClick, variant = 'primary', size = 'md', className = '', href, target }) {
  const sizes = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-sm',
  }
  const base = cn(
    'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 select-none',
    sizes[size],
    variant === 'primary'
      ? 'bg-white text-black hover:bg-white/90 shadow-sm hover:shadow-md'
      : 'bg-transparent text-white border border-white/25 hover:bg-white/[0.08] hover:border-white/40',
    className
  )
  if (href) return (
    <a href={href} target={target} rel="noopener noreferrer" className={base}>{children}</a>
  )
  return <button onClick={onClick} className={base}>{children}</button>
}

// ─── Gradient-text section label ─────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.25em] mb-4 text-white">
      {children}
    </p>
  )
}

// ─── Animated word-by-word heading ───────────────────────────────────────────

function AnimatedScrollHeader({ title, subtitle, className, subtitleClassName }) {
  const lines = title.split('<br/>')
  let wordIndex = 0
  return (
    <div>
      <h2 className={className}>
        {lines.map((line, li) => (
          <span key={li} className="block">
            {line.split(' ').map((word, wi) => {
              const idx = wordIndex++
              return (
                <motion.span
                  key={wi}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                  transition={{ duration: 0.6, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-block mr-[0.2em] text-white"
                >
                  {word}
                </motion.span>
              )
            })}
          </span>
        ))}
      </h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: wordIndex * 0.04 + 0.1, ease: [0.16, 1, 0.3, 1] }}
          className={subtitleClassName}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  )
}

// ─── ROG-style image frame / placeholder ─────────────────────────────────────
// Uses diagonal bottom-right cut and gradient top border

function ROGFrame({ src, alt, className = '', children }) {
  return (
    <div
      className={cn('relative overflow-hidden flex items-center justify-center', className)}
      style={{
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)'
      }}
    >
      {src ? (
        <>
          <img src={src} alt={alt} className="w-full h-full object-cover" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), transparent 30%, transparent 65%, rgba(0,0,0,0.4))' }}
          />
          {children}
        </>
      ) : (
        <>
          {/* subtle grid for placeholder */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,255,255,0.08), transparent 70%)' }} />
          <div className="absolute inset-0 flex items-center justify-center p-8 z-10">
            {children}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Interactive image card — mouse tilt + scan-line ─────────────────────────
function ImageCard({ src, alt, accent, className = '', children }) {
  const ref = useRef(null)
  const rotX = useMotionValue(0)
  const rotY = useMotionValue(0)
  const sc   = useMotionValue(1)
  const springX = useSpring(rotX, { stiffness: 180, damping: 26 })
  const springY = useSpring(rotY, { stiffness: 180, damping: 26 })
  const springSc = useSpring(sc,   { stiffness: 180, damping: 26 })
  const [over, setOver] = useState(false)

  const onMove = (e) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    rotX.set(((e.clientY - r.top)  / r.height - 0.5) * -9)
    rotY.set(((e.clientX - r.left) / r.width  - 0.5) *  9)
  }
  const onEnter = () => { setOver(true);  sc.set(1.025) }
  const onLeave = () => { setOver(false); rotX.set(0); rotY.set(0); sc.set(1) }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ rotateX: springX, rotateY: springY, scale: springSc, perspective: '900px', transformStyle: 'preserve-3d' }}
      className="cursor-default"
    >
      <ROGFrame src={src} alt={alt} accent={accent} className={className}>
        {/* Scan-line sweep — lives inside ROGFrame so it's clipped by clipPath */}
        <motion.div
          className="absolute inset-0 pointer-events-none overflow-hidden z-30"
          animate={{ opacity: over ? 1 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="absolute left-0 right-0"
            style={{ height: '45%', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.07) 50%, transparent)' }}
            animate={over ? { y: ['-100%', '260%'] } : { y: '-100%' }}
            transition={over ? { duration: 2, ease: 'linear', repeat: Infinity, repeatDelay: 0.5 } : { duration: 0 }}
          />
        </motion.div>
        {children}
      </ROGFrame>
    </motion.div>
  )
}

// ─── Architecture Modal ───────────────────────────────────────────────────────

const SECTION_IDS = ['hero', 'platform', 'capabilities', 'architecture', 'documentation']
const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

function ArchitectureModal({ onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const pillars = [
    { label: 'Intelligence', value: 'Random Forest',  sub: '222k+ training records',    icon: BrainCircuit },
    { label: 'API Layer',    value: 'FastAPI + JWT',   sub: 'Role-based access control', icon: ShieldCheck  },
    { label: 'Data Core',   value: 'Postgres + RLS',  sub: 'Per-tenant isolation',      icon: Database     },
    { label: 'Frontend',    value: 'React + Vite',    sub: 'Real-time SPA',             icon: Layers       },
  ]

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 24 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#06030f] border border-white/10"
        style={{ clipPath: DIAG_CUT_LG, boxShadow: '0 0 80px rgba(142,59,255,0.15)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: ROG_GRADIENT }} />

        <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-white/8">
          <div>
            <SectionLabel>System Blueprint</SectionLabel>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Spotfixes Architecture</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-white/15 bg-white/5 hover:bg-white/12 flex items-center justify-center text-white/50 hover:text-white transition-all text-sm"
          >✕</button>
        </div>

        <div className="px-8 py-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {pillars.map((p, i) => {
              const Icon = p.icon
              const accents = ['#fa67ff', '#7ef9ff', '#8e3bff', '#55f7ff']
              const acc = accents[i]
              return (
                <div
                  key={p.label}
                  className="relative bg-white/[0.03] border border-white/8 p-6"
                  style={{ clipPath: DIAG_CUT }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: acc }} />
                  <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: acc }}>
                    <Icon size={13} />{p.label}
                  </div>
              <div className="text-xl font-extrabold text-white tracking-tight">{p.value}</div>
              <div className="text-sm text-white/70 mt-1">{p.sub}</div>
                </div>
              )
            })}
          </div>
          <div className="bg-white/[0.03] border border-white/8 p-6" style={{ clipPath: DIAG_CUT }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3 text-white">Multi-Tenant by Default</p>
            <p className="text-sm text-white/70 leading-relaxed">
              Every company runs on its own isolated Postgres table with Row-Level Security. The universal model trains on aggregate data; per-company models fine-tune on proprietary bugs.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Landing Nav ──────────────────────────────────────────────────────────────
// Always-visible centered pill — no retract on scroll

function AnimatedLandingNav({ currentSection, onEnterWorkspace }) {
  const sections = [
    { label: 'Platform',     id: 'platform',      section: 2 },
    { label: 'Engine',       id: 'capabilities',  section: 3 },
    { label: 'Architecture', id: 'architecture',  section: 4 },
    { label: 'Source',       id: 'documentation', section: 5 },
  ]

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] hidden md:block">
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="flex items-center h-12 px-2 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-xl gap-1"
      >
        {/* Logo */}
        <div
          className="flex-shrink-0 pl-3 pr-3 cursor-pointer"
          onClick={() => scrollTo('hero')}
        >
          <span className="text-sm font-bold tracking-wide text-white">
            Spotfixes
          </span>
        </div>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {sections.map(({ label, id, section }) => {
            const active = currentSection === section
            return (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="relative px-3 py-1.5 text-xs font-medium transition-colors duration-150 rounded-lg"
                style={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.5)' }}
              >
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-lg bg-white/10"
                    transition={{ type: 'spring', stiffness: 380, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            )
          })}
        </div>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* CTA */}
        <div className="pr-1">
          <ROGButton size="sm" onClick={onEnterWorkspace}>
            Sign in <ArrowRight className="ml-1.5 h-3 w-3" />
          </ROGButton>
        </div>
      </motion.nav>
    </div>
  )
}

// ─── Main Landing ─────────────────────────────────────────────────────────────

export default function Landing({ onEnterWorkspace }) {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [currentSection, setCurrentSection] = useState(1)
  const [showArch, setShowArch] = useState(false)
  const totalSections = 5

  // Scroll progress
  useEffect(() => {
    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const progress  = maxScroll > 0 ? Math.min(Math.max(window.scrollY / maxScroll, 0), 1) : 0
      setScrollProgress(progress)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Section detection
  useEffect(() => {
    const obs = SECTION_IDS.map((id, i) => {
      const el = document.getElementById(id)
      if (!el) return null
      const o = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setCurrentSection(i + 1) },
        { threshold: 0.4 }
      )
      o.observe(el)
      return o
    })
    return () => obs.forEach(o => o?.disconnect())
  }, [])

  // Per-character animated hero title
  const splitTitle = (text, customStyle = {}) =>
    text.split('').map((char, i) => (
      <motion.span
        key={i}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
        className="inline-block whitespace-pre"
        style={customStyle}
      >
        {char}
      </motion.span>
    ))

  const features = [
    { badge: 'Severity Analysis',   title: 'ML Classification',     desc: 'S1–S4 predictions in under a second. Trained on 222k+ real Firefox reports.',   icon: BarChart3,   accent: '#fa67ff' },
    { badge: 'Duplicate Detection', title: 'Semantic Search',        desc: 'Vector embeddings check every new report against your full bug history.',         icon: Copy,        accent: '#7ef9ff' },
    { badge: 'Multi-Tenancy',       title: 'Tenant Isolation',       desc: 'Each company runs on its own Postgres table with Row-Level Security.',             icon: ShieldCheck, accent: '#8e3bff' },
    { badge: 'Access Control',      title: 'Role-Based Permissions', desc: 'User, Admin, and Super Admin tiers with invite flows and approval queues.',        icon: Target,      accent: '#55f7ff' },
    { badge: 'Bulk Ingestion',      title: 'CSV & JSON Import',      desc: 'Upload thousands of records at once. Each entry classified on arrival.',           icon: Box,         accent: '#a383ff' },
    { badge: 'Resolution Surfacing', title: 'Fix Surfacing',         desc: 'Retrieve resolved duplicates and the fixes that shipped with them.',               icon: CheckCircle, accent: '#fc00ff' },
  ]

  return (
    <div
      className="relative w-full bg-black text-white"
      style={{ '--selection-bg': '#030000', '--selection-color': '#a9bcdf', fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`::selection { background: #030000; color: #a9bcdf; }`}</style>

      <AnimatePresence>
        {showArch && <ArchitectureModal onClose={() => setShowArch(false)} />}
      </AnimatePresence>

      {/* Animated dotted surface background */}
      <DottedSurface className="z-0" />

      {/* Deep vignette + color wash over dots */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 35%, rgba(0,0,0,0.65) 100%)' }}
      />
      {/* Subtle magenta-cyan gradient bloom at center */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(142,59,255,0.12) 0%, transparent 70%)' }}
      />

      <AnimatedLandingNav currentSection={currentSection} onEnterWorkspace={onEnterWorkspace} />

      {/* Mobile nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/85 backdrop-blur-2xl border-b border-white/8 md:hidden">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex h-16 items-center justify-between">
            <span className="text-base font-extrabold tracking-wide uppercase cursor-pointer text-white" onClick={() => scrollTo('hero')}>
              SPOTFIXES
            </span>
            <ROGButton size="sm" onClick={onEnterWorkspace}>
              Access <ArrowRight className="ml-1 h-3 w-3" />
            </ROGButton>
          </div>
        </div>
      </nav>

      {/* Scroll progress indicator */}
      <div className="fixed right-6 lg:right-12 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-50 hidden md:flex pointer-events-none">
        <div className="text-[10px] font-extrabold tracking-[0.3em] text-white/50 uppercase" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          System State
        </div>
        <div className="w-px h-32 bg-white/10 relative overflow-visible">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[3px] transition-all duration-100 ease-out"
            style={{ height: `${Math.max(scrollProgress * 100, 5)}%`, background: ROG_GRADIENT, boxShadow: '0 0 10px #fa67ff, 0 0 20px #7ef9ff' }}
          />
        </div>
        <div className="text-[11px] font-extrabold text-white/80 font-mono">
          {String(currentSection).padStart(2,'0')} <span className="text-white/40">/ {String(totalSections).padStart(2,'0')}</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="relative z-10 flex flex-col w-full">

        {/* ── SECTION 1: HERO ──────────────────────────────────────── */}
        <section id="hero" className="min-h-dvh w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-32 lg:pt-40 relative">
          <div
            className="absolute bottom-0 left-0 right-0 h-60 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}
          />

          <div className="max-w-6xl w-full mx-auto relative z-10 flex flex-col items-center text-center">

              {/* Left: text */}
            <div className="w-full flex flex-col items-center">
                {/* Eyebrow label */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}
                >
                  <SectionLabel>ML-Powered Bug Intelligence</SectionLabel>
                </motion.div>

                {/* Hero headline */}
              <h1 className="text-5xl sm:text-7xl lg:text-[8rem] font-extrabold tracking-tighter uppercase mb-6 leading-[1.1] pb-2 flex flex-wrap flex-shrink-0 items-baseline justify-center" style={{ textShadow: '0 0 40px rgba(250,103,255,0.15)', textRendering: 'optimizeLegibility' }}>
                  <div className="flex text-white">
                    {splitTitle('SPOTFIXES')}
                  </div>
                </h1>

                {/* Tagline */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.6, ease: [0.16,1,0.3,1] }}
                className="mb-10 flex flex-col items-center"
                >
                <p className="text-2xl sm:text-3xl font-medium text-white mb-4 tracking-tight leading-snug">
                    From report to resolution —{' '}
                    <span className="text-white">in under a second.</span>
                  </p>
                <p className="text-lg sm:text-xl text-white/80 leading-relaxed max-w-2xl font-medium" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
                    Severity classification and duplicate detection, powered by a
                    Random Forest model trained on 222k+ real Mozilla Firefox reports.
                    Built for engineering teams that ship fast.
                  </p>
                </motion.div>

                {/* CTAs */}
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.75, ease: [0.16,1,0.3,1] }}
                className="flex flex-wrap justify-center gap-5 mb-16"
                >
                  <ROGButton size="lg" onClick={onEnterWorkspace}>
                    Start Triaging <ArrowRight className="ml-2 h-4 w-4" />
                  </ROGButton>
                  <ROGButton variant="outline" size="lg" onClick={() => setShowArch(true)}>
                    View Architecture
                  </ROGButton>
                </motion.div>

                {/* Spec metrics */}
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.9, ease: [0.16,1,0.3,1] }}
                className="grid grid-cols-3 gap-px bg-white/8 border border-white/8 overflow-hidden w-full max-w-4xl mx-auto"
                  style={{ clipPath: DIAG_CUT }}
                >
                  {[
                    { value: '222K+', label: 'Training Records' },
                    { value: '< 1s',  label: 'Inference Time'   },
                    { value: 'S1–S4', label: 'Severity Classes' },
                  ].map((s) => (
                    <div key={s.label} className="relative text-center px-4 py-6 bg-black">
                      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: '#ffffff', opacity: 0.2 }} />
                      <div className="text-2xl sm:text-4xl font-extrabold tracking-tighter mb-1 font-mono text-white">{s.value}</div>
                      <div className="text-xs font-bold text-white/60 uppercase tracking-widest">{s.label}</div>
                    </div>
                  ))}
                </motion.div>
              </div>

          </div>
        </section>

        {/* ── SECTION 2: PLATFORM ──────────────────────────────────── */}
        <section id="platform" className="min-h-dvh w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 border-t border-white/[0.06] relative py-32 lg:py-40">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(142,59,255,0.04) 0%, transparent 70%)' }}
          />
          <div className="max-w-7xl w-full relative z-10">

            {/* Tech background lines */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5 pointer-events-none hidden lg:block" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 pointer-events-none hidden lg:block" />

            <div className="text-center mb-16">
              <SectionLabel>Core Platform</SectionLabel>
              <AnimatedScrollHeader
                title="Every capability your team<br/>needs to ship confidently."
            subtitle="Classify, deduplicate, and route bugs — automatically, on every submission. Complete visibility and control."
            className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight text-white"
            subtitleClassName="text-xl text-white/80 leading-relaxed max-w-3xl mx-auto font-normal"
              />
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {features.map((f, i) => {
                const Icon = f.icon
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16,1,0.3,1] }}
                    className="relative bg-white/[0.04] border border-white/8 p-8 group cursor-default transition-all duration-300 hover:bg-white/[0.07] hover:-translate-y-1 hover:border-white/14 shadow-sm hover:shadow-xl"
                    style={{ clipPath: DIAG_CUT }}
                  >
                    {/* gradient top border */}
                    <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${f.accent}, transparent)` }} />

                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center mb-5"
                      style={{ background: f.accent + '18' }}
                    >
                      <Icon size={20} style={{ color: f.accent }} />
                    </div>

                    <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: f.accent }}>{f.badge}</p>
                    <h3 className="text-white font-bold text-xl mb-2 tracking-tight">{f.title}</h3>
                    <p className="text-white/70 text-base leading-relaxed">{f.desc}</p>
                  </motion.div>
                )
              })}
            </div>

          </div>
        </section>

        {/* ── SECTION 3: CAPABILITIES ──────────────────────────────── */}
        <section id="capabilities" className="min-h-dvh w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 border-t border-white/[0.06] relative py-32 lg:py-40">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(250,103,255,0.04) 0%, transparent 70%)' }}
          />
          <div className="max-w-7xl w-full relative z-10">
            <div className="max-w-3xl">
              <SectionLabel>Adaptive ML Engine</SectionLabel>
              <AnimatedScrollHeader
                title="Accuracy that compounds<br/>with every review cycle."
                subtitle="Human corrections feed directly into retraining. Your model gets smarter every sprint."
                className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-8 leading-tight text-white"
                subtitleClassName="text-xl text-white/80 leading-relaxed mb-12 font-normal"
              />

              <ul className="space-y-5">
                {[
                  { text: 'TF-IDF n-gram feature extraction',      accent: '#fa67ff' },
                  { text: 'Vector RAG duplicate detection',         accent: '#7ef9ff' },
                  { text: 'Feedback-driven model retraining',       accent: '#8e3bff' },
                  { text: '222k+ Mozilla Firefox training records', accent: '#55f7ff' },
                ].map((item) => (
                  <li
                    key={item.text}
                    className="flex items-center gap-4 text-base font-bold text-white/90 border border-white/8 bg-white/[0.03] px-6 py-5 transition-all hover:bg-white/[0.06]"
                    style={{ clipPath: DIAG_CUT }}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: item.accent, boxShadow: `0 0 8px ${item.accent}` }}
                    />
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── SECTION 4: ARCHITECTURE ──────────────────────────────── */}
        <section id="architecture" className="min-h-dvh w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 border-t border-white/[0.06] relative py-32 lg:py-40">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(85,247,255,0.03) 0%, transparent 70%)' }}
          />
          <div className="max-w-7xl w-full relative z-10">

            <div className="mb-24">
              <div className="text-center mb-12">
                <SectionLabel>Infrastructure</SectionLabel>
                <AnimatedScrollHeader
                  title="Enterprise-grade stack,<br/>zero ops overhead."
                  subtitle="FastAPI on the edge. Supabase Postgres with Row-Level Security enforced per tenant by default. Maximum scalability."
                  className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight text-white"
                  subtitleClassName="text-xl text-white/80 leading-relaxed max-w-3xl mx-auto font-normal"
                />
              </div>

              {/* Tenant isolation status */}
              <div className="max-w-sm mx-auto">
                <ImageCard
                  src={null}
                  alt="Tenant isolation status"
                  accent="linear-gradient(90deg, #00CB07, #7ef9ff)"
                  className="h-44"
                >
                  <div className="text-center">
                    <CheckCircle size={34} className="mx-auto mb-2" style={{ color: '#42ca42', filter: 'drop-shadow(0 0 12px #00CB07)' }} />
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#42ca42' }}>Secure Isolation</p>
                    <p className="text-[12px] font-medium text-white/70">Row-Level Security · Active</p>
                  </div>
                </ImageCard>
              </div>
            </div>

            {/* Tech stack */}
            <div className="text-center mb-10">
              <SectionLabel>Technology Matrix</SectionLabel>
            </div>
            <TechStackCarousel />

            <div className="mt-16 text-center">
              <ROGButton size="lg" onClick={() => scrollTo('documentation')}>
                View Documentation <ArrowRight className="ml-2 h-4 w-4" />
              </ROGButton>
            </div>
          </div>
        </section>

        {/* ── SECTION 5: DOCUMENTATION ─────────────────────────────── */}
        <section id="documentation" className="min-h-dvh w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 border-t border-white/[0.06] relative py-32 lg:py-40">
          <div className="max-w-5xl w-full relative z-10">

            <div className="text-center mb-14">
              <SectionLabel>Open Source</SectionLabel>
              <AnimatedScrollHeader
                title="Built in the open."
              subtitle="ML pipeline, REST API, and React frontend — everything in one public repository for complete transparency."
              className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight text-white"
              subtitleClassName="text-xl text-white/80 leading-relaxed max-w-2xl mx-auto font-normal"
              />
            </div>

            {/* GitHub banner */}
            <div
              className="relative border border-white/10 bg-white/[0.03] p-8 lg:p-12 overflow-hidden group hover:bg-white/[0.05] transition-all duration-300"
              style={{ clipPath: DIAG_CUT_LG }}
            >
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: ROG_GRADIENT }} />
              <div
                className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(142,59,255,0.06), transparent 60%)' }}
              />

              <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
                <div className="flex items-start gap-5 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-white/8 border border-white/12 flex items-center justify-center flex-shrink-0">
                    <GithubIcon size={22} className="text-white" />
                  </div>
                  <div>
                    <div className="mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 border border-white/12 bg-white/5 px-3 py-1 rounded-full">
                        Open Source
                      </span>
                    </div>
                <h3 className="text-2xl font-extrabold text-white tracking-tight mb-3">Built in the Open.</h3>
                <p className="text-base text-white/80 leading-relaxed max-w-lg">
                      Full source — ML pipeline, backend, frontend. Fork and contribute.
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-5">
                  <div className="flex items-center gap-2 text-white/70 text-sm font-bold">
                        <Star size={12} style={{ color: '#ff9e1b' }} /> Open Source
                      </div>
                      <div className="w-px h-3 bg-white/15" />
                  <div className="flex items-center gap-2 text-white/70 text-sm font-bold">
                        <GitFork size={12} style={{ color: '#55f7ff' }} /> Fork & Contribute
                      </div>
                      <div className="w-px h-3 bg-white/15" />
                  <span className="text-white/50 text-sm font-bold">tajmilur-rahman / senior-design-2025</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col gap-4 flex-shrink-0">
                  <ROGButton href={GITHUB_REPO} target="_blank" size="md">
                    <GithubIcon size={14} className="mr-2" /> View on GitHub
                  </ROGButton>
                  <ROGButton href={`${GITHUB_REPO}/archive/refs/heads/main.zip`} target="_blank" variant="outline" size="md">
                    <ExternalLink size={13} className="mr-2" /> Download ZIP
                  </ROGButton>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 6: TEAM CREDITS ──────────────────────────────── */}
        <section className="w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 border-t border-white/[0.06] relative py-32 lg:py-40">
          <div className="max-w-6xl w-full relative z-10">

            <div className="text-center mb-16">
              <SectionLabel>Senior Design Project · 2025-26</SectionLabel>
              <AnimatedScrollHeader
                title="Gannon University"
              subtitle="Erie, Pennsylvania — Senior Design 2025"
              className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 leading-tight text-white"
              subtitleClassName="text-white/70 text-lg font-medium"
              />
            </div>

            {/* Team */}
            <div className="mb-10">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/50 text-center mb-8">
                Built and developed by
              </p>
              <div className="flex flex-wrap justify-center gap-6">
                {['Amartuvshin Ganzorig', 'Anunjin Batdelger', 'Koshi Yuasa'].map((name, i) => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: i * 0.08, ease: [0.16,1,0.3,1] }}
                    className="relative border border-white/10 bg-white/[0.04] px-8 py-5 text-center transition-all duration-300 hover:bg-white/[0.08] hover:-translate-y-1 group cursor-default"
                    style={{ clipPath: DIAG_CUT }}
                  >
                    <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: ROG_GRADIENT }} />
                  <div className="text-white font-bold text-lg tracking-wide">{name}</div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Faculty / advisors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {[
                { label: 'Faculty Mentor',         accent: '#ff9e1b', names: ['Dr. Tajmilur Rahman'] },
                { label: 'Design Professors',      accent: '#8e3bff', names: ['Dr. Mei-Huei Tang', 'Dr. Richard Matovu'] },
                { label: 'Mozilla · Guidance',     accent: '#fa67ff', names: ['Marco Castelluccio', 'Suhaib Mujahid'] },
              ].map((col, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.08, ease: [0.16,1,0.3,1] }}
                  className="relative border border-white/8 bg-white/[0.03] p-7 transition-all hover:bg-white/[0.06]"
                  style={{ clipPath: DIAG_CUT }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: col.accent }} />
                  <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: col.accent }}>{col.label}</p>
                  <div className="space-y-3">
                    {col.names.map((n) => (
                    <div key={n} className="text-white font-bold text-lg">{n}</div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

          </div>
        </section>

      </div>

      {/* Back to top */}
      <AnimatePresence>
        {scrollProgress > 0.12 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16,1,0.3,1] }}
            onClick={() => scrollTo('hero')}
            className="fixed bottom-8 right-6 lg:right-10 z-[100] p-3.5 bg-white/[0.08] border border-white/[0.12] text-white hover:bg-white/[0.14] transition-all duration-200 hover:-translate-y-1"
            style={{
              borderRadius: '50%',
              boxShadow: '0 0 0 0px rgba(250,103,255,0)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(250,103,255,0.3)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0px rgba(250,103,255,0)' }}
            title="Back to top"
          >
            <ArrowUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
