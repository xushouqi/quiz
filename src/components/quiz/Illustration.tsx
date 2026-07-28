export type ParsedIllustration =
  | { kind: "none" }
  | { kind: "emoji"; content: string }
  | { kind: "clock"; hour: number; minute: number }
  | { kind: "grid" }
  | { kind: "diagsquare" };

export function parseIllustration(desc: string | null | undefined): ParsedIllustration {
  if (!desc) return { kind: "none" };
  if (desc.startsWith("emoji:")) return { kind: "emoji", content: desc.slice(6) };
  if (desc.startsWith("svg:clock:")) {
    const [h, m] = desc.slice(10).split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) return { kind: "clock", hour: h, minute: m };
    return { kind: "none" };
  }
  if (desc === "svg:grid") return { kind: "grid" };
  if (desc === "svg:diagsquare") return { kind: "diagsquare" };
  return { kind: "none" };
}

export function Illustration({ descriptor }: { descriptor: string | null }) {
  const parsed = parseIllustration(descriptor);
  switch (parsed.kind) {
    case "emoji":
      return (
        <div className="select-none text-center text-5xl leading-relaxed tracking-wide sm:text-6xl">
          {parsed.content}
        </div>
      );
    case "clock":
      return <ClockFace hour={parsed.hour} minute={parsed.minute} />;
    case "grid":
      return <GridSquare />;
    case "diagsquare":
      return <DiagSquare />;
    default:
      return null;
  }
}

function ClockFace({ hour, minute }: { hour: number; minute: number }) {
  const hand = (angleDeg: number, len: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: 60 + len * Math.cos(rad), y: 60 + len * Math.sin(rad) };
  };
  const h = hand((hour % 12) * 30 + minute * 0.5, 26);
  const m = hand(minute * 6, 38);
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-40 w-40">
      <circle cx="60" cy="60" r="54" fill="#fffdf5" stroke="#5c4033" strokeWidth="5" />
      {Array.from({ length: 12 }, (_, i) => {
        const rad = ((i * 30 - 90) * Math.PI) / 180;
        return (
          <circle
            key={i}
            cx={60 + 46 * Math.cos(rad)}
            cy={60 + 46 * Math.sin(rad)}
            r={i % 3 === 0 ? 3.2 : 1.8}
            fill="#5c4033"
          />
        );
      })}
      <line x1="60" y1="60" x2={h.x} y2={h.y} stroke="#5c4033" strokeWidth="6" strokeLinecap="round" />
      <line x1="60" y1="60" x2={m.x} y2={m.y} stroke="#ef6351" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="60" r="4" fill="#5c4033" />
    </svg>
  );
}

function GridSquare() {
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-40 w-40">
      <rect x="15" y="15" width="90" height="90" fill="#fffdf5" stroke="#5c4033" strokeWidth="5" />
      <line x1="60" y1="15" x2="60" y2="105" stroke="#5c4033" strokeWidth="4" />
      <line x1="15" y1="60" x2="105" y2="60" stroke="#5c4033" strokeWidth="4" />
    </svg>
  );
}

function DiagSquare() {
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-40 w-40">
      <rect x="15" y="15" width="90" height="90" fill="#fffdf5" stroke="#5c4033" strokeWidth="5" />
      <line x1="15" y1="15" x2="105" y2="105" stroke="#ef6351" strokeWidth="4" />
    </svg>
  );
}
