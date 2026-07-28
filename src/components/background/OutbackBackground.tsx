export function OutbackBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#aee0f2] via-sky-soft to-[#d3f0dd]" />
      <div className="absolute right-8 top-8 h-24 w-24 rounded-full bg-gold shadow-[0_0_80px_30px_rgba(255,209,102,0.55)]" />
      <Cloud className="top-[12%] animate-drift" style={{ animationDuration: "90s" }} />
      <Cloud className="top-[26%] animate-drift" style={{ animationDuration: "130s", animationDelay: "-40s" }} />
      <Cloud className="top-[6%] animate-drift" style={{ animationDuration: "110s", animationDelay: "-80s" }} />
      <svg
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        className="absolute bottom-0 h-40 w-full sm:h-56"
      >
        <path d="M0 120 Q360 20 720 100 T1440 80 V220 H0 Z" fill="#8fd45f" />
        <path d="M0 170 Q480 90 960 160 T1440 150 V220 H0 Z" fill="#7bc950" />
      </svg>
    </div>
  );
}

function Cloud({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 50" style={style} className={`absolute left-0 w-28 opacity-90 ${className}`}>
      <g fill="#ffffff">
        <circle cx="35" cy="30" r="18" />
        <circle cx="60" cy="22" r="22" />
        <circle cx="88" cy="32" r="16" />
        <rect x="30" y="30" width="65" height="16" rx="8" />
      </g>
    </svg>
  );
}
