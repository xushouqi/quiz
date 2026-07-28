import { describe, expect, it } from "vitest";
import { encouragement, formatClock } from "@/lib/format";

describe("formatClock", () => {
  it("formats 75 minutes", () => expect(formatClock(4500)).toBe("75:00"));
  it("pads seconds", () => expect(formatClock(59)).toBe("0:59"));
  it("clamps negatives to zero", () => expect(formatClock(-5)).toBe("0:00"));
});

describe("encouragement", () => {
  it("returns 4 distinct bands", () => {
    const top = encouragement(110, 120);
    const high = encouragement(90, 120);
    const mid = encouragement(70, 120);
    const low = encouragement(30, 120);
    const texts = new Set([top.zh, high.zh, mid.zh, low.zh]);
    expect(texts.size).toBe(4);
    expect(top.en.length).toBeGreaterThan(0);
  });
});
