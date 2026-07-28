export function ScoreCurve({
  points,
}: {
  points: { label: string; score: number; max: number }[];
}) {
  if (points.length === 0) {
    return <p className="py-8 text-center text-cocoa/60">还没有考试记录 No exam records yet</p>;
  }
  const W = 320;
  const H = 160;
  const pad = 30;
  const x = (i: number) =>
    pad + (points.length === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (points.length - 1));
  const y = (s: number) => H - pad - (s / 120) * (H - 2 * pad);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.score)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#5c4033" strokeOpacity={0.3} />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#5c4033" strokeOpacity={0.3} />
      <text x={pad - 4} y={y(120) + 4} textAnchor="end" fontSize="10" fill="#5c4033">120</text>
      <text x={pad - 4} y={y(60) + 4} textAnchor="end" fontSize="10" fill="#5c4033">60</text>
      <path d={line} fill="none" stroke="#ef6351" strokeWidth={3} strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.score)} r={4} fill="#ff9f45" stroke="#ffffff" strokeWidth={1.5} />
          <text x={x(i)} y={H - pad + 14} textAnchor="middle" fontSize="9" fill="#5c4033">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
