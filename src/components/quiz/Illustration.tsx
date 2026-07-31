export type ParsedIllustration =
  | { kind: "none" }
  | { kind: "emoji"; content: string }
  | { kind: "clock"; hour: number; minute: number }
  | { kind: "grid" }
  | { kind: "diagsquare" }
  | { kind: "dice"; pips: number }
  | { kind: "bars"; heights: number[] }
  | { kind: "img"; src: string };

export function parseIllustration(desc: string | null | undefined): ParsedIllustration {
  if (!desc) return { kind: "none" };
  if (desc.startsWith("img:")) {
    const src = desc.slice(4).trim();
    if (src) return { kind: "img", src };
    return { kind: "none" };
  }
  if (desc.startsWith("emoji:")) return { kind: "emoji", content: desc.slice(6) };
  if (desc.startsWith("svg:clock:")) {
    const [h, m] = desc.slice(10).split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) return { kind: "clock", hour: h, minute: m };
    return { kind: "none" };
  }
  if (desc === "svg:grid") return { kind: "grid" };
  if (desc.startsWith("svg:dice:")) {
    const n = Number(desc.slice(9));
    if (Number.isInteger(n) && n >= 1 && n <= 6) return { kind: "dice", pips: n };
    return { kind: "none" };
  }
  if (desc.startsWith("svg:bars:")) {
    const parts = desc.slice(9).split(",").filter((s) => s.length > 0);
    const heights = parts.map(Number);
    if (heights.length > 0 && heights.every((h) => Number.isFinite(h) && h >= 0)) {
      return { kind: "bars", heights };
    }
    return { kind: "none" };
  }
  if (desc === "svg:diagsquare") return { kind: "diagsquare" };
  return { kind: "none" };
}

export function Illustration({ descriptor }: { descriptor: string | null }) {
  const parsed = parseIllustration(descriptor);
  switch (parsed.kind) {
    case "emoji":
      return (
        <div className="select-none text-center text-3xl leading-relaxed tracking-wide sm:text-4xl md:text-5xl">
          {parsed.content}
        </div>
      );
    case "clock":
      return <ClockFace hour={parsed.hour} minute={parsed.minute} />;
    case "grid":
      return <GridSquare />;
    case "diagsquare":
      return <DiagSquare />;
    case "dice":
      return <Dice pips={parsed.pips} />;
    case "bars":
      return <Bars heights={parsed.heights} />;
    case "img":
      return (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={parsed.src}
            alt=""
            loading="lazy"
            draggable={false}
            className="max-h-40 w-auto select-none object-contain md:max-h-52"
          />
        </div>
      );
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
    <svg viewBox="0 0 120 120" className="mx-auto h-24 w-24 md:h-32 md:w-32">
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
    <svg viewBox="0 0 120 120" className="mx-auto h-24 w-24 md:h-32 md:w-32">
      <rect x="15" y="15" width="90" height="90" fill="#fffdf5" stroke="#5c4033" strokeWidth="5" />
      <line x1="60" y1="15" x2="60" y2="105" stroke="#5c4033" strokeWidth="4" />
      <line x1="15" y1="60" x2="105" y2="60" stroke="#5c4033" strokeWidth="4" />
    </svg>
  );
}

function DiagSquare() {
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-24 w-24 md:h-32 md:w-32">
      <rect x="15" y="15" width="90" height="90" fill="#fffdf5" stroke="#5c4033" strokeWidth="5" />
      <line x1="15" y1="15" x2="105" y2="105" stroke="#ef6351" strokeWidth="4" />
    </svg>
  );
}

// 3×3 网格上各点数的 pip 位置（坐标 0/1/2）
const DICE_PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function Dice({ pips }: { pips: number }) {
  const cell = 30; // 每格像素
  const pos = (i: number) => 15 + i * cell; // 中心坐标
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-24 w-24 md:h-32 md:w-32">
      <rect x="8" y="8" width="104" height="104" rx="18" fill="#fffdf5" stroke="#5c4033" strokeWidth="5" />
      {(DICE_PIPS[pips] ?? []).map(([r, c], i) => (
        <circle key={i} cx={pos(c)} cy={pos(r)} r="8" fill="#5c4033" />
      ))}
    </svg>
  );
}

function Bars({ heights }: { heights: number[] }) {
  const max = Math.max(...heights, 1);
  const n = heights.length;
  const gap = 8;
  const w = (100 - gap * (n - 1)) / n;
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-24 w-24 md:h-32 md:w-32">
      <line x1="10" y1="108" x2="110" y2="108" stroke="#5c4033" strokeWidth="4" />
      {heights.map((h, i) => {
        const barH = (h / max) * 88;
        const x = 10 + i * (w + gap);
        return (
          <rect key={i} x={x} y={108 - barH} width={w} height={barH} rx="4" fill="#ef6351" stroke="#5c4033" strokeWidth="2" />
        );
      })}
    </svg>
  );
}
