import { cn } from '../../lib/utils';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function DottedSurface({ className, ...props }) {
  const containerRef = useRef(null);
  const animIdRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || sceneRef.current) return;

    // Reduce workload on mobile/touch devices
    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
    const dpr = Math.min(window.devicePixelRatio, 2);

    const SEPARATION = 150;
    const AMOUNTX = isMobile ? 20 : 40;
    const AMOUNTY = isMobile ? 30 : 60;
    const STAR_COUNT = isMobile ? 300 : 900;
    // Cap to 30fps on mobile to reduce battery drain; 60fps on desktop
    const FRAME_MS = isMobile ? 1000 / 30 : 0;

    const getViewW = () => window.visualViewport?.width  ?? window.innerWidth;
    const getViewH = () => window.visualViewport?.height ?? window.innerHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(60, getViewW() / getViewH(), 1, 12000);
    camera.position.set(0, 300, 1000);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !isMobile });
    renderer.setPixelRatio(dpr);
    renderer.setSize(getViewW(), getViewH());
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // ── Wave dot grid ──────────────────────────────────────────────────────────
    const wavePositions = [];
    const waveColors = [];
    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        wavePositions.push(
          ix * SEPARATION - (AMOUNTX * SEPARATION) / 2,
          0,
          iy * SEPARATION - (AMOUNTY * SEPARATION) / 2,
        );
        waveColors.push(1, 1, 1);
      }
    }
    const waveGeo = new THREE.BufferGeometry();
    waveGeo.setAttribute('position', new THREE.Float32BufferAttribute(wavePositions, 3));
    waveGeo.setAttribute('color', new THREE.Float32BufferAttribute(waveColors, 3));
    // Divide size by dpr so dots appear the same visual size regardless of screen density
    const waveMat = new THREE.PointsMaterial({
      size: 8 / dpr,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    });
    scene.add(new THREE.Points(waveGeo, waveMat));

    // ── Starfield ──────────────────────────────────────────────────────────────
    const starPositions = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      starPositions.push(
        (Math.random() - 0.5) * 10000,
        Math.random() * 3000 + 400,
        (Math.random() - 0.5) * 8000 - 500,
      );
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      size: 3 / dpr,
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    sceneRef.current = { renderer, waveGeo, waveMat, starGeo, starMat };

    const posAttr = waveGeo.attributes.position;

    let scrollOffset = 0;
    let targetScrollOffset = 0;
    let prevCount = -1;
    let lastFrameTime = 0;

    const onScroll = () => {
      targetScrollOffset = window.scrollY * 0.002;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const startTime = performance.now();

    const animate = (timestamp) => {
      animIdRef.current = requestAnimationFrame(animate);

      // Throttle frame rate on mobile
      if (FRAME_MS > 0 && timestamp - lastFrameTime < FRAME_MS) return;
      lastFrameTime = timestamp;

      // Ocean-wave pace idle drift + scroll offset
      const idleDrift = (performance.now() - startTime) * 0.00055;
      scrollOffset += (targetScrollOffset - scrollOffset) * 0.04;
      const count = idleDrift + scrollOffset;

      if (Math.abs(count - prevCount) < 0.0003) return;
      prevCount = count;

      let i = 0;
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          posAttr.setY(
            i,
            Math.sin((ix + count) * 0.3) * 60 +
            Math.sin((iy + count) * 0.5) * 60,
          );
          i++;
        }
      }
      posAttr.needsUpdate = true;
      renderer.render(scene, camera);
    };

    animate(0);

    const handleResize = () => {
      const w = getViewW();
      const h = getViewH();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animIdRef.current);
      waveGeo.dispose();
      waveMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('pointer-events-none fixed inset-0', className)}
      {...props}
    />
  );
}
