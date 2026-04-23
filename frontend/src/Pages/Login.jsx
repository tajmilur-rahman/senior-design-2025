import { useState, useEffect, useRef, forwardRef, memo } from 'react';
import {
  ShieldCheck, CheckCircle, Mail, Lock, ArrowRight,
  Eye, EyeOff, Building2, User, ChevronDown
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import axios from 'axios';
import { LiquidButton as Button } from '../liquid-glass-button';
import { motion, useAnimation, useInView, useMotionTemplate, useMotionValue } from 'framer-motion';
import * as THREE from 'three';
import TechStackCarousel from '../tech-stack-carousel';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BentoCard } from '../bento-card';

// Lightweight utility to merge classes
function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

// ==================== Glowing Input Component ====================
const GlowingInput = memo(
  forwardRef(function GlowingInput({ className, type, icon, ...props }, ref) {
    const radius = useMotionValue(0);
    const [showPassword, setShowPassword] = useState(false);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }) {
      const { left, top } = currentTarget.getBoundingClientRect();
      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    }

    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    // Safely isolated to only process MotionValue objects (fixes the dark screen crash)
    const bgTemplate = useMotionTemplate`radial-gradient(${radius}px circle at ${mouseX}px ${mouseY}px, var(--accent-ring, rgba(99,102,241,0.32)), transparent 80%)`;

    return (
      <motion.div
        style={{ background: bgTemplate }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => radius.set(100)}
        onMouseLeave={() => radius.set(0)}
        className="group/input relative rounded-[16px] p-[1px] transition duration-300 w-full"
      >
        <div className="relative flex items-center w-full rounded-[15px] bg-[#09090b] border border-white/10 focus-within:border-indigo-500/50 focus-within:bg-[#0c0c10] overflow-hidden backdrop-blur-md transition-colors shadow-inner">
          {icon && <div className="absolute left-4 text-white/30 pointer-events-none flex items-center justify-center group-focus-within/input:text-indigo-400 transition-colors">{icon}</div>}
          <input
            type={inputType}
            className={cn(
              "flex w-full bg-transparent px-4 py-4 text-white placeholder:text-white/20 focus:outline-none text-sm transition-all font-medium",
              icon ? "pl-11" : "pl-4",
              isPassword ? "pr-12" : "pr-4",
              className
            )}
            ref={ref}
            {...props}
          />
          {isPassword && (
            <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
              className="absolute right-4 text-white/30 hover:text-white transition-colors flex items-center justify-center p-1">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
      </motion.div>
    );
  })
);

// ==================== BoxReveal Component ====================
const BoxReveal = memo(function BoxReveal({ children, width = 'fit-content', boxColor, duration, className, overflow = 'hidden' }) {
  const mainControls = useAnimation();
  const slideControls = useAnimation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      slideControls.start('visible');
      mainControls.start('visible');
    }
  }, [isInView, mainControls, slideControls]);

  return (
    <div ref={ref} style={{ position: 'relative', width, overflow }} className={className}>
      <motion.div
        variants={{ hidden: { opacity: 0, y: 75 }, visible: { opacity: 1, y: 0 } }}
        initial="hidden"
        animate={mainControls}
        transition={{ duration: duration ?? 0.5, delay: 0.25 }}
      >
        {children}
      </motion.div>
      <motion.div
        variants={{ hidden: { left: 0 }, visible: { left: '100%' } }}
        initial="hidden"
        animate={slideControls}
        transition={{ duration: duration ?? 0.5, ease: 'easeIn' }}
        style={{
          position: 'absolute', top: 4, bottom: 4, left: 0, right: 0, zIndex: 20,
          background: boxColor ?? 'var(--accent)',
        }}
      />
    </div>
  );
});

const BottomGradient = () => (
  <>
    <span className="group-hover:opacity-100 block transition-opacity duration-500 opacity-0 absolute h-px w-full -bottom-px inset-x-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
    <span className="group-hover:opacity-100 blur-sm block transition-opacity duration-500 opacity-0 absolute h-px w-1/2 mx-auto -bottom-px inset-x-10 bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
  </>
);

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
        className={triggerClassName || `h-[54px] flex items-center justify-between px-5 border rounded-[15px] cursor-pointer text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-indigo-500/30 ${open ? 'border-indigo-500/50 bg-black/60 text-white' : 'bg-black/40 border-white/10 text-white/40 hover:border-white/20'}`}>
        <span className={`truncate pr-2 tracking-wide ${selected ? 'text-white' : ''}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div id={listId} role="listbox" ref={listRef} aria-label={ariaLabel || placeholder} className={`absolute z-[9999] w-full border border-white/10 rounded-[15px] shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-200 ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'}`} style={{ backgroundColor: 'var(--bg-elevated)', backdropFilter: 'blur(16px)' }}>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              return (<div key={opt.value} role="option" aria-selected={isSelected} onClick={() => commit(i)} onMouseEnter={() => setActiveIdx(i)} className={`px-5 py-3 text-[13px] font-semibold tracking-wide cursor-pointer transition-colors mx-2 my-0.5 rounded-[10px] ${isSelected ? 'bg-indigo-500/15 text-indigo-400' : i === activeIdx ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>{opt.label}</div>);
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Login({ onLogin, forceResetRecovery = false, onResetDone = null, onBack = null, forceInviteSetup = false, onInviteSetupDone = null }) {
  const [mode, setMode]                       = useState('login');
  const [viewState, setViewState]             = useState('form');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName]         = useState('');
  const [username, setUsername]               = useState('');
  const [registerRole, setRegisterRole]       = useState('user');
  const [mfaCode, setMfaCode]                 = useState('');
  const [msg, setMsg]                         = useState('');
  const [isLoading, setIsLoading]             = useState(false);
  const [isRecovery, setIsRecovery]           = useState(false);
  const [inviteViewState, setInviteViewState] = useState('form'); // 'form' | 'success'

  const [reqCompanyId, setReqCompanyId]         = useState('');
  const [companies, setCompanies]               = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // --- THREE.JS REFS ---
  const canvasRef = useRef(null);
  const threeRefs = useRef({
    scene: null, camera: null, renderer: null, composer: null,
    stars: [], nebula: null, mountains: [], animationId: null,
    targetCameraX: 0, targetCameraY: 20, targetCameraZ: 300
  });

  // --- THREE.JS INITIALIZATION ---
  useEffect(() => {
    const initThree = () => {
      const refs = threeRefs.current;
      
      refs.scene = new THREE.Scene();
      refs.scene.fog = new THREE.FogExp2(0x000000, 0.00025);

      refs.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
      refs.camera.position.set(0, 20, 300);

      refs.renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
      refs.renderer.setSize(window.innerWidth, window.innerHeight);
      refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      refs.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      refs.renderer.toneMappingExposure = 0.5;

      refs.composer = new EffectComposer(refs.renderer);
      refs.composer.addPass(new RenderPass(refs.scene, refs.camera));
      refs.composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.4, 0.85));

      // Stars
      const starCount = 4000;
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

      // Mountains
      const layers = [
        { distance: 0, height: 60, color: 0x1a1a2e, opacity: 1 },
        { distance: -400, height: 80, color: 0x16213e, opacity: 0.8 },
        { distance: -800, height: 100, color: 0x0f3460, opacity: 0.6 },
        { distance: -1200, height: 120, color: 0x0a4668, opacity: 0.4 },
        { distance: -1600, height: 140, color: 0x072a44, opacity: 0.3 }
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

      const animate = () => {
        refs.animationId = requestAnimationFrame(animate);
        const t = Date.now() * 0.001;
        refs.stars.forEach(s => { if (s.material.uniforms) s.material.uniforms.time.value = t; });
        
        if (refs.camera) {
          // Smoothly orbit camera for login screen
          refs.targetCameraX = Math.sin(t * 0.2) * 30;
          refs.targetCameraY = 20 + Math.cos(t * 0.15) * 10;
          refs.targetCameraZ = 200 + Math.sin(t * 0.05) * 40;

          refs.camera.position.x += (refs.targetCameraX - refs.camera.position.x) * 0.05;
          refs.camera.position.y += (refs.targetCameraY - refs.camera.position.y) * 0.05;
          refs.camera.position.z += (refs.targetCameraZ - refs.camera.position.z) * 0.05;
          refs.camera.lookAt(0, 10, -1000);
        }
        
        refs.mountains.forEach((m, i) => {
          m.position.x = Math.sin(t * 0.1) * 2 * (1 + i * 0.5);
        });
        if (refs.composer) refs.composer.render();
      };
      animate();
    };

    initThree();
    const handleResize = () => {
      const refs = threeRefs.current;
      if (refs.camera && refs.renderer && refs.composer) {
        refs.camera.aspect = window.innerWidth / window.innerHeight;
        refs.camera.updateProjectionMatrix();
        refs.renderer.setSize(window.innerWidth, window.innerHeight);
        refs.composer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      const refs = threeRefs.current;
      if (refs.animationId) cancelAnimationFrame(refs.animationId);
      window.removeEventListener('resize', handleResize);
      refs.stars.forEach(s => { s.geometry.dispose(); s.material.dispose(); });
      refs.mountains.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
      if (refs.renderer) refs.renderer.dispose();
    };
  }, []);

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode('reset');
        setViewState('form');
        setIsRecovery(true);
        if (session?.user?.email) setEmail(session.user.email);
        setMsg("Recovery session active. Please enter your new password.");
      }
    });
  }, []);

  useEffect(() => {
    if (!forceResetRecovery) return;
    setMode('reset');
    setViewState('form');
    setIsRecovery(true);
    setMsg('Recovery session active. Please enter your new password.');
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setEmail(data.user.email);
    }).catch(() => {});
  }, [forceResetRecovery]);

  useEffect(() => {
    if (!forceInviteSetup) return;
    // Pre-fill email from the current invite session
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setEmail(data.user.email);
    }).catch(() => {});
  }, [forceInviteSetup]);

  useEffect(() => {
    if (mode !== 'register' || registerRole !== 'user') return;
    if (companies.length > 0) return;
    setLoadingCompanies(true);
    axios.get('/api/invite/companies')
      .then(r => setCompanies(r.data || []))
      .catch(() => setCompanies([]))
      .finally(() => setLoadingCompanies(false));
  }, [mode, registerRole]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setMsg("");

    if ((mode === 'register' || isRecovery) && password !== confirmPassword) {
      setMsg("Passwords don't match."); setIsLoading(false); return;
    }
    if (mode === 'register' && registerRole === 'admin' && !companyName.trim()) {
      setMsg("Please enter a company name."); setIsLoading(false); return;
    }
    if (mode === 'register' && !username.trim()) {
      setMsg("Please enter a display name."); setIsLoading(false); return;
    }

    try {
      if (mode === 'login') {
        const normalizedEmail = email.trim().toLowerCase();
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;

        const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
        if (factorError) throw factorError;

        if (factors?.totp?.length > 0) {
          setViewState('mfa_challenge');
        } else {
          onLogin(data.user);
        }

      } else if (mode === 'register') {
        const normalizedEmail = email.trim().toLowerCase();

        try {
          await axios.post('/api/register', {
            company_name: companyName.trim(),
            username:     username.trim(),
            email:        normalizedEmail,
            uuid:         "",
            role:         'admin',
            invite_code:  '',
            password:     password,
          });
        } catch (regErr) {
          const detail = regErr.response?.data?.detail || '';
          if (!detail.includes('Already registered') && !detail.includes('already taken')) {
            console.warn('[register] backend note:', detail);
          }
        }

        setViewState('success');

      } else if (mode === 'reset') {
        if (isRecovery) {
          const { error } = await supabase.auth.updateUser({ password: password });
          if (error) throw error;
          setMsg("Password updated successfully!");
          setIsRecovery(false);
          setTimeout(() => {
            if (onResetDone) onResetDone();
            switchTo('login');
          }, 3000);
        } else {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
          });
          if (error) throw error;
          setMsg("Reset link sent to your email.");
          setTimeout(() => switchTo('login'), 4000);
        }
      }
    } catch (err) {
      const errMsg = err?.message || 'Something went wrong. Please try again.';
      if (mode === 'login' && /invalid login credentials/i.test(errMsg)) {
        setMsg('Invalid email or password. If your account was recently approved, check your email for an invite link to set your password.');
      } else {
        setMsg(errMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const verifyMfa = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factorId = factors.totp[0].id;

      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: mfaCode,
      });

      if (error) throw error;
      
      const { data: { user } } = await supabase.auth.getUser();
      onLogin(user);
    } catch {
      setMsg('Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestAccess = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!username.trim() || !normalizedEmail || !password || !reqCompanyId) {
      setMsg('Please fill in all fields.'); return;
    }
    if (password !== confirmPassword) {
      setMsg("Passwords don't match."); return;
    }
    if (password.length < 6) {
      setMsg('Password must be at least 6 characters.'); return;
    }
    setIsLoading(true); setMsg('');
    try {
      await axios.post('/api/invite/request', {
        username:   username.trim(),
        email:      normalizedEmail,
        company_id: parseInt(reqCompanyId, 10),
        uuid:       "",
      });
      setViewState('request_sent');
    } catch (err) {
      setMsg(err.response?.data?.detail || err.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteSetPassword = async (e) => {
    e.preventDefault();
    setMsg('');
    if (password !== confirmPassword) { setMsg("Passwords don't match."); return; }
    if (password.length < 6) { setMsg('Password must be at least 6 characters.'); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password, data: { needs_password_setup: false } });
      if (error) throw error;
      await axios.post('/api/users/me/sync-password-hash', { password }).catch(() => {});
      setInviteViewState('success');
      setTimeout(async () => {
        const { data } = await supabase.auth.getUser();
        if (onInviteSetupDone) onInviteSetupDone();
        if (data?.user && onLogin) onLogin(data.user);
      }, 2000);
    } catch (err) {
      setMsg(err?.message || 'Failed to set password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchTo = (newMode) => {
    setMode(newMode); setViewState('form'); setIsRecovery(false);
    setMsg(''); setEmail(''); setPassword(''); setConfirmPassword('');
    setCompanyName(''); setUsername(''); setMfaCode('');
    setRegisterRole('user');
    setReqCompanyId('');
  };

  const headings = {
    login:    'Welcome back',
    register: 'Create your account',
    reset:    isRecovery ? 'Set a new password' : 'Reset your password',
  };
  const subheadings = {
    login:    'Sign in to access your dashboard.',
    register: 'Choose your role and get started.',
    reset:    isRecovery ? 'Choose a strong password.' : "Enter your email and we'll send a reset link.",
  };
  const buttonLabels = {
    login:    'Sign In',
    register: 'Create Account',
    reset:    isRecovery ? 'Update Password' : 'Send Reset Link',
  };

  const submitDisabled = isLoading || (
    mode === 'register' && registerRole === 'user' && (!reqCompanyId || !password || !confirmPassword)
  );

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center font-sans overflow-y-auto overflow-x-hidden text-white custom-scrollbar" style={{ background: 'var(--bg)', color: 'var(--text-main)' }}>
      {onBack && (
        <button onClick={onBack} className="fixed top-6 left-6 z-[100] text-white/70 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors bg-white/5 hover:bg-white/10 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/10 shadow-lg">
          ← Back to Home
        </button>
      )}

      {/* 3D Background */}
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-0 pointer-events-none" style={{ background: '#030712' }} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Centered Auth Card */}
      <BentoCard className="w-full max-w-[480px] p-8 sm:p-12 mx-4 !bg-black/40 backdrop-blur-3xl shadow-[0_0_80px_rgba(79,70,229,0.15)] flex flex-col my-12 md:my-16 rounded-[2.5rem] border border-white/10 relative z-10">
        
        <div className="flex items-center justify-center mb-10 cursor-default select-none">
          <span className="font-extrabold text-4xl sm:text-5xl tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">Spot<span className="text-indigo-400">fixes</span></span>
        </div>

          {/* ── Invite set-password flow ── */}
          {forceInviteSetup && (
            <div className="w-full flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              {inviteViewState === 'success' ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={28} className="text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Password set!</h2>
                  <p className="text-white/50 text-sm">Taking you to your workspace…</p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-widest mb-5">
                      <ShieldCheck size={12} /> Workspace Invite
                    </div>
                    <BoxReveal boxColor="var(--accent)" duration={0.5}>
                      <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Set your password</h2>
                    </BoxReveal>
                    <BoxReveal boxColor="var(--accent)" duration={0.5}>
                      <p className="text-white/50 text-sm leading-relaxed">
                        Your account has been approved. Choose a password to secure your workspace.
                      </p>
                    </BoxReveal>
                    {email && (
                      <p className="mt-3 text-xs text-white/30 font-mono">{email}</p>
                    )}
                  </div>
                  <form onSubmit={handleInviteSetPassword} className="flex flex-col gap-4">
                    <GlowingInput
                      icon={<Lock size={18} />}
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="New password"
                    />
                    <GlowingInput
                      icon={<Lock size={18} />}
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                    />
                    {msg && (
                      <div className="p-4 text-sm rounded-2xl border text-center bg-red-500/10 border-red-500/20 text-red-400">
                        {msg}
                      </div>
                    )}
                    <Button
                      type="submit"
                      size="lg"
                      disabled={isLoading || !password || !confirmPassword}
                      className="w-full mt-4 font-bold"
                    >
                      {isLoading ? 'Setting password…' : (
                        <><Lock size={16} /> Set Password & Enter Workspace</>
                      )}
                    </Button>
                  </form>
                  <p className="mt-6 text-center text-xs text-white/30 leading-relaxed">
                    By setting a password you agree to keep it confidential. You can change it later from your profile settings.
                  </p>
                </>
              )}
            </div>
          )}

          {!forceInviteSetup && (
            <div className="w-full flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              {viewState === 'request_sent' && (
                <div className="w-full max-w-[420px] mx-auto text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                    <Mail size={28} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Request submitted</h2>
                  <p className="text-white/60 text-sm mb-3">
                    Your access request has been sent to <strong className="text-white">{companies.find(c => String(c.id) === String(reqCompanyId))?.name || 'your company'}</strong>'s admin.
                  </p>
                  <p className="text-white/40 text-xs leading-relaxed mb-8">
                    Once approved, you'll receive an email at <strong className="text-white">{email}</strong> with an invite code. Log in with your email and password, then enter the code when prompted.
                  </p>
                  <Button size="lg" className="w-full font-bold mt-4" onClick={() => switchTo('login')}>
                    Back to Sign In <ArrowRight size={16} />
                  </Button>
                </div>
               )}

               {viewState === 'success' && (
                 <div className="w-full max-w-[420px] mx-auto text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                    <CheckCircle size={28} className="text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Registration submitted</h2>
                  <p className="text-white/60 text-sm mb-3">
                    Your admin account for <strong className="text-white">{companyName}</strong> is pending review.
                  </p>
                  <p className="text-white/40 text-xs leading-relaxed mb-8">
                    A super admin will approve your registration. You'll receive an email to access your workspace once approved.
                  </p>
                  <Button size="lg" className="w-full font-bold mt-4" onClick={() => switchTo('login')}>
                    Back to Sign In <ArrowRight size={16} />
                  </Button>
                </div>
               )}

               {viewState === 'mfa_challenge' && (
                 <div className="w-full max-w-[420px] mx-auto text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                    <Lock size={28} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Two-factor verification</h2>
                  <p className="text-white/60 text-sm mb-8">Enter the 6-digit code from your authenticator app.</p>
                  <input className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-5 text-white text-center text-3xl tracking-[0.5em] focus:border-indigo-500/50 outline-none transition-all mb-6" placeholder="000000" maxLength="6" value={mfaCode}
                    onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    autoComplete="one-time-code" />
                  <Button size="lg" className="w-full font-bold" onClick={verifyMfa} disabled={isLoading || mfaCode.length < 6}>
                    {isLoading ? 'Verifying…' : 'Verify'} {!isLoading && <ArrowRight size={16} />}
                  </Button>
                  {msg && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">{msg}</div>}
                </div>
               )}

               {viewState === 'form' && (
                 <div className="w-full mx-auto">
                  <h2 className="text-3xl sm:text-4xl font-extrabold mb-3 tracking-tight text-white">{headings[mode]}</h2>
                  <p className="text-white/60 text-sm sm:text-base mb-8 leading-relaxed">{subheadings[mode]}</p>

                  <form onSubmit={mode === 'register' && registerRole === 'user' ? handleRequestAccess : handleAuth} className="flex flex-col gap-3 w-full">
                    {mode === 'register' && (
                      <div className="mb-2">
                        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 text-center">
                          I'm registering as:
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { value: 'user',  icon: <User size={20} />,        label: 'Company User',  sub: 'Request access to join' },
                            { value: 'admin', icon: <ShieldCheck size={20} />, label: 'Company Admin',  sub: 'Create a new company' },
                          ].map(opt => (
                            <button key={opt.value} type="button" onClick={() => {
                              setRegisterRole(opt.value);
                              setReqCompanyId('');
                            }}
                              className={`flex flex-col items-center gap-2 p-5 rounded-2xl cursor-pointer text-center transition-all duration-300 ${
                                 registerRole === opt.value 
                                   ? 'ring-2 ring-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]' 
                                   : 'border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                              }`}>
                              <span className={registerRole === opt.value ? 'text-indigo-400' : 'text-white/30'}>{opt.icon}</span>
                              <span className={`text-sm font-bold ${registerRole === opt.value ? 'text-white' : 'text-white/60'}`}>{opt.label}</span>
                              <span className="text-[11px] text-white/40 leading-tight">{opt.sub}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <GlowingInput
                      icon={<Mail size={18} />}
                      type="email"
                      placeholder="Work email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      disabled={isRecovery}
                      autoComplete="email"
                    />

                    {(mode !== 'reset' || isRecovery) && (
                      <GlowingInput
                        icon={<Lock size={18} />}
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={isRecovery ? "New Password" : "Password"}
                      />
                    )}

                    {(mode === 'register' || isRecovery) && (
                      <GlowingInput
                        icon={<Lock size={18} />}
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm Password"
                      />
                    )}

                    {mode === 'register' && registerRole === 'admin' && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} className="flex flex-col gap-1.5">
                        <GlowingInput
                          icon={<Building2 size={18} />}
                          placeholder="Company name"
                          value={companyName}
                          onChange={e => setCompanyName(e.target.value)}
                          required
                        />
                        {companyName && /[<>"';&|`\\{}]/.test(companyName) && (
                          <p className="mt-1 text-xs text-red-400 font-semibold">
                            Company name contains invalid characters.
                          </p>
                        )}
                        {companyName && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(companyName) && (
                          <p className="mt-1 text-xs text-red-400 font-semibold">
                            Company name cannot be an email address.
                          </p>
                        )}
                        <p className="mt-1.5 text-xs text-white/40 leading-relaxed px-1">
                          A super admin will review your registration. Once approved, you'll receive an email and can sign in with the password you set here.
                        </p>
                      </motion.div>
                    )}

                    {mode === 'register' && registerRole === 'user' && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} className="flex flex-col gap-1.5">
                        <div className="relative w-full rounded-[16px] p-[1px]">
                          <Building2 size={18} className="absolute left-[17px] top-1/2 -translate-y-1/2 text-white/30 pointer-events-none z-10" />
                          <CustomSelect
                            value={reqCompanyId}
                            onChange={v => setReqCompanyId(v)}
                            options={companies.map(c => ({ value: c.id, label: c.name }))}
                            placeholder={loadingCompanies ? 'Loading…' : 'Select your company'}
                            triggerClassName={`w-full h-[54px] flex items-center justify-between pl-11 pr-4 border rounded-[15px] cursor-pointer text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-indigo-500/30 ${reqCompanyId ? 'border-indigo-500/50 bg-black/60 text-white' : 'bg-black/40 border-white/10 text-white/40 hover:border-white/20'}`}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-white/40 leading-relaxed px-1">
                          Once your admin approves you, you'll receive an email with an invite code.
                        </p>
                      </motion.div>
                    )}

                    {mode === 'register' && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} className="flex flex-col gap-1.5">
                        <GlowingInput
                          icon={<User size={18} />}
                          placeholder="Your display name"
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                          required
                        />
                      </motion.div>
                    )}

                    <Button size="lg" className="w-full mt-6 font-bold" type="submit" disabled={submitDisabled}>
                      {isLoading ? 'Please wait…' : (
                        mode === 'register' && registerRole === 'user'
                          ? 'Request Access'
                          : buttonLabels[mode]
                      )}
                      {!isLoading && <ArrowRight size={16} />}
                    </Button>
                  </form>

                  {msg && (
                    <div className={`mt-6 p-4 text-sm rounded-2xl border text-center ${
                         msg.includes('sent') || msg.includes('success') || msg.includes('updated') || msg.includes('inbox') || msg.includes('active')
                       ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                       : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                      {msg}
                    </div>
                  )}

                  {mode === 'login' ? (
                    <div className="mt-8 text-center text-sm text-white/40 flex flex-col gap-3">
                      <p>New to our platform? <a href="#" onClick={(e) => { e.preventDefault(); switchTo('register'); }} className="text-white hover:underline transition-colors font-medium">Create Account</a></p>
                      <p><a href="#" onClick={(e) => { e.preventDefault(); switchTo('reset'); }} className="hover:underline transition-colors">Forgot password?</a></p>
                    </div>
                  ) : (
                    <p className="mt-8 text-center text-sm text-white/40">
                      <a href="#" onClick={(e) => { e.preventDefault(); switchTo('login'); }} className="hover:underline transition-colors">← Back to sign in</a>
                    </p>
                  )}
                </div>
               )}
             </div>
           )}
         </BentoCard>
    </div>
  );
}
