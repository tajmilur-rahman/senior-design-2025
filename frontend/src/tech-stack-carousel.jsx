import React from "react";

const ICONS_ROW1 = [
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg", alt: "React" },
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg", alt: "TypeScript" },
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg", alt: "Python" },
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg", alt: "PostgreSQL" },
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg", alt: "Tailwind CSS" },
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg", alt: "Docker" },
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg", alt: "GitHub", invert: true }
];

const ICONS_ROW2 = [
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg", alt: "FastAPI" },
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vitejs/vitejs-original.svg", alt: "Vite" },
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pandas/pandas-original.svg", alt: "Pandas" },
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/numpy/numpy-original.svg", alt: "NumPy" },
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg", alt: "Git" },
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linux/linux-original.svg", alt: "Linux" },
  { src: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg", alt: "Node.js" }
];

const repeatedIcons = (icons, repeat = 8) => Array.from({ length: repeat }).flatMap(() => icons);

export default function TechStackCarousel() {
  return (
    <div className="relative w-full overflow-hidden py-8 pause-on-hover">
      <div className="overflow-hidden relative pb-4">
        {/* Row 1 */}
        <div className="flex gap-6 sm:gap-8 whitespace-nowrap animate-scroll-left w-max">
          {repeatedIcons(ICONS_ROW1).map((item, i) => (
            <div key={`r1-${i}`} className="group h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 rounded-2xl bg-white/[0.02] border border-white/5 shadow-lg flex items-center justify-center backdrop-blur-md transition-all duration-500 hover:bg-white/[0.08] hover:border-white/20 hover:scale-110 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(255,255,255,0.15)] cursor-default">
              <img 
                src={item.src} 
                alt={item.alt} 
                title={item.alt} 
                className={`h-8 w-8 sm:h-10 sm:w-10 object-contain transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] ${item.invert ? 'invert brightness-200 opacity-90 group-hover:opacity-100' : 'opacity-80 group-hover:opacity-100'}`} 
              />
            </div>
          ))}
        </div>

        {/* Row 2 */}
        <div className="flex gap-6 sm:gap-8 whitespace-nowrap mt-6 sm:mt-8 animate-scroll-right w-max">
          {repeatedIcons(ICONS_ROW2).map((item, i) => (
            <div key={`r2-${i}`} className="group h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 rounded-2xl bg-white/[0.02] border border-white/5 shadow-lg flex items-center justify-center backdrop-blur-md transition-all duration-500 hover:bg-white/[0.08] hover:border-white/20 hover:scale-110 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(255,255,255,0.15)] cursor-default">
              <img 
                src={item.src} 
                alt={item.alt} 
                title={item.alt} 
                className={`h-8 w-8 sm:h-10 sm:w-10 object-contain transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] ${item.invert ? 'invert brightness-200 opacity-90 group-hover:opacity-100' : 'opacity-80 group-hover:opacity-100'}`} 
              />
            </div>
          ))}
        </div>

        {/* Fade overlays matching the pure black background */}
        <div className="absolute left-0 top-0 h-full w-24 sm:w-48 bg-gradient-to-r from-black to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 h-full w-24 sm:w-48 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      </div>

      <style>{`
        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scroll-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-scroll-left { animation: scroll-left 50s linear infinite; }
        .animate-scroll-right { animation: scroll-right 50s linear infinite; }
        .pause-on-hover:hover .animate-scroll-left,
        .pause-on-hover:hover .animate-scroll-right { 
          animation-play-state: paused; 
        }
      `}</style>
    </div>
  );
}