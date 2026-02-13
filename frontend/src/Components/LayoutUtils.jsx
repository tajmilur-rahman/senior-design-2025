import { useState, useEffect, useRef } from 'react';

// --- SCROLL ANIMATION WRAPPER ---
export function ScrollSection({ children, className = "" }) {
  const [isVisible, setVisible] = useState(false);
  const domRef = useRef();
  
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) setVisible(true); });
    }, { threshold: 0.1 });
    
    const currentRef = domRef.current;
    if (currentRef) observer.observe(currentRef);
    return () => { if(currentRef) observer.unobserve(currentRef); };
  }, []);

  return (
    <div ref={domRef} className={`scroll-section ${isVisible ? 'fade-in' : ''} ${className}`}>
      {children}
    </div>
  );
}

// --- VIDEO BACKGROUND ---
export function Background() {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current) {
        videoRef.current.play().catch(error => { console.log("Autoplay prevented:", error); });
    }
  }, []);
  return (
    <div className="bg-video-container">
      <video ref={videoRef} className="bg-video" autoPlay loop muted playsInline>
        <source src="/video.mp4" type="video/mp4" />
      </video>
      <div className="bg-overlay"></div>
    </div>
  )
}

// --- LOADING SKELETON ---
export function SkeletonLoader() {
  return (
    <div className="skeleton-grid" style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:24, marginTop:50}}>
      <div style={{height:180, background:'#e2e8f0', borderRadius:12}}></div>
      <div style={{height:180, background:'#e2e8f0', borderRadius:12}}></div>
      <div style={{height:180, background:'#e2e8f0', borderRadius:12}}></div>
    </div>
  )
}
export default function App() {
  const [user, setUser] = useState(null);

  // Check for an existing session on startup
  useEffect(() => {
    const savedUser = localStorage.getItem("user_info");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  if (!user) {
    return <Login onLogin={(loggedInUser) => {
        localStorage.setItem("user_info", JSON.stringify(loggedInUser));
        setUser(loggedInUser);
    }} />;
  }

  return <Dashboard user={user} onLogout={() => {
      localStorage.removeItem("token");
      localStorage.removeItem("user_info");
      setUser(null);
  }} />;
}