export function RadarChart({ data }: { data: { label: string; value: number }[] }) {
  const n = data.length;
  const cx = 110;
  const cy = 110;
  const R = 80;
  const point = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  return (
    <svg viewBox="0 0 220 220" className="mx-auto w-72">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={data.map((_, i) => point(i, R * f).join(",")).join(" ")}
          fill="none"
          stroke="#5c4033"
          strokeOpacity={0.15}
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#5c4033" strokeOpacity={0.15} />;
      })}
      <polygon
        points={data.map((d, i) => point(i, R * Math.max(0.04, d.value)).join(",")).join(" ")}
        fill="#ff9f45"
        fillOpacity={0.35}
        stroke="#ff9f45"
        strokeWidth={2.5}
      />
      {data.map((d, i) => {
        const [x, y] = point(i, R + 18);
        return (
          <text key={d.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#5c4033">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
