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