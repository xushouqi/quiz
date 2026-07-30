import { describe, expect, it } from "vitest";
import { parseIllustration } from "@/components/quiz/Illustration";

describe("parseIllustration", () => {
  it("parses null/undefined to none", () => {
    expect(parseIllustration(null)).toEqual({ kind: "none" });
    expect(parseIllustration(undefined)).toEqual({ kind: "none" });
  });
  it("parses emoji descriptors", () => {
    expect(parseIllustration("emoji:🍎🍎")).toEqual({ kind: "emoji", content: "🍎🍎" });
  });
  it("parses clock descriptors", () => {
    expect(parseIllustration("svg:clock:6:30")).toEqual({ kind: "clock", hour: 6, minute: 30 });
    expect(parseIllustration("svg:clock:3:00")).toEqual({ kind: "clock", hour: 3, minute: 0 });
  });
  it("parses grid and diagsquare", () => {
    expect(parseIllustration("svg:grid")).toEqual({ kind: "grid" });
    expect(parseIllustration("svg:diagsquare")).toEqual({ kind: "diagsquare" });
  });
  it("falls back to none for unknown descriptors", () => {
    expect(parseIllustration("svg:rocket")).toEqual({ kind: "none" });
    expect(parseIllustration("svg:clock:x:y")).toEqual({ kind: "none" });
  });
  it("parses dice descriptors", () => {
    expect(parseIllustration("svg:dice:5")).toEqual({ kind: "dice", pips: 5 });
    expect(parseIllustration("svg:dice:1")).toEqual({ kind: "dice", pips: 1 });
  });
  it("rejects out-of-range or malformed dice", () => {
    expect(parseIllustration("svg:dice:0")).toEqual({ kind: "none" });
    expect(parseIllustration("svg:dice:7")).toEqual({ kind: "none" });
    expect(parseIllustration("svg:dice:x")).toEqual({ kind: "none" });
  });
  it("parses bars descriptors", () => {
    expect(parseIllustration("svg:bars:3,5,2")).toEqual({ kind: "bars", heights: [3, 5, 2] });
  });
  it("rejects malformed bars", () => {
    expect(parseIllustration("svg:bars:")).toEqual({ kind: "none" });
    expect(parseIllustration("svg:bars:a,b")).toEqual({ kind: "none" });
    expect(parseIllustration("svg:bars:3,-1")).toEqual({ kind: "none" });
  });
});
