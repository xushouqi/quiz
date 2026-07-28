import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { runSeed } from "@/scripts/seed";

describe("runSeed", () => {
  it("seeds 27 questions, 9 per difficulty", () => {
    const db = openDb(":memory:");
    const n = runSeed(db);
    expect(n).toBe(27);
    const per = db
      .prepare("SELECT difficulty, COUNT(*) AS n FROM questions GROUP BY difficulty ORDER BY difficulty")
      .all() as { difficulty: number; n: number }[];
    expect(per).toEqual([
      { difficulty: 3, n: 9 },
      { difficulty: 4, n: 9 },
      { difficulty: 5, n: 9 },
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
});
