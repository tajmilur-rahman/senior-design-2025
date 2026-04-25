import React, { useEffect, useRef, useState } from "react"
import { motion, useInView, AnimatePresence } from "framer-motion"
import { ArrowRight, ShieldCheck, Brain, BrainCircuit, CheckCircle, Star, GitFork, ExternalLink, Database, Layers, ArrowUp } from "lucide-react"
import { LiquidButton as Button } from "../liquid-glass-button"
import TechStackCarousel from "../tech-stack-carousel"
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

const GITHUB_REPO = "https://github.com/tajmilur-rahman/senior-design-2025"

function GithubIcon({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23A11.52 11.52 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

// Lightweight utility to merge classes 
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

// ============================================================================
// SCROLL GLITCH ANIMATION (From Reference Code)
// ============================================================================

function AnimatedScrollHeader({ title, subtitle, className, subtitleClassName }) {
  const lines = title.split('<br/>');
  let wordIndex = 0;

  return (
    <div>
      <h2 className={className}>
        {lines.map((line, lineIndex) => (
          <span key={lineIndex} className="block">
            {line.split(' ').map((word, wIndex) => {
              const currentIndex = wordIndex++;
              return (
                <motion.span
                  key={wIndex}
                  initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                  whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  viewport={{ once: true, margin: "0px 0px -15% 0px" }}
                  transition={{ duration: 0.6, delay: currentIndex * 0.06 + (currentIndex % 3) * 0.02, ease: "easeOut" }}
                  className="inline-block mr-[0.22em]"
                >
                  {word}
                </motion.span>
              );
            })}
          </span>
        ))}
      </h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: "0px 0px -15% 0px" }}
          transition={{ duration: 0.8, delay: wordIndex * 0.06 + 0.1, ease: "easeOut" }}
          className={subtitleClassName}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

// ============================================================================
// BUTTON & UTILS (Hoisted to prevent TDZ React crashes)
// ============================================================================

const SECTION_IDS = ['hero', 'platform', 'capabilities', 'architecture', 'documentation'];

const scrollTo = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ============================================================================
// ANIMATED LANDING NAVBAR (Framer Motion)
// ============================================================================

const navContainerVariants = {
  expanded: { y: 0, opacity: 1, width: "auto", transition: { y: { type: "spring", damping: 22, stiffness: 180 }, opacity: { duration: 0.4 }, type: "spring", damping: 26, stiffness: 200, staggerChildren: 0.06, delayChildren: 0.15 } },
  collapsed: { y: 0, opacity: 1, width: "3.5rem", transition: { type: "spring", damping: 26, stiffness: 200, when: "afterChildren", staggerChildren: 0.04, staggerDirection: -1 } },
};
const navItemVariants = {
  expanded: { opacity: 1, x: 0, scale: 1, transition: { type: "spring", damping: 15 } },
  collapsed: { opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.2 } },
};
const navLogoVariants = {
  expanded: { opacity: 1, x: 0, rotate: 0, transition: { type: "spring", damping: 15 } },
  collapsed: { opacity: 0, x: -25, rotate: -180, transition: { duration: 0.3 } },
};

function AnimatedLandingNav({ currentSection, onEnterWorkspace }) {
  const [isExpanded, setExpanded] = useState(true);
  const lastScrollY = useRef(0);
  const mouseLeaveTimeout = useRef(null);
  const clickStabilizeTimeout = useRef(null);
  const justClicked = useRef(false);

  const handleSectionClick = (id) => {
    justClicked.current = true;
    if (clickStabilizeTimeout.current) clearTimeout(clickStabilizeTimeout.current);
    clickStabilizeTimeout.current = setTimeout(() => { justClicked.current = false; }, 1200);
    scrollTo(id);
  };

  useEffect(() => {
    const handleScroll = () => {
      const latest = window.scrollY;
      const previous = lastScrollY.current;
      if (isExpanded && latest > previous && latest > 150 && !justClicked.current) setExpanded(false);
      else if (!isExpanded && latest < previous) setExpanded(true);
      lastScrollY.current = latest;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (clickStabilizeTimeout.current) clearTimeout(clickStabilizeTimeout.current);
    };
  }, [isExpanded]);

  const sections = [
    { label: 'Platform',      id: 'platform',      section: 2 },
    { label: 'Capabilities',  id: 'capabilities',  section: 3 },
    { label: 'Architecture',  id: 'architecture',  section: 4 },
    { label: 'Documentation', id: 'documentation', section: 5 },
  ];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] hidden md:block">
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={isExpanded ? "expanded" : "collapsed"}
        variants={navContainerVariants}
        onMouseEnter={() => {
          if (mouseLeaveTimeout.current) clearTimeout(mouseLeaveTimeout.current);
          setExpanded(true);
        }}
        onMouseLeave={() => {
          mouseLeaveTimeout.current = setTimeout(() => {
            if (lastScrollY.current > 150) setExpanded(false);
          }, 700);
        }}
        whileTap={!isExpanded ? { scale: 0.95 } : {}}
        onClick={(e) => { if (!isExpanded) { e.preventDefault(); setExpanded(true); } }}
        className={cn(
          "flex items-center overflow-hidden rounded-full border shadow-lg backdrop-blur-xl h-14",
          !isExpanded && "cursor-pointer justify-center"
        )}
        style={{ background: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <motion.div
          variants={navLogoVariants}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex-shrink-0 flex items-center text-xl font-extrabold tracking-tight pl-5 pr-4 text-white cursor-pointer transition-all hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
          onClick={(e) => { e.stopPropagation(); scrollTo('hero'); }}
        >
          Spot<span className="text-indigo-400">fixes</span>
        </motion.div>
        
        <motion.div className={cn("flex items-center gap-1 sm:gap-2 pr-4", !isExpanded && "pointer-events-none")}>
          {sections.map(({ label, id, section }) => {
            const isActive = currentSection === section;
            return (
              <motion.button key={id} variants={navItemVariants} onClick={(e) => { e.stopPropagation(); handleSectionClick(id); }} className={cn("relative group rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors", isActive ? "text-white" : "text-white/60 hover:text-white hover:bg-white/5")}>
                {isActive && <motion.div layoutId="active-landing-nav-pill" className="absolute inset-0 rounded-full bg-white/15" transition={{ type: 'spring', stiffness: 380, damping: 35 }} />}
                <span className="relative z-10">{label}</span>
              </motion.button>
            );
          })}
        </motion.div>

        <motion.div variants={navItemVariants} className={cn("flex items-center pl-1 pr-2", !isExpanded && "pointer-events-none hidden")}>
          <div className="w-px h-6 mx-2 bg-white/10" />
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onEnterWorkspace(); }}>
            Workspace <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </motion.div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white">
          <motion.div variants={{ expanded: { opacity: 0 }, collapsed: { opacity: 1 } }} animate={isExpanded ? "expanded" : "collapsed"}>
            <BrainCircuit className="h-5 w-5" />
          </motion.div>
        </div>
      </motion.nav>
    </div>
  );
}

// ============================================================================
// ARCHITECTURE MODAL
// ============================================================================

function ArchitectureModal({ onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const pillars = [
    {
      label: 'Intelligence',
      value: 'Random Forest',
      sub: '222k+ training records',
      icon: BrainCircuit,
      cls: 'border-emerald-500/30 from-emerald-500/20 to-emerald-500/5',
      accent: 'text-emerald-400',
    },
    {
      label: 'API',
      value: 'FastAPI + JWT',
      sub: 'Role-based access control',
      icon: ShieldCheck,
      cls: 'border-violet-500/30 from-violet-500/20 to-violet-500/5',
      accent: 'text-violet-400',
    },
    {
      label: 'Data',
      value: 'Postgres + RLS',
      sub: 'Per-tenant isolation',
      icon: Database,
      cls: 'border-blue-500/30 from-blue-500/20 to-blue-500/5',
      accent: 'text-blue-400',
    },
    {
      label: 'Client',
      value: 'React + Vite',
      sub: 'Real-time SPA',
      icon: Layers,
      cls: 'border-amber-500/30 from-amber-500/20 to-amber-500/5',
      accent: 'text-amber-400',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#080808] border border-white/10 rounded-[2rem] shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-8 pt-8 pb-6 bg-[#080808] border-b border-white/5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" />
              <span className="text-[11px] font-medium tracking-[0.06em] uppercase text-emerald-400">System Blueprint</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Spotfixes Architecture</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
          >
            ✕
          </button>
        </div>

        <div className="px-8 py-8 space-y-6">
          {/* Four pillars — confident, high-scannability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.label} className={`relative rounded-2xl border bg-gradient-to-br ${p.cls} p-6 overflow-hidden`}>
                  <div className={`flex items-center gap-2 mb-5 ${p.accent}`}>
                    <Icon size={16} />
                    <span className="text-[11px] font-bold uppercase tracking-widest">{p.label}</span>
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">{p.value}</div>
                  <div className="text-sm text-white/55 mt-1">{p.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Multi-tenancy — one tight callout */}
          <div className="bg-white/[0.06] border border-white/[0.12] rounded-2xl p-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-3">Multi-Tenant by Default</p>
            <p className="text-sm text-white/75 leading-relaxed">
              Every company runs on its own isolated Postgres table with Row-Level Security. The universal model trains on aggregate data; per-company models fine-tune on proprietary bugs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing({ onEnterWorkspace }) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState(1);
  const [showArch, setShowArch] = useState(false);
  const totalSections = 5;

  // --- THREE.JS & GSAP REFS ---
  const canvasRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const threeRefs = useRef({
    scene: null, camera: null, renderer: null, composer: null,
    stars: [], nebula: null, mountains: [], aurora: null, animationId: null,
    targetCameraX: 0, targetCameraY: 20, targetCameraZ: 300
  });

  // --- THREE.JS INITIALIZATION ---
  useEffect(() => {
    const initThree = () => {
      const refs = threeRefs.current;
      
      refs.scene = new THREE.Scene();
      refs.scene.fog = new THREE.FogExp2(0x03040f, 0.00022);

      refs.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
      refs.camera.position.set(0, 20, 300);

      refs.renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
      refs.renderer.setSize(window.innerWidth, window.innerHeight);
      refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      refs.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      refs.renderer.toneMappingExposure = 0.7;

      try {
        refs.composer = new EffectComposer(refs.renderer);
        refs.composer.addPass(new RenderPass(refs.scene, refs.camera));
        refs.composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.4, 0.5, 0.55));
      } catch {
        refs.composer = null;
      }

      // Stars — halve particle count on mobile for performance
      const starCount = window.innerWidth < 768 ? 2000 : 4000;
      for (let i = 0; i < 3; i++) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);
        for (let j = 0; j < starCount; j++) {
          const r = 200 + Math.random() * 1000;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(Math.random() * 2 - 1);
          pos[j*3] = r * Math.sin(phi) * Math.cos(theta);
          pos[j*3+1] = r * Math.sin(phi) * Math.sin(theta);
          pos[j*3+2] = r * Math.cos(phi);
          
          const c = new THREE.Color();
          const choice = Math.random();
          if (choice < 0.7) c.setHSL(0, 0, 0.8 + Math.random()*0.2);
          else if (choice < 0.9) c.setHSL(0.6, 0.5, 0.8);
          else c.setHSL(0.08, 0.5, 0.8);
          
          colors[j*3] = c.r; colors[j*3+1] = c.g; colors[j*3+2] = c.b;
          sizes[j] = Math.random() * 2 + 0.5;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const mat = new THREE.ShaderMaterial({
          uniforms: { time: { value: 0 }, depth: { value: i } },
          vertexShader: `
            attribute float size; attribute vec3 color; varying vec3 vColor;
            uniform float time; uniform float depth;
            void main() {
              vColor = color; vec3 p = position;
              float angle = time * 0.05 * (1.0 - depth * 0.3);
              mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
              p.xy = rot * p.xy;
              vec4 mvP = modelViewMatrix * vec4(p, 1.0);
              gl_PointSize = size * (300.0 / -mvP.z);
              gl_Position = projectionMatrix * mvP;
            }`,
          fragmentShader: `
            varying vec3 vColor;
            void main() {
              float d = length(gl_PointCoord - vec2(0.5));
              if (d > 0.5) discard;
              gl_FragColor = vec4(vColor, 1.0 - smoothstep(0.0, 0.5, d));
            }`,
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
        });
        const stars = new THREE.Points(geo, mat);
        refs.scene.add(stars);
        refs.stars.push(stars);
      }

      // Mountains — distinct silhouette layers from near-black to deep indigo-blue
      const layers = [
        { distance: 0,     height: 60,  color: 0x05050d, opacity: 1.0  },
        { distance: -400,  height: 80,  color: 0x0b0e22, opacity: 0.95 },
        { distance: -800,  height: 100, color: 0x0e1840, opacity: 0.85 },
        { distance: -1200, height: 120, color: 0x112054, opacity: 0.65 },
        { distance: -1600, height: 140, color: 0x0d1a42, opacity: 0.45 },
      ];
      layers.forEach((layer) => {
        const pts = [];
        for (let i = 0; i <= 50; i++) {
          const x = (i / 50 - 0.5) * 4000;
          const y = Math.sin(i * 0.1) * layer.height + Math.sin(i * 0.05) * layer.height * 0.5 + Math.random() * layer.height * 0.2 - 100;
          pts.push(new THREE.Vector2(x, y));
        }
        pts.push(new THREE.Vector2(2000, -500), new THREE.Vector2(-2000, -500));
        const mtn = new THREE.Mesh(
          new THREE.ShapeGeometry(new THREE.Shape(pts)),
          new THREE.MeshBasicMaterial({ color: layer.color, transparent: true, opacity: layer.opacity, side: THREE.DoubleSide })
        );
        mtn.position.z = layer.distance;
        refs.scene.add(mtn);
        refs.mountains.push(mtn);
      });

      // Aurora — horizon glow sitting just above the mountain ridges
      const auroraGeo = new THREE.PlaneGeometry(4000, 200, 1, 1);
      const auroraMat = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color1: { value: new THREE.Color(0x2255ff) },
          color2: { value: new THREE.Color(0x7722ff) },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
          varying vec2 vUv; uniform float time; uniform vec3 color1; uniform vec3 color2;
          void main() {
            float alpha = sin(vUv.y * 3.14159) * 0.45;
            float hFade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
            alpha *= hFade;
            float w1 = sin(vUv.x * 5.0 + time * 0.35) * 0.07;
            float w2 = sin(vUv.x * 11.0 - time * 0.25) * 0.04;
            alpha = max(0.0, alpha * (1.0 + w1 + w2));
            float colorShift = sin(time * 0.18) * 0.3;
            vec3 color = mix(color1, color2, clamp(vUv.x + colorShift, 0.0, 1.0));
            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const auroraPlane = new THREE.Mesh(auroraGeo, auroraMat);
      auroraPlane.position.set(0, 5, -850);
      refs.scene.add(auroraPlane);
      refs.aurora = auroraPlane;

      const animate = () => {
        refs.animationId = requestAnimationFrame(animate);
        const t = Date.now() * 0.001;
        refs.stars.forEach(s => { if (s.material.uniforms) s.material.uniforms.time.value = t; });
        if (refs.aurora) refs.aurora.material.uniforms.time.value = t;
        
        if (refs.camera) {
          refs.camera.position.x += (refs.targetCameraX - refs.camera.position.x) * 0.05 + Math.sin(t * 0.1) * 0.1;
          refs.camera.position.y += (refs.targetCameraY - refs.camera.position.y) * 0.05 + Math.cos(t * 0.15) * 0.05;
          refs.camera.position.z += (refs.targetCameraZ - refs.camera.position.z) * 0.05;
          refs.camera.lookAt(0, 10, -1000);
        }
        
        refs.mountains.forEach((m, i) => {
          m.position.x = Math.sin(t * 0.1) * 2 * (1 + i * 0.5);
        });
        if (refs.composer) refs.composer.render();
        else if (refs.renderer) refs.renderer.render(refs.scene, refs.camera);
      };
      animate();
    };

    initThree();

    const handleResize = () => {
      const refs = threeRefs.current;
      if (refs.camera && refs.renderer) {
        refs.camera.aspect = window.innerWidth / window.innerHeight;
        refs.camera.updateProjectionMatrix();
        refs.renderer.setSize(window.innerWidth, window.innerHeight);
        if (refs.composer) refs.composer.setSize(window.innerWidth, window.innerHeight);
      }
    };

    const handleMouseMove = (e) => {
      const refs = threeRefs.current;
      refs.targetCameraX = ((e.clientX / window.innerWidth) - 0.5) * 45;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      const refs = threeRefs.current;
      if (refs.animationId) cancelAnimationFrame(refs.animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      refs.stars.forEach(s => { s.geometry.dispose(); s.material.dispose(); });
      refs.mountains.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
      if (refs.aurora) { refs.aurora.geometry.dispose(); refs.aurora.material.dispose(); }
      if (refs.renderer) refs.renderer.dispose();
    };
  }, []);

  const splitTitle = (text) => text.split('').map((char, i) => (
    <motion.span
      key={i}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      whileHover={{ scale: 1.15, color: '#818cf8', textShadow: '0 0 25px rgba(129,140,248,0.6)' }}
      transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="inline-block title-char whitespace-pre cursor-pointer"
    >
      {char}
    </motion.span>
  ));

  // Scroll progress bar
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;
      const maxScroll = documentHeight - windowHeight;
      const progress = maxScroll > 0 ? Math.min(Math.max(scrollY / maxScroll, 0), 1) : 0;
      setScrollProgress(progress);
      // Move camera deep into mountains based on scroll
      if (threeRefs.current.camera) {
        threeRefs.current.targetCameraZ = 300 - (progress * 1100);
        threeRefs.current.targetCameraY = 20 + (progress * 40);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Section detection via IntersectionObserver — no boundary flicker
  useEffect(() => {
    const observers = SECTION_IDS.map((id, idx) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setCurrentSection(idx + 1); },
        { threshold: 0.4 }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  return (
    <div className="relative w-full bg-black text-white selection:bg-white/20 font-sans">
      {showArch && <ArchitectureModal onClose={() => setShowArch(false)} />}

      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-0 pointer-events-none" style={{ background: '#03040f' }} />

      <AnimatedLandingNav currentSection={currentSection} onEnterWorkspace={onEnterWorkspace} />

      {/* Mobile Navbar Fallback */}
      <nav className="fixed top-0 left-0 right-0 z-50 w-full bg-black/10 backdrop-blur-xl border-b border-white/10 transition-all">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 md:hidden">
          <div className="relative flex h-16 items-center justify-between">
            <div className="flex items-center cursor-pointer flex-shrink-0 transition-transform hover:scale-105 active:scale-95" onClick={() => scrollTo('hero')}>
              <span className="text-2xl font-extrabold tracking-tight text-white hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all">
                Spot<span className="text-indigo-400">fixes</span>
              </span>
            </div>
            <div className="flex-shrink-0">
              <Button size="sm" onClick={onEnterWorkspace}>
                Enter Workspace
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

          </div>
        </div>
      </nav>

      {/* Scroll Progress Indicator */}
      <div className="fixed right-6 lg:right-12 top-1/2 -translate-y-1/2 flex flex-col items-center gap-6 z-50 hidden md:flex pointer-events-none">
        <div className="text-[11px] font-bold tracking-[0.2em] text-white/40 uppercase" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Scroll</div>
        <div className="w-[2px] h-32 bg-white/10 relative rounded-full overflow-hidden">
          <div className="absolute top-0 left-0 w-full bg-white transition-all duration-150 ease-out" style={{ height: `${scrollProgress * 100}%` }} />
        </div>
        <div className="text-[11px] font-bold font-mono text-white/40">
          {String(currentSection).padStart(2, '0')} / {String(totalSections).padStart(2, '0')}
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="relative z-10 flex flex-col w-full">
        
        {/* SECTION 1: HERO */}
        <section id="hero" className="min-h-screen w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-20 relative">
          {/* Radial vignette so hero text reads cleanly over the 3D scene */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 90% 70% at 50% 50%, transparent 35%, rgba(0,0,0,0.6) 100%)' }} />
          {/* Bottom fade into next section */}
          <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none bg-gradient-to-t from-black/60 to-transparent" />
          <div className="max-w-4xl text-center w-full relative z-10">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center rounded-full bg-white/[0.10] backdrop-blur-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/95">
              <ShieldCheck className="mr-2 h-4 w-4 text-indigo-300" />
              Enterprise Bug Triage Engine
            </div>

            {/* Main Heading (Animated by Framer Motion) */}
            <h1 className="mb-6 text-4xl font-bold tracking-tighter text-white sm:text-7xl lg:text-8xl flex flex-wrap justify-center overflow-hidden">
              {splitTitle("SPOTFIXES")}
            </h1>

            {/* Subtitle */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
              className="mb-10 text-center"
            >
              <p className="subtitle-line text-xl leading-relaxed text-white/85 sm:text-2xl max-w-2xl mx-auto font-medium">
                Predict. Classify. Resolve.
              </p>
              <p className="subtitle-line text-lg leading-relaxed text-white/60 max-w-2xl mx-auto mt-3">
                Automated severity classification & duplicate detection.
              </p>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.9, type: "spring", stiffness: 200, damping: 15 }}
              className="hero-btn flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
            >
              <Button size="lg" className="shadow-2xl shadow-white/25 font-semibold" onClick={onEnterWorkspace}>
                Enter Workspace
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="font-semibold bg-transparent" onClick={() => setShowArch(true)}>
                View Architecture
              </Button>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-3 max-w-2xl mx-auto rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04] backdrop-blur-sm divide-x divide-white/10">
              {[
                { value: '222k+', label: 'Training Records' },
                { value: '< 1s',  label: 'Prediction Latency' },
                { value: 'S1–S4', label: 'Auto-Classification' },
              ].map((s) => (
                <div key={s.label} className="text-center px-4 py-6 sm:px-8 sm:py-7">
                  <div className="text-3xl sm:text-4xl font-bold text-white mb-1.5">{s.value}</div>
                  <div className="text-white/55 text-xs sm:text-sm font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 2: PLATFORM */}
        <section id="platform" className="min-h-screen w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 border-t border-white/[0.08] relative py-24">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/10 to-transparent pointer-events-none" />
          <div className="max-w-5xl w-full relative z-10">
            <div className="text-center mb-16">
              <div className="mb-5 inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/25 px-4 py-1.5 text-xs text-blue-300 font-bold uppercase tracking-widest">
                Platform
              </div>
              <AnimatedScrollHeader
                title="The bug triage workspace<br/>for product teams."
                subtitle="Submit, classify, and resolve — in one place."
                className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
                subtitleClassName="text-xl md:text-2xl text-white/70 leading-relaxed max-w-2xl mx-auto"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { badge: 'Severity Analysis',   title: 'ML Classification',      desc: 'S1–S4 predictions in under a second. Trained on 222k+ real Firefox reports.',  color: 'text-blue-300',   hoverBorder: 'hover:border-blue-400/40',   glow: 'group-hover:from-blue-500/8'   },
                { badge: 'Duplicate Detection', title: 'Semantic Search',         desc: 'Vector embeddings check every new report against your full bug history.',       color: 'text-purple-300', hoverBorder: 'hover:border-purple-400/40', glow: 'group-hover:from-purple-500/8' },
                { badge: 'Multi-Tenancy',       title: 'Tenant Isolation',        desc: 'Each company runs on its own Postgres table with Row-Level Security.',          color: 'text-emerald-300',hoverBorder: 'hover:border-emerald-400/40',glow: 'group-hover:from-emerald-500/8'},
                { badge: 'Access Control',      title: 'Role-Based Permissions',  desc: 'User, Admin, and Super Admin tiers with invite flows and approval queues.',     color: 'text-amber-300',  hoverBorder: 'hover:border-amber-400/40',  glow: 'group-hover:from-amber-500/8'  },
                { badge: 'Bulk Ingestion',      title: 'CSV & JSON Import',       desc: 'Upload thousands of records at once. Each entry classified on arrival.',        color: 'text-pink-300',   hoverBorder: 'hover:border-pink-400/40',   glow: 'group-hover:from-pink-500/8'   },
                { badge: 'Resolution',          title: 'Fix Surfacing',           desc: 'Retrieve resolved duplicates and the fixes that shipped with them.',            color: 'text-cyan-300',   hoverBorder: 'hover:border-cyan-400/40',   glow: 'group-hover:from-cyan-500/8'   },
              ].map((f, i) => (
                <div key={i} className={`group relative bg-white/[0.06] backdrop-blur-sm border border-white/[0.12] rounded-2xl p-7 transition-all duration-300 hover:bg-white/[0.10] hover:-translate-y-0.5 hover:shadow-xl ${f.hoverBorder}`}>
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br from-transparent to-transparent ${f.glow} transition-all duration-300 pointer-events-none`} />
                  <div className={`text-xs font-bold uppercase tracking-widest mb-4 ${f.color}`}>{f.badge}</div>
                  <h3 className="text-white font-bold text-xl mb-3 tracking-tight leading-snug">{f.title}</h3>
                  <p className="text-white/65 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: CAPABILITIES */}
        <section id="capabilities" className="min-h-screen w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 border-t border-white/[0.08] relative py-24">
           <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent pointer-events-none" />
           <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center relative z-10">
              <div className="text-left">
                 <div className="mb-5 inline-flex items-center rounded-full bg-purple-500/10 border border-purple-500/25 px-4 py-1.5 text-xs text-purple-300 font-bold uppercase tracking-widest">
                   Capabilities
                 </div>
                 <AnimatedScrollHeader
                   title="A model that learns from your team."
                   subtitle="Corrections feed back into training. Accuracy improves every review cycle."
                   className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
                   subtitleClassName="text-xl text-white/70 leading-relaxed mb-10"
                 />
                 <ul className="space-y-5">
                   {[
                     'TF-IDF n-gram feature extraction',
                     'Vector RAG duplicate detection',
                     'Feedback-driven model retraining',
                   ].map((item) => (
                     <li key={item} className="flex items-center gap-4 text-lg text-white/85 bg-white/[0.04] border border-white/[0.10] rounded-xl px-5 py-4 backdrop-blur-sm">
                       <CheckCircle size={20} className="text-purple-400 flex-shrink-0" />
                       {item}
                     </li>
                   ))}
                 </ul>
              </div>
              <div className="bg-white/[0.06] border border-white/[0.15] rounded-3xl aspect-square flex items-center justify-center relative overflow-hidden backdrop-blur-md shadow-2xl p-10">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-500/20 via-purple-900/5 to-transparent pointer-events-none" />
                 {/* Decorative rings */}
                 <div className="absolute w-48 h-48 rounded-full border border-purple-500/15 pointer-events-none" />
                 <div className="absolute w-64 h-64 rounded-full border border-purple-500/10 pointer-events-none" />
                 <div className="absolute w-80 h-80 rounded-full border border-purple-500/5 pointer-events-none" />
                 <Brain size={120} className="text-purple-400/60 relative z-10" />
              </div>
           </div>
        </section>

        {/* SECTION 4: ARCHITECTURE */}
        <section id="architecture" className="min-h-screen w-full flex flex-col items-center justify-center px-0 border-t border-white/[0.08] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-900/10 to-transparent pointer-events-none" />
          <div className="w-full text-center relative z-10 py-24">
             <div className="mb-5 inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/25 px-4 py-1.5 text-xs text-emerald-300 font-bold uppercase tracking-widest">
               Architecture & Stack
             </div>
             <AnimatedScrollHeader
               title="Built with enterprise tools."
               subtitle="FastAPI and Supabase Postgres. Row-Level Security enforced per tenant."
               className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 px-6"
               subtitleClassName="text-xl text-white/70 leading-relaxed max-w-2xl mx-auto mb-16 px-6"
             />
             
             <TechStackCarousel />

             <div className="mt-16 px-6">
                 <Button size="lg" className="shadow-2xl shadow-white/10 font-semibold" onClick={() => scrollTo('documentation')}>
                   View Documentation <ArrowRight className="ml-2 h-5 w-5" />
                 </Button>
             </div>
          </div>
        </section>

        {/* SECTION 5: DOCUMENTATION */}
        <section id="documentation" className="min-h-screen w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 border-t border-white/[0.08] relative pb-24 pt-24">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/10 to-transparent pointer-events-none" />
          <div className="max-w-4xl w-full relative z-10">
             <div className="text-center mb-14">
               <div className="mb-5 inline-flex items-center rounded-full bg-white/[0.08] border border-white/15 px-4 py-1.5 text-xs text-white/70 font-bold uppercase tracking-widest">
                 Open Source
               </div>
               <AnimatedScrollHeader
                 title="Read the source."
                 subtitle="ML pipeline, backend, and frontend — all in one repository."
                 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
                 subtitleClassName="text-xl text-white/70 leading-relaxed max-w-xl mx-auto"
               />
             </div>

             {/* GitHub Open Source Banner */}
             <div className="mt-16 relative group">
               <div className="absolute -inset-px rounded-[2rem] bg-gradient-to-r from-white/15 via-white/8 to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
               <div className="relative bg-white/[0.07] border border-white/[0.15] rounded-[2rem] p-8 lg:p-12 overflow-hidden backdrop-blur-sm">

                 {/* Background glow */}
                 <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-white/8 via-transparent to-transparent pointer-events-none" />
                 <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                 <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">

                   {/* Left — text */}
                   <div className="flex items-start gap-5 flex-1">
                     <div className="w-14 h-14 rounded-2xl bg-white/[0.10] border border-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                       <GithubIcon size={24} className="text-white" />
                     </div>
                     <div>
                       <div className="flex items-center gap-3 mb-3">
                         <span className="text-[11px] font-bold uppercase tracking-widest text-white/55 border border-white/15 bg-white/[0.06] px-3 py-1 rounded-full">Open Source</span>
                       </div>
                       <h3 className="text-2xl font-bold text-white tracking-tight mb-2">Built in the open.</h3>
                       <p className="text-base text-white/65 leading-relaxed max-w-lg">
                         Full source — ML pipeline, backend, frontend. Fork and contribute.
                       </p>
                       <div className="flex flex-wrap items-center gap-4 mt-5">
                         <div className="flex items-center gap-1.5 text-white/55 text-xs font-medium">
                           <Star size={13} className="text-amber-400" />
                           <span className="font-mono">Open Source</span>
                         </div>
                         <div className="w-px h-3 bg-white/15" />
                         <div className="flex items-center gap-1.5 text-white/55 text-xs font-medium">
                           <GitFork size={13} className="text-blue-400" />
                           <span className="font-mono">Fork &amp; Contribute</span>
                         </div>
                         <div className="w-px h-3 bg-white/15" />
                         <div className="flex items-center gap-1.5 text-white/55 text-xs font-mono">
                           tajmilur-rahman / senior-design-2025
                         </div>
                       </div>
                     </div>
                   </div>

                   {/* Right — CTA buttons */}
                   <div className="flex flex-col sm:flex-row lg:flex-col gap-3 flex-shrink-0">
                     <a
                       href={GITHUB_REPO}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="flex items-center justify-center gap-2.5 bg-white text-black hover:bg-zinc-100 font-bold text-sm px-7 py-3.5 rounded-2xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_35px_rgba(255,255,255,0.25)] hover:-translate-y-0.5"
                     >
                       <GithubIcon size={16} />
                       View on GitHub
                     </a>
                     <a
                       href={`${GITHUB_REPO}/archive/refs/heads/main.zip`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="flex items-center justify-center gap-2 bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 hover:border-white/25 text-white/75 hover:text-white font-semibold text-sm px-7 py-3.5 rounded-2xl transition-all hover:-translate-y-0.5"
                     >
                       <ExternalLink size={14} />
                       Download ZIP
                     </a>
                   </div>

                 </div>
               </div>
             </div>

          </div>
        </section>

        {/* SECTION 6: TEAM CREDITS */}
        <section className="w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 border-t border-white/[0.08] relative py-24">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-900/10 to-transparent pointer-events-none" />
          <div className="max-w-4xl w-full relative z-10">

            {/* Header */}
            <div className="text-center mb-16">
              <div className="mb-5 inline-flex items-center rounded-full bg-indigo-500/10 border border-indigo-500/25 px-4 py-1.5 text-xs text-indigo-300 font-bold uppercase tracking-widest">
                Senior Design Project · 2025-26
              </div>
              <AnimatedScrollHeader
                title="Gannon University"
                subtitle="Erie, Pennsylvania"
                className="text-4xl md:text-5xl font-bold tracking-tight mb-3"
                subtitleClassName="text-white/55 text-lg"
              />
            </div>

            {/* Team Members */}
            <div className="mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-white/40 text-center mb-7">Built and developed by</p>
              <div className="flex flex-wrap justify-center gap-4">
                {['Amartuvshin Ganzorig', 'Anunjin Batdelger', 'Koshi Yuasa'].map((name) => (
                  <div key={name} className="bg-white/[0.08] border border-white/[0.15] rounded-2xl px-8 py-5 text-center backdrop-blur-sm hover:bg-white/[0.12] hover:-translate-y-0.5 transition-all duration-200">
                    <div className="text-white font-bold text-xl tracking-tight">{name}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Faculty + Advisors — 3-column grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/[0.06] border border-white/[0.12] rounded-2xl p-7 hover:bg-white/[0.09] transition-all duration-200">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-5">Faculty Mentor</p>
                <div className="text-white font-bold text-xl">Dr. Tajmilur Rahman</div>
              </div>

              <div className="bg-white/[0.06] border border-white/[0.12] rounded-2xl p-7 hover:bg-white/[0.09] transition-all duration-200">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-5">Senior Design Professors</p>
                <div className="space-y-3">
                  <div className="text-white font-bold text-xl">Dr. Mei-Huei Tang</div>
                  <div className="text-white font-bold text-xl">Dr. Richard Matovu</div>
                </div>
              </div>

              <div className="bg-white/[0.06] border border-white/[0.12] rounded-2xl p-7 hover:bg-white/[0.09] transition-all duration-200">
                <p className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-5">Mozilla Firefox · Guidance</p>
                <div className="space-y-3">
                  <div className="text-white font-bold text-xl">Marco Castelluccio</div>
                  <div className="text-white font-bold text-xl">Suhaib Mujahid</div>
                </div>
              </div>
            </div>

          </div>
        </section>

      </div>

      {/* Back to Top Button */}
      <AnimatePresence>
        {scrollProgress > 0.15 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => scrollTo('hero')}
            className="fixed bottom-8 right-6 lg:right-10 z-[100] p-3.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-xl shadow-2xl transition-all hover:-translate-y-1"
            title="Back to top"
          >
            <ArrowUp size={20} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
