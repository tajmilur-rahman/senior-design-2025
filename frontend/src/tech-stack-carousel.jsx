import React from "react";

const ICONS_ROW1 = [
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg",
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg",
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg",
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vitejs/vitejs-original.svg",
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg"
];

const ICONS_ROW2 = [
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg",
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg",
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg",
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vitejs/vitejs-original.svg",
  "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg"
];

const repeatedIcons = (icons, repeat = 8) => Array.from({ length: repeat }).flatMap(() => icons);

export default function TechStackCarousel() {
  return (
    <div className="relative w-full overflow-hidden py-4">
      <div className="overflow-hidden relative pb-2">
        {/* Row 1 */}
        <div className="flex gap-6 sm:gap-10 whitespace-nowrap animate-scroll-left w-max">
          {repeatedIcons(ICONS_ROW1).map((src, i) => (
            <div key={`r1-${i}`} className="h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 rounded-full bg-white/[0.03] border border-white/10 shadow-2xl flex items-center justify-center backdrop-blur-sm">
              <img src={src} alt="tech-icon" className="h-8 w-8 sm:h-10 sm:w-10 object-contain opacity-90" />
            </div>
          ))}
        </div>

        {/* Row 2 */}
        <div className="flex gap-6 sm:gap-10 whitespace-nowrap mt-6 sm:mt-10 animate-scroll-right w-max">
          {repeatedIcons(ICONS_ROW2).map((src, i) => (
            <div key={`r2-${i}`} className="h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 rounded-full bg-white/[0.03] border border-white/10 shadow-2xl flex items-center justify-center backdrop-blur-sm">
              <img src={src} alt="tech-icon" className="h-8 w-8 sm:h-10 sm:w-10 object-contain opacity-90" />
            </div>
          ))}
        </div>

        {/* Fade overlays matching your deep dark #030712 landing background */}
        <div className="absolute left-0 top-0 h-full w-24 sm:w-48 bg-gradient-to-r from-[#030712] to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 h-full w-24 sm:w-48 bg-gradient-to-l from-[#030712] to-transparent pointer-events-none" />
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
        .animate-scroll-left { animation: scroll-left 40s linear infinite; }
        .animate-scroll-right { animation: scroll-right 40s linear infinite; }
      `}</style>
    </div>
  );
}