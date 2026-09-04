import { describe, expect, it } from "vitest";
import { validateBank, validateQuestion } from "@/lib/validate";

const good = {
  difficulty: 3,
  topic: "counting",
  text_zh: "1 + 1 等于几？",
  text_en: "What is 1 + 1?",
  illustration: null,
  choices: [
    { zh: "1", en: "1" },
    { zh: "2", en: "2" },
    { zh: "3", en: "3" },
  ],
  correct_index: 1,
  explanation_zh: "1 再加 1 就是 2。",
  explanation_en: "One more than 1 is 2.",
};

describe("validateQuestion", () => {
  it("accepts a valid question", () => {
    expect(validateQuestion(good, "q")).toEqual([]);
  });
  it("rejects a bad difficulty", () => {
    const errors = validateQuestion({ ...good, difficulty: 7 }, "q");
    expect(errors.some((e) => e.includes("difficulty"))).toBe(true);
  });
  it("rejects a bad topic", () => {
    const errors = validateQuestion({ ...good, topic: "chess" }, "q");
    expect(errors.some((e) => e.includes("topic"))).toBe(true);
  });
  it("rejects choices outside the 2–8 range", () => {
    const tooFew = validateQuestion({ ...good, choices: good.choices.slice(0, 1) }, "q");
    expect(tooFew.some((e) => e.includes("choices"))).toBe(true);
    const tooMany = validateQuestion(
      {
        ...good,
        choices: [
          ...good.choices,
          { zh: "4", en: "4" },
          { zh: "5", en: "5" },
          { zh: "6", en: "6" },
          { zh: "7", en: "7" },
          { zh: "8", en: "8" },
          { zh: "9", en: "9" },
        ],
      },
      "q"
    );
    expect(tooMany.some((e) => e.includes("choices"))).toBe(true);
  });
  it("accepts 2 choices (上实机考原卷存在二选项题)", () => {
    const two = { ...good, choices: good.choices.slice(0, 2), correct_index: 1 };
    expect(validateQuestion(two, "q")).toEqual([]);
  });
  it("accepts 5 choices with correct_index up to 4", () => {
    const five = { ...good, choices: [...good.choices, { zh: "4", en: "4" }, { zh: "5", en: "5" }], correct_index: 4 };
    expect(validateQuestion(five, "q")).toEqual([]);
  });
  it("rejects correct_index out of range for the given choice count", () => {
    const errors = validateQuestion({ ...good, correct_index: 3 }, "q");
    expect(errors.some((e) => e.includes("correct_index"))).toBe(true);
  });
  it("rejects a bad correct_index", () => {
    const errors = validateQuestion({ ...good, correct_index: 5 }, "q");
    expect(errors.some((e) => e.includes("correct_index"))).toBe(true);
  });
  it("accepts an optional choice img string", () => {
    const withImg = {
      ...good,
      choices: [{ zh: "图一", en: "fig 1", img: "img:/questions-images/x.png" }, ...good.choices.slice(1)],
    };
    expect(validateQuestion(withImg, "q")).toEqual([]);
  });
  it("rejects a non-string choice img", () => {
    const bad = { ...good, choices: [{ zh: "a", en: "a", img: 5 }, ...good.choices.slice(1)] };
    const errors = validateQuestion(bad, "q");
    expect(errors.some((e) => e.includes("img"))).toBe(true);
  });
  it("rejects an empty text field", () => {
    const errors = validateQuestion({ ...good, text_en: "  " }, "q");
    expect(errors.some((e) => e.includes("text_en"))).toBe(true);
  });
  it("allows a missing illustration", () => {
    const { illustration: _drop, ...rest } = good;
    expect(validateQuestion(rest, "q")).toEqual([]);
  });
  it("accepts an optional attribution string", () => {
    expect(validateQuestion({ ...good, attribution: "MK-USA 2024 G1-2 Q3" }, "q")).toEqual([]);
  });
  it("rejects a non-string attribution", () => {
    const errors = validateQuestion({ ...good, attribution: 5 }, "q");
    expect(errors.some((e) => e.includes("attribution"))).toBe(true);
  });
  it("rejects an empty attribution string", () => {
    const errors = validateQuestion({ ...good, attribution: "  " }, "q");
    expect(errors.some((e) => e.includes("attribution"))).toBe(true);
  });
});

describe("validateBank", () => {
  it("normalizes a missing illustration to null", () => {
    const { illustration: _drop, ...rest } = good;
    const [q] = validateBank([rest]);
    expect(q.illustration).toBeNull();
  });
  it("throws a combined error message", () => {
    expect(() => validateBank([{ ...good, correct_index: 9 }])).toThrow(/correct_index/);
  });
  it("normalizes a missing attribution to null", () => {
    const [q] = validateBank([good]);
    expect(q.attribution).toBeNull();
  });
  it("preserves a provided attribution", () => {
    const [q] = validateBank([{ ...good, attribution: "MK-IN G1-2 Q1" }]);
    expect(q.attribution).toBe("MK-IN G1-2 Q1");
  });
});
