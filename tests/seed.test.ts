import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { runSeed } from "@/scripts/seed";

describe("runSeed", () => {
  it("seeds 54 questions: 18 per difficulty, 9 per topic", () => {
    const db = openDb(":memory:");
    const n = runSeed(db);
    expect(n).toBe(54);

    const perDifficulty = db
      .prepare("SELECT difficulty, COUNT(*) AS n FROM questions GROUP BY difficulty ORDER BY difficulty")
      .all() as { difficulty: number; n: number }[];
    expect(perDifficulty).toEqual([
      { difficulty: 3, n: 18 },
      { difficulty: 4, n: 18 },
      { difficulty: 5, n: 18 },
    ]);

    const perTopic = db
      .prepare("SELECT topic, COUNT(*) AS n FROM questions GROUP BY topic ORDER BY topic")
      .all() as { topic: string; n: number }[];
    expect(perTopic).toEqual([
      { topic: "arithmetic", n: 9 },
      { topic: "counting", n: 9 },
      { topic: "logic", n: 9 },
      { topic: "patterns", n: 9 },
      { topic: "shapes", n: 9 },
      { topic: "time", n: 9 },
    ]);
  });

  it("stores choices as JSON with exactly 3 items", () => {
    const db = openDb(":memory:");
    runSeed(db);
    const row = db.prepare("SELECT choices FROM questions LIMIT 1").get() as { choices: string };
    const choices = JSON.parse(row.choices) as { zh: string; en: string }[];
    expect(choices).toHaveLength(3);
    expect(typeof choices[0].zh).toBe("string");
    expect(typeof choices[0].en).toBe("string");
  });

  it("every correct_index points at a real choice", () => {
    const db = openDb(":memory:");
    runSeed(db);
    const rows = db.prepare("SELECT choices, correct_index FROM questions").all() as {
      choices: string;
      correct_index: number;
    }[];
    for (const r of rows) {
      const choices = JSON.parse(r.choices) as unknown[];
      expect(r.correct_index).toBeGreaterThanOrEqual(0);
      expect(r.correct_index).toBeLessThan(choices.length);
    }
  });
});
