import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { runSeed } from "@/scripts/seed";

const Q = {
  difficulty: 3,
  topic: "counting",
  text_zh: "1 + 1 = ？",
  text_en: "1 + 1 = ?",
  illustration: null,
  choices: [
    { zh: "1", en: "1" },
    { zh: "2", en: "2" },
    { zh: "3", en: "3" },
  ],
  correct_index: 1,
  explanation_zh: "1 再加 1 是 2。",
  explanation_en: "One more than 1 is 2.",
};

function makeBank(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "qbank-"));
}
function writeJson(base: string, sub: string, file: string, data: unknown): void {
  fs.mkdirSync(path.join(base, sub), { recursive: true });
  fs.writeFileSync(path.join(base, sub, file), JSON.stringify(data));
}
function sources(db: ReturnType<typeof openDb>) {
  return db.prepare("SELECT source, COUNT(*) AS n FROM questions GROUP BY source ORDER BY source").all() as {
    source: string;
    n: number;
  }[];
}

describe("runSeed (fixture banks)", () => {
  it("derives source from the subdirectory", () => {
    const base = makeBank();
    writeJson(base, "practice", "p.json", [Q]);
    writeJson(base, "official", "o.json", [{ ...Q, text_zh: "官方题", attribution: "MK-USA 2024 G1-2 Q1" }]);
    writeJson(base, "simulation", "s.json", [{ ...Q, text_zh: "仿真题" }]);
    const db = openDb(":memory:");
    const n = runSeed(db, base);
    expect(n).toBe(3);
    expect(sources(db)).toEqual([
      { source: "official", n: 1 },
      { source: "practice", n: 1 },
      { source: "simulation", n: 1 },
    ]);
  });

  it("passes attribution through for official questions", () => {
    const base = makeBank();
    writeJson(base, "practice", "p.json", [Q]);
    writeJson(base, "official", "o.json", [{ ...Q, attribution: "MK-IN G1-2 Q5" }]);
    const db = openDb(":memory:");
    runSeed(db, base);
    const row = db.prepare("SELECT attribution FROM questions WHERE source = 'official'").get() as {
      attribution: string | null;
    };
    expect(row.attribution).toBe("MK-IN G1-2 Q5");
  });

  it("tolerates missing official/simulation directories", () => {
    const base = makeBank();
    writeJson(base, "practice", "p.json", [Q, { ...Q, difficulty: 4 }]);
    const db = openDb(":memory:");
    const n = runSeed(db, base);
    expect(n).toBe(2);
    expect(sources(db)).toEqual([{ source: "practice", n: 2 }]);
  });

  it("tolerates an empty optional directory (no JSON files)", () => {
    const base = makeBank();
    writeJson(base, "practice", "p.json", [Q]);
    fs.mkdirSync(path.join(base, "official"), { recursive: true }); // 空目录
    const db = openDb(":memory:");
    expect(() => runSeed(db, base)).not.toThrow();
    expect(sources(db)).toEqual([{ source: "practice", n: 1 }]);
  });

  it("throws when the required practice bank is missing", () => {
    const base = makeBank();
    writeJson(base, "official", "o.json", [Q]);
    const db = openDb(":memory:");
    expect(() => runSeed(db, base)).toThrow(/practice/);
  });
});

describe("runSeed (real questions/ directory)", () => {
  it("seeds the practice bank: 126 questions, 42 per difficulty, 21 per topic, all source=practice", () => {
    const db = openDb(":memory:");
    runSeed(db);

    const practice = db.prepare("SELECT COUNT(*) AS n FROM questions WHERE source = 'practice'").get() as { n: number };
    expect(practice.n).toBe(126);

    const perDifficulty = db
      .prepare(
        "SELECT difficulty, COUNT(*) AS n FROM questions WHERE source = 'practice' GROUP BY difficulty ORDER BY difficulty"
      )
      .all() as { difficulty: number; n: number }[];
    expect(perDifficulty).toEqual([
      { difficulty: 3, n: 42 },
      { difficulty: 4, n: 42 },
      { difficulty: 5, n: 42 },
    ]);

    const perTopic = db
      .prepare(
        "SELECT topic, COUNT(*) AS n FROM questions WHERE source = 'practice' GROUP BY topic ORDER BY topic"
      )
      .all() as { topic: string; n: number }[];
    expect(perTopic).toEqual([
      { topic: "arithmetic", n: 21 },
      { topic: "counting", n: 21 },
      { topic: "logic", n: 21 },
      { topic: "patterns", n: 21 },
      { topic: "shapes", n: 21 },
      { topic: "time", n: 21 },
    ]);
  });

  it("official bank is non-empty, structurally valid, and not all answers in the same position", () => {
    const db = openDb(":memory:");
    runSeed(db);
    const officials = db.prepare("SELECT * FROM questions WHERE source = 'official'").all() as {
      attribution: string | null;
      choices: string;
      correct_index: number;
      difficulty: number;
      topic: string;
    }[];
    expect(officials.length).toBe(18);
    for (const o of officials) {
      expect(o.attribution && o.attribution.trim().length > 0).toBe(true);
      const choices = JSON.parse(o.choices) as unknown[];
      expect(choices).toHaveLength(3);
      expect(o.correct_index).toBeGreaterThanOrEqual(0);
      expect(o.correct_index).toBeLessThan(3);
      expect([3, 4, 5]).toContain(o.difficulty);
      expect(["counting", "shapes", "patterns", "logic", "arithmetic", "time"]).toContain(o.topic);
    }
    // answers must not all sit in the same choice position
    expect(new Set(officials.map((o) => o.correct_index)).size).toBeGreaterThanOrEqual(2);
    // difficulty spread: 2 at d3, 8 at d4, 8 at d5
    const counts = { 3: 0, 4: 0, 5: 0 } as Record<number, number>;
    for (const o of officials) counts[o.difficulty] += 1;
    expect(counts).toEqual({ 3: 2, 4: 8, 5: 8 });
  });

  it("simulation bank satisfies the >=8 per difficulty invariant", () => {
    const db = openDb(":memory:");
    runSeed(db);
    const perDifficulty = db
      .prepare(
        "SELECT difficulty, COUNT(*) AS n FROM questions WHERE source = 'simulation' GROUP BY difficulty ORDER BY difficulty"
      )
      .all() as { difficulty: number; n: number }[];
    const map = Object.fromEntries(perDifficulty.map((r) => [r.difficulty, r.n]));
    expect(map[3] ?? 0).toBeGreaterThanOrEqual(8);
    expect(map[4] ?? 0).toBeGreaterThanOrEqual(8);
    expect(map[5] ?? 0).toBeGreaterThanOrEqual(8);
  });

  it("simulation questions carry no attribution and are structurally valid", () => {
    const db = openDb(":memory:");
    runSeed(db);
    const sims = db.prepare("SELECT * FROM questions WHERE source = 'simulation'").all() as {
      attribution: string | null;
      choices: string;
      correct_index: number;
    }[];
    expect(sims.length).toBeGreaterThan(0);
    for (const s of sims) {
      expect(s.attribution).toBeNull();
      expect(JSON.parse(s.choices)).toHaveLength(3);
      expect(s.correct_index).toBeGreaterThanOrEqual(0);
      expect(s.correct_index).toBeLessThan(3);
    }
  });
});
