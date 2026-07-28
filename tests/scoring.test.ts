import { describe, expect, it } from "vitest";
import { BASE_SCORE, scoreExam } from "@/lib/scoring";

const block = (difficulty: number, chosen: number | null, correctIndex: number, n: number) =>
  Array.from({ length: n }, () => ({ difficulty, chosen, correctIndex }));

describe("scoreExam", () => {
  it("all correct: 24 + 8*3 + 8*4 + 8*5 = 120", () => {
    const answers = [
      ...block(3, 0, 0, 8),
      ...block(4, 1, 1, 8),
      ...block(5, 2, 2, 8),
    ];
    expect(scoreExam(answers)).toEqual({
      score: 120,
      maxScore: 120,
      correct: 24,
      wrong: 0,
      blank: 0,
    });
  });

  it("all wrong: 24 - 24 = 0", () => {
    const answers = [
      ...block(3, 1, 0, 8),
      ...block(4, 1, 0, 8),
      ...block(5, 1, 0, 8),
    ];
    const r = scoreExam(answers);
    expect(r.score).toBe(0);
    expect(r.wrong).toBe(24);
  });

  it("all blank: stays at base score 24", () => {
    const answers = block(5, null, 0, 24);
    const r = scoreExam(answers);
    expect(r).toEqual({ score: BASE_SCORE, maxScore: 24 + 120, correct: 0, wrong: 0, blank: 24 });
  });

  it("mixed: correct adds difficulty, wrong subtracts 1, blank adds 0", () => {
    const r = scoreExam([
      { difficulty: 3, chosen: 0, correctIndex: 0 },
      { difficulty: 5, chosen: 1, correctIndex: 0 },
      { difficulty: 4, chosen: null, correctIndex: 2 },
    ]);
    expect(r).toEqual({ score: 26, maxScore: 36, correct: 1, wrong: 1, blank: 1 });
  });
});
