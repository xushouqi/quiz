"use client";

import { useMemo } from "react";

const COLORS = ["#ff9f45", "#7bc950", "#ffd166", "#7ec8e3", "#ef6351", "#c78ff0"];

export function Confetti({ pieces = 40 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.4,
        color: COLORS[i % COLORS.length],
        size: 8 + Math.random() * 8,
        rounded: Math.random() > 0.5,
      })),
    [pieces]
  );
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute top-0 animate-fall"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size * 0.6,
            backgroundColor: b.color,
            borderRadius: b.rounded ? "9999px" : "2px",
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
