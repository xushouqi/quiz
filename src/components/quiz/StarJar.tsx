export function StarJar({ stars, capacity = 100 }: { stars: number; capacity?: number }) {
  const pct = Math.min(1, stars / capacity);
  const fillY = 70 - pct * 55;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 80 90" className="h-28 w-24">
        <defs>
          <clipPath id="jarclip">
            <path d="M18 22 H62 V70 Q62 80 52 80 H28 Q18 80 18 70 Z" />
          </clipPath>
        </defs>
        <g clipPath="url(#jarclip)">
          <rect x="18" y={fillY} width="44" height={80 - fillY} fill="#ffd166" />
        </g>
        {stars > 0 && (
          <text x="40" y={Math.max(fillY + 16, 34)} textAnchor="middle" fontSize="16">
            ⭐
          </text>
        )}
        <path d="M18 22 H62 V70 Q62 80 52 80 H28 Q18 80 18 70 Z" fill="none" stroke="#5c4033" strokeWidth="4" />
        <rect x="14" y="12" width="52" height="12" rx="5" fill="none" stroke="#5c4033" strokeWidth="4" />
      </svg>
      <span className="font-kids text-xl">⭐ {stars}</span>
    </div>
  );
}
