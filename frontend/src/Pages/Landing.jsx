import React, { forwardRef, useImperativeHandle, useEffect, useRef, useMemo, useState } from "react"
import * as THREE from "three"
import { Canvas, useFrame } from "@react-three/fiber"
import { PerspectiveCamera } from "@react-three/drei"
import { degToRad } from "three/src/math/MathUtils.js"
import { ArrowRight, ShieldCheck, Brain, CheckCircle, Star, GitFork, ExternalLink } from "lucide-react"

const GITHUB_REPO = "https://github.com/tajmilur-rahman/senior-design-2025"

function GithubIcon({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23A11.52 11.52 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

// ============================================================================
// BEAMS COMPONENT (3D Background)
// ============================================================================

function extendMaterial(BaseMaterial, cfg) {
  const physical = THREE.ShaderLib.physical
  const { vertexShader: baseVert, fragmentShader: baseFrag, uniforms: baseUniforms } = physical
  const baseDefines = physical.defines ?? {}

  const uniforms = THREE.UniformsUtils.clone(baseUniforms)

  const defaults = new BaseMaterial(cfg.material || {})

  if (defaults.color) uniforms.diffuse.value = defaults.color
  if ("roughness" in defaults) uniforms.roughness.value = defaults.roughness
  if ("metalness" in defaults) uniforms.metalness.value = defaults.metalness
  if ("envMap" in defaults) uniforms.envMap.value = defaults.envMap
  if ("envMapIntensity" in defaults) uniforms.envMapIntensity.value = defaults.envMapIntensity

  Object.entries(cfg.uniforms ?? {}).forEach(([key, u]) => {
    uniforms[key] =
      u !== null && typeof u === "object" && "value" in u
        ? u
        : { value: u }
  })

  let vert = `${cfg.header}
${cfg.vertexHeader ?? ""}
${baseVert}`
  let frag = `${cfg.header}
${cfg.fragmentHeader ?? ""}
${baseFrag}`

  for (const [inc, code] of Object.entries(cfg.vertex ?? {})) {
    vert = vert.replace(inc, `${inc}
${code}`)
  }

  for (const [inc, code] of Object.entries(cfg.fragment ?? {})) {
    frag = frag.replace(inc, `${inc}
${code}`)
  }

  const mat = new THREE.ShaderMaterial({
    defines: { ...baseDefines },
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    lights: true,
    fog: !!cfg.material?.fog,
  })

  return mat
}

const CanvasWrapper = ({ children }) => (
  <Canvas dpr={[1, 2]} frameloop="always" className="w-full h-full relative">
    {children}
  </Canvas>
)

const hexToNormalizedRGB = (hex) => {
  const clean = hex.replace("#", "")
  const r = Number.parseInt(clean.substring(0, 2), 16)
  const g = Number.parseInt(clean.substring(2, 4), 16)
  const b = Number.parseInt(clean.substring(4, 6), 16)
  return [r / 255, g / 255, b / 255]
}

const noise = `
float random (in vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))*
        43758.5453123);
}

float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
           (c - a)* u.y * (1.0 - u.x) +
           (d - b) * u.x * u.y;
}

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

float cnoise(vec3 P){
  vec3 Pi0 = floor(P);
  vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod(Pi0, 289.0);
  Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 / 7.0;
  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 / 7.0;
  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x,Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x,Pf1.y,Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy,Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy,Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x,Pf0.y,Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x,Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);
  vec2 n_yz = mix(n_z.xy,n_z.zw,fade_xyz.y);
  float n_xyz = mix(n_yz.x,n_yz.y,fade_xyz.x);
  return 2.2 * n_xyz;
}
`

function createStackedPlanesBufferGeometry(
  n,
  width,
  height,
  spacing,
  heightSegments,
) {
  const geometry = new THREE.BufferGeometry()
  const numVertices = n * (heightSegments + 1) * 2
  const numFaces = n * heightSegments * 2

  const positions = new Float32Array(numVertices * 3)
  const indices = new Uint32Array(numFaces * 3)
  const uvs = new Float32Array(numVertices * 2)

  let vertexOffset = 0
  let indexOffset = 0
  let uvOffset = 0

  const totalWidth = n * width + (n - 1) * spacing
  const xOffsetBase = -totalWidth / 2

  for (let i = 0; i < n; i++) {
    const xOffset = xOffsetBase + i * (width + spacing)
    const uvXOffset = Math.random() * 300
    const uvYOffset = Math.random() * 300

    for (let j = 0; j <= heightSegments; j++) {
      const y = height * (j / heightSegments - 0.5)
      const v0 = [xOffset, y, 0]
      const v1 = [xOffset + width, y, 0]

      positions.set([...v0, ...v1], vertexOffset * 3)

      const uvY = j / heightSegments
      uvs.set([uvXOffset, uvY + uvYOffset, uvXOffset + 1, uvY + uvYOffset], uvOffset)

      if (j < heightSegments) {
        const a = vertexOffset,
          b = vertexOffset + 1,
          c = vertexOffset + 2,
          d = vertexOffset + 3
        indices.set([a, b, c, c, b, d], indexOffset)
        indexOffset += 6
      }

      vertexOffset += 2
      uvOffset += 4
    }
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeVertexNormals()

  return geometry
}

const MergedPlanes = forwardRef(({ material, width, count, height }, ref) => {
  const mesh = useRef(null)

  useImperativeHandle(ref, () => mesh.current)

  const geometry = useMemo(
    () => createStackedPlanesBufferGeometry(count, width, height, 0, 100),
    [count, width, height],
  )

  useFrame((_, delta) => {
    if (mesh.current) {
        mesh.current.material.uniforms.time.value += 0.1 * delta
    }
  })

  return <mesh ref={mesh} geometry={geometry} material={material} />
})

MergedPlanes.displayName = "MergedPlanes"

const PlaneNoise = forwardRef((props, ref) => (
  <MergedPlanes ref={ref} material={props.material} width={props.width} count={props.count} height={props.height} />
))

PlaneNoise.displayName = "PlaneNoise"

const DirLight = ({ position, color }) => {
  const dir = useRef(null)

  useEffect(() => {
    if (!dir.current) return
    const cam = dir.current.shadow.camera
    cam.top = 24
    cam.bottom = -24
    cam.left = -24
    cam.right = 24
    cam.far = 64
    dir.current.shadow.bias = -0.004
  }, [])

  return <directionalLight ref={dir} color={color} intensity={1} position={position} />
}

export const Beams = ({
  beamWidth = 2,
  beamHeight = 15,
  beamNumber = 12,
  lightColor = "#ffffff",
  speed = 2,
  noiseIntensity = 1.75,
  scale = 0.2,
  rotation = 0,
}) => {
  const meshRef = useRef(null)

  const beamMaterial = useMemo(
    () =>
      extendMaterial(THREE.MeshStandardMaterial, {
        header: `
  varying vec3 vEye;
  varying float vNoise;
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float time;
  uniform float uSpeed;
  uniform float uNoiseIntensity;
  uniform float uScale;
  ${noise}`,
        vertexHeader: `
  float getPos(vec3 pos) {
    vec3 noisePos =
      vec3(pos.x * 0., pos.y - uv.y, pos.z + time * uSpeed * 3.) * uScale;
    return cnoise(noisePos);
  }

  vec3 getCurrentPos(vec3 pos) {
    vec3 newpos = pos;
    newpos.z += getPos(pos);
    return newpos;
  }

  vec3 getNormal(vec3 pos) {
    vec3 curpos = getCurrentPos(pos);
    vec3 nextposX = getCurrentPos(pos + vec3(0.01, 0.0, 0.0));
    vec3 nextposZ = getCurrentPos(pos + vec3(0.0, -0.01, 0.0));
    vec3 tangentX = normalize(nextposX - curpos);
    vec3 tangentZ = normalize(nextposZ - curpos);
    return normalize(cross(tangentZ, tangentX));
  }`,
        fragmentHeader: "",
        vertex: {
          "#include <begin_vertex>": `transformed.z += getPos(transformed.xyz);`,
          "#include <beginnormal_vertex>": `objectNormal = getNormal(position.xyz);`,
        },
        fragment: {
          "#include <dithering_fragment>": `
    float randomNoise = noise(gl_FragCoord.xy);
    gl_FragColor.rgb -= randomNoise / 15. * uNoiseIntensity;`,
        },
        material: { fog: true },
        uniforms: {
          diffuse: new THREE.Color(...hexToNormalizedRGB("#000000")),
          time: { shared: true, mixed: true, linked: true, value: 0 },
          roughness: 0.3,
          metalness: 0.3,
          uSpeed: { shared: true, mixed: true, linked: true, value: speed },
          envMapIntensity: 10,
          uNoiseIntensity: noiseIntensity,
          uScale: scale,
        },
      }),
    [speed, noiseIntensity, scale],
  )

  return (
    <CanvasWrapper>
      <group rotation={[0, 0, degToRad(rotation)]}>
        <PlaneNoise ref={meshRef} material={beamMaterial} count={beamNumber} width={beamWidth} height={beamHeight} />
        <DirLight color={lightColor} position={[0, 3, 10]} />
      </group>
      <ambientLight intensity={1} />
      <color attach="background" args={["#000000"]} />
      <PerspectiveCamera makeDefault position={[0, 0, 20]} fov={30} />
    </CanvasWrapper>
  )
}

// ============================================================================
// BUTTON COMPONENT
// ============================================================================

const Button = ({ variant = "default", size = "sm", className = "", children, ...props }) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-50"

  const variants = {
    default: "bg-white text-black hover:bg-gray-100",
    outline: "border border-white/20 bg-white/5 backdrop-blur-xl text-white hover:bg-white/10 hover:border-white/30",
    ghost: "text-white/90 hover:text-white hover:bg-white/10",
  }

  const sizes = {
    sm: "h-9 px-4 py-2 text-sm",
    lg: "px-8 py-6 text-lg",
  }

  return (
    <button
      className={`group relative overflow-hidden rounded-full ${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      <span className="relative z-10 flex items-center">{children}</span>
      <div className="absolute inset-0 -top-2 -bottom-2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
    </button>
  )
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

  const layers = [
    {
      label: 'Client Layer',
      color: 'from-blue-500/20 to-blue-500/5',
      border: 'border-blue-500/30',
      dot: 'bg-blue-400',
      items: [
        { name: 'React 18 SPA', sub: 'Vite + Tailwind CSS' },
        { name: 'Supabase Auth SDK', sub: 'JWT session management' },
      ],
    },
    {
      label: 'API Layer',
      color: 'from-violet-500/20 to-violet-500/5',
      border: 'border-violet-500/30',
      dot: 'bg-violet-400',
      items: [
        { name: 'FastAPI', sub: 'Python — REST endpoints' },
        { name: 'JWT Middleware', sub: 'Role-based auth (user / admin / super_admin)' },
      ],
    },
    {
      label: 'Intelligence Layer',
      color: 'from-emerald-500/20 to-emerald-500/5',
      border: 'border-emerald-500/30',
      dot: 'bg-emerald-400',
      items: [
        { name: 'Random Forest Classifier', sub: 'sklearn — S1–S4 severity prediction' },
        { name: 'TF-IDF Vectorizer', sub: 'NLP feature extraction from bug text' },
        { name: 'Vector RAG', sub: 'Semantic duplicate detection via embeddings' },
      ],
    },
    {
      label: 'Data Layer',
      color: 'from-amber-500/20 to-amber-500/5',
      border: 'border-amber-500/30',
      dot: 'bg-amber-400',
      items: [
        { name: 'Supabase (PostgreSQL)', sub: 'Per-company tables with Row-Level Security' },
        { name: 'Supabase Auth', sub: 'Identity provider & session storage' },
        { name: 'ML Artifact Store', sub: 'Versioned .pkl models per company' },
      ],
    },
  ];

  const flows = [
    { from: 'User submits bug report', to: 'FastAPI validates + routes', color: 'text-blue-400' },
    { from: 'RF Classifier predicts S1–S4', to: 'Result logged to feedback table', color: 'text-emerald-400' },
    { from: 'Human correction received', to: 'Model retrained incrementally', color: 'text-violet-400' },
    { from: 'Vector search finds duplicates', to: 'RAG returns top-K similar bugs', color: 'text-amber-400' },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#080808] border border-white/10 rounded-[2rem] shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-8 pt-8 pb-6 bg-[#080808] border-b border-white/5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-400">System Blueprint</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">ApexOS Architecture</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
          >
            ✕
          </button>
        </div>

        <div className="px-8 py-8 space-y-8">
          {/* Stack layers */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">System Stack</p>
            {layers.map((layer, i) => (
              <div key={i} className={`relative rounded-2xl border bg-gradient-to-r ${layer.color} ${layer.border} p-5`}>
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full ${layer.dot}`} />
                    {i < layers.length - 1 && <div className="w-px flex-1 bg-white/10 min-h-[12px]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">{layer.label}</div>
                    <div className="flex flex-wrap gap-3">
                      {layer.items.map((item, j) => (
                        <div key={j} className="bg-black/30 border border-white/10 rounded-xl px-4 py-2.5">
                          <div className="text-sm font-bold text-white">{item.name}</div>
                          <div className="text-[11px] text-white/40 mt-0.5">{item.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Data flows */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">Key Data Flows</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {flows.map((flow, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/8 rounded-2xl p-4">
                  <div className={`text-xs font-bold mb-1 ${flow.color}`}>{flow.from}</div>
                  <div className="flex items-center gap-2 text-white/30 text-[10px]">
                    <span>→</span>
                    <span>{flow.to}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Multi-tenancy callout */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Multi-Tenancy Model</p>
            <div className="flex flex-wrap gap-2 text-sm">
              {[
                'Company A → company_5_bugs table',
                'Company B → company_12_bugs table',
                'Firefox → firefox_table (shared)',
              ].map((t, i) => (
                <span key={i} className="font-mono bg-black/40 border border-white/10 text-white/60 px-3 py-1.5 rounded-lg text-[11px]">{t}</span>
              ))}
            </div>
            <p className="text-xs text-white/30 mt-3 leading-relaxed">
              Each company receives an isolated PostgreSQL table with Row-Level Security. The universal ML model trains globally; company-specific models fine-tune on proprietary data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const SECTION_IDS = ['hero', 'platform', 'capabilities', 'architecture', 'documentation'];

const scrollTo = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function Landing({ onEnterWorkspace }) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState(1);
  const [showArch, setShowArch] = useState(false);
  const totalSections = 5;

  // Scroll progress bar
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;
      const maxScroll = documentHeight - windowHeight;
      const progress = maxScroll > 0 ? Math.min(Math.max(scrollY / maxScroll, 0), 1) : 0;
      setScrollProgress(progress);
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
      {/* Beams Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Beams
          beamWidth={2.5}
          beamHeight={18}
          beamNumber={15}
          lightColor="#ffffff"
          speed={2.5}
          noiseIntensity={2}
          scale={0.15}
          rotation={43}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/90 pointer-events-none" />
      </div>

      {/* Glassmorphic Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 w-full bg-black/10 backdrop-blur-xl border-b border-white/10 transition-all">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between">

            {/* Brand — left */}
            <div className="flex items-center cursor-pointer flex-shrink-0" onClick={() => scrollTo('hero')}>
              <span className="text-xl font-bold tracking-tight text-white">
                Apex<span className="text-zinc-500">OS</span>
              </span>
            </div>

            {/* Nav pills — absolutely centred so brand + CTA stay at edges */}
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center space-x-1 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 p-1">
              {[
                { label: 'Platform',      id: 'platform',      section: 2 },
                { label: 'Capabilities',  id: 'capabilities',  section: 3 },
                { label: 'Architecture',  id: 'architecture',  section: 4 },
                { label: 'Documentation', id: 'documentation', section: 5 },
              ].map(({ label, id, section }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    currentSection === section
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* CTA — right */}
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
        <div className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Scroll</div>
        <div className="w-[2px] h-32 bg-white/10 relative rounded-full overflow-hidden">
          <div className="absolute top-0 left-0 w-full bg-white transition-all duration-150 ease-out" style={{ height: `${scrollProgress * 100}%` }} />
        </div>
        <div className="text-[10px] font-bold font-mono text-white/40">
          {String(currentSection).padStart(2, '0')} / {String(totalSections).padStart(2, '0')}
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="relative z-10 flex flex-col w-full">
        
        {/* SECTION 1: HERO */}
        <section id="hero" className="min-h-screen w-full flex flex-col items-center justify-center px-6 lg:px-8 pt-20">
          <div className="max-w-4xl text-center w-full">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center rounded-full bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2 text-sm text-white/90">
              <ShieldCheck className="mr-2 h-4 w-4 text-zinc-300" />
              {"Enterprise Bug Triage Engine"}
            </div>

            {/* Main Heading */}
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-white sm:text-7xl lg:text-8xl">
              Predict. Classify.{" "}
              <span className="bg-gradient-to-r from-white via-zinc-300 to-zinc-600 bg-clip-text text-transparent">
                Resolve.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mb-10 text-xl leading-relaxed text-white/70 sm:text-2xl max-w-2xl mx-auto">
              ML-powered severity prediction that sharpens with every correction your team makes.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button size="lg" className="shadow-2xl shadow-white/25 font-semibold" onClick={onEnterWorkspace}>
                Enter Workspace
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="font-semibold bg-transparent" onClick={() => setShowArch(true)}>
                View Architecture
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">222k+</div>
                <div className="text-white/60 text-sm">Training Records</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">{'<'} 1s</div>
                <div className="text-white/60 text-sm">Prediction Latency</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">S1–S4</div>
                <div className="text-white/60 text-sm">Auto-Classification</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: PLATFORM */}
        <section id="platform" className="min-h-screen w-full flex flex-col items-center justify-center px-6 lg:px-8 border-t border-white/5 relative py-24">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/5 to-transparent pointer-events-none" />
          <div className="max-w-5xl w-full relative z-10">
            <div className="text-center mb-16">
              <div className="mb-4 inline-flex items-center rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-blue-400 font-bold uppercase tracking-widest">
                Platform
              </div>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">One platform.<br/>Every stage of the bug lifecycle.</h2>
              <p className="text-xl md:text-2xl text-white/60 leading-relaxed max-w-2xl mx-auto">
                Submit, classify, and resolve — in a single unified workspace.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { badge: 'Severity Analysis', title: 'Instant ML Classification', desc: 'S1–S4 prediction in under a second. Trained on 222k+ real Mozilla Firefox reports.', color: 'text-blue-400', border: 'hover:border-blue-500/30' },
                { badge: 'Duplicate Detection', title: 'Semantic Vector Search', desc: 'Cross-references your full bug history using vector embeddings. No redundant submissions.', color: 'text-purple-400', border: 'hover:border-purple-500/30' },
                { badge: 'Multi-Tenancy', title: 'Isolated Tenant Architecture', desc: 'Dedicated PostgreSQL tables per company, enforced with Row-Level Security.', color: 'text-emerald-400', border: 'hover:border-emerald-500/30' },
                { badge: 'Role-Based Access', title: 'Granular Permission Tiers', desc: 'User, Admin, and Super Admin roles with invite flows and approval queues.', color: 'text-amber-400', border: 'hover:border-amber-500/30' },
                { badge: 'Bulk Ingestion', title: 'CSV & JSON Import Pipeline', desc: 'Ingest thousands of records at once. Each entry auto-classified on arrival.', color: 'text-pink-400', border: 'hover:border-pink-500/30' },
                { badge: 'Resolution Intelligence', title: 'AI-Assisted Fix Surfacing', desc: 'Retrieve resolved duplicates and their applied solutions to accelerate triage.', color: 'text-cyan-400', border: 'hover:border-cyan-500/30' },
              ].map((f, i) => (
                <div key={i} className={`bg-white/[0.02] border border-white/8 rounded-2xl p-6 transition-all duration-200 hover:bg-white/[0.04] ${f.border}`}>
                  <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${f.color}`}>{f.badge}</div>
                  <h3 className="text-white font-bold text-lg mb-2 tracking-tight leading-snug">{f.title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: CAPABILITIES */}
        <section id="capabilities" className="min-h-screen w-full flex flex-col items-center justify-center px-6 lg:px-8 border-t border-white/5 relative">
           <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/5 to-transparent pointer-events-none" />
           <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center relative z-10">
              <div className="text-left">
                 <div className="mb-4 inline-flex items-center rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-purple-400 font-bold uppercase tracking-widest">
                   Capabilities
                 </div>
                 <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Intelligence that compounds over time.</h2>
                 <p className="text-xl text-white/60 leading-relaxed mb-8">
                   Every human correction becomes a training signal. Your model grows more precise with every review cycle.
                 </p>
                 <ul className="space-y-4">
                   <li className="flex items-center gap-3 text-lg text-white/80"><CheckCircle size={20} className="text-purple-400 flex-shrink-0" /> TF-IDF n-gram feature extraction</li>
                   <li className="flex items-center gap-3 text-lg text-white/80"><CheckCircle size={20} className="text-purple-400 flex-shrink-0" /> Vector RAG duplicate detection</li>
                   <li className="flex items-center gap-3 text-lg text-white/80"><CheckCircle size={20} className="text-purple-400 flex-shrink-0" /> Feedback-driven model retraining</li>
                 </ul>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-3xl aspect-square flex items-center justify-center p-8 relative overflow-hidden backdrop-blur-md shadow-2xl">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent pointer-events-none" />
                 <Brain size={120} className="text-white/20" />
              </div>
           </div>
        </section>

        {/* SECTION 4: ARCHITECTURE */}
        <section id="architecture" className="min-h-screen w-full flex flex-col items-center justify-center px-6 lg:px-8 border-t border-white/5 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-900/5 to-transparent pointer-events-none" />
          <div className="max-w-4xl w-full text-center relative z-10">
             <div className="mb-4 inline-flex items-center rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-emerald-400 font-bold uppercase tracking-widest">
               Architecture
             </div>
             <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Secure by design.<br/>Multi-tenant by default.</h2>
             <p className="text-xl md:text-2xl text-white/60 leading-relaxed max-w-2xl mx-auto mb-10">
               Built on FastAPI and Supabase PostgreSQL. Row-Level Security enforced per tenant. Production-ready from day one.
             </p>
             <Button size="lg" className="shadow-2xl shadow-white/10 font-semibold" onClick={() => scrollTo('documentation')}>
               View on GitHub <ArrowRight className="ml-2 h-5 w-5" />
             </Button>
          </div>
        </section>

        {/* SECTION 5: DOCUMENTATION */}
        <section id="documentation" className="min-h-screen w-full flex flex-col items-center justify-center px-6 lg:px-8 border-t border-white/5 relative pb-24">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/5 to-transparent pointer-events-none" />
          <div className="max-w-4xl w-full relative z-10">
             <div className="text-center mb-14">
               <div className="mb-4 inline-flex items-center rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-white/50 font-bold uppercase tracking-widest">
                 Open Source
               </div>
               <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Explore the full codebase.</h2>
               <p className="text-xl text-white/60 leading-relaxed max-w-xl mx-auto">
                 ML pipeline, FastAPI backend, and React frontend — all in one open-source repository.
               </p>
             </div>

             {/* GitHub Open Source Banner */}
             <div className="mt-16 relative group">
               <div className="absolute -inset-px rounded-[2rem] bg-gradient-to-r from-white/10 via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
               <div className="relative bg-white/[0.02] border border-white/10 rounded-[2rem] p-8 lg:p-12 overflow-hidden">

                 {/* Background glow */}
                 <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent pointer-events-none" />
                 <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                 <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">

                   {/* Left — text */}
                   <div className="flex items-start gap-5 flex-1">
                     <div className="w-12 h-12 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                       <GithubIcon size={22} className="text-white" />
                     </div>
                     <div>
                       <div className="flex items-center gap-3 mb-2">
                         <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 border border-white/10 px-2.5 py-1 rounded-full">Open Source</span>
                       </div>
                       <h3 className="text-xl font-bold text-white tracking-tight mb-2">Built in the open.</h3>
                       <p className="text-sm text-white/50 leading-relaxed max-w-lg">
                         Explore the ML pipeline, backend, and frontend. Fork it. Contribute.
                       </p>
                       <div className="flex items-center gap-4 mt-4">
                         <div className="flex items-center gap-1.5 text-white/40 text-xs font-medium">
                           <Star size={13} className="text-amber-400/70" />
                           <span className="font-mono">Open Source</span>
                         </div>
                         <div className="w-px h-3 bg-white/10" />
                         <div className="flex items-center gap-1.5 text-white/40 text-xs font-medium">
                           <GitFork size={13} className="text-blue-400/70" />
                           <span className="font-mono">Fork &amp; Contribute</span>
                         </div>
                         <div className="w-px h-3 bg-white/10" />
                         <div className="flex items-center gap-1.5 text-white/40 text-xs font-mono">
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
                       className="flex items-center justify-center gap-2.5 bg-white text-black hover:bg-zinc-100 font-bold text-sm px-6 py-3 rounded-2xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                     >
                       <GithubIcon size={16} />
                       View on GitHub
                     </a>
                     <a
                       href={`${GITHUB_REPO}/archive/refs/heads/main.zip`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-semibold text-sm px-6 py-3 rounded-2xl transition-all"
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
        <section className="w-full flex flex-col items-center justify-center px-6 lg:px-8 border-t border-white/5 relative py-24">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-900/5 to-transparent pointer-events-none" />
          <div className="max-w-4xl w-full relative z-10">

            {/* Header — Gannon emblem + title */}
            <div className="text-center mb-16">
<div className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-400">Senior Design Project · 2025</div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">Gannon University</h2>
              <p className="text-white/40 text-base">Erie, Pennsylvania</p>
            </div>

            {/* Team Members */}
            <div className="mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-white/30 text-center mb-6">Built by</p>
              <div className="flex flex-wrap justify-center gap-4">
                {['Amartuvshin Ganzorig', 'Anunjin Batdelger', 'Koshi Yuasa'].map((name) => (
                  <div key={name} className="bg-white/[0.04] border border-white/10 rounded-2xl px-7 py-4 text-center backdrop-blur-sm">
                    <div className="text-white font-bold text-lg tracking-tight">{name}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Faculty + Advisors — 3-column grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Mentor */}
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-4">Faculty Mentor</p>
                <div className="text-white font-bold text-lg">Dr. Tajmilur Rahman</div>
              </div>

              {/* Senior Design Professors */}
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4">Senior Design Professors</p>
                <div className="space-y-2">
                  <div className="text-white font-bold text-lg">Dr. Mei-Huei Tang</div>
                  <div className="text-white font-bold text-lg">Dr. Richard Matovu</div>
                </div>
              </div>

              {/* Mozilla guidance */}
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-4">Mozilla Firefox · Guidance</p>
                <div className="space-y-2">
                  <div className="text-white font-bold text-lg">Marco Castelluccio</div>
                  <div className="text-white font-bold text-lg">Suhaib Mujahid</div>
                </div>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  )
}
