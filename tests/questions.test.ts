import type { Database } from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { examComposition, getExamQuestions, getPracticeQuestions } from "@/lib/questions";

const CHOICES = JSON.stringify([
  { zh: "A", en: "A" },
  { zh: "B", en: "B" },
  { zh: "C", en: "C" },
]);

function seedFixture(db: Database, perDifficulty: number, source: "practice" | "official" | "simulation" = "practice") {
  const insert = db.prepare(
    `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en, source)
     VALUES (?, 'counting', '题', 'q', ?, 0, '解', 'a', ?)`
  );
  for (const d of [3, 4, 5]) {
    for (let i = 0; i < perDifficulty; i++) insert.run(d, CHOICES, source);
  }
}

function insertAt(db: Database, difficulty: number, source: "official" | "simulation"): number {
  const info = db
    .prepare(
      `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en, source)
       VALUES (?, 'counting', '题', 'q', ?, 0, '解', 'a', ?)`
    )
    .run(difficulty, CHOICES, source);
  return Number(info.lastInsertRowid);
}

describe("getPracticeQuestions", () => {
  it("respects the limit", () => {
    const db = openDb(":memory:");
    seedFixture(db, 5);
    expect(getPracticeQuestions(db, "random", 4)).toHaveLength(4);
  });

  it("filters by topic", () => {
    const db = openDb(":memory:");
    seedFixture(db, 3);
    db.prepare(
      `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en)
       VALUES (3, 'logic', '题', 'q', ?, 0, '解', 'a')`
    ).run(CHOICES);
    const rows = getPracticeQuestions(db, "logic", 10);
    expect(rows).toHaveLength(1);
    expect(rows[0].topic).toBe("logic");
  });

  it("parses choices JSON into objects", () => {
    const db = openDb(":memory:");
    seedFixture(db, 1);
    const [q] = getPracticeQuestions(db, "random", 1);
    expect(q.choices).toHaveLength(3);
    expect(q.choices[0]).toEqual({ zh: "A", en: "A" });
  });

  it("returns only practice questions (excludes official/simulation)", () => {
    const db = openDb(":memory:");
    seedFixture(db, 2, "practice");
    insertAt(db, 3, "official");
    insertAt(db, 3, "simulation");
    const rows = getPracticeQuestions(db, "random", 50);
    expect(rows).toHaveLength(6); // 2 per difficulty × 3
    expect(rows.every((r) => r.source === "practice")).toBe(true);
  });
});

describe("getExamQuestions", () => {
  it("draws perDifficulty from each difficulty band without duplicates", () => {
    const db = openDb(":memory:");
    seedFixture(db, 4, "official");
    const rows = getExamQuestions(db, 2);
    expect(rows).toHaveLength(6);
    const counts: Record<number, number> = { 3: 0, 4: 0, 5: 0 };
    for (const r of rows) counts[r.difficulty] += 1;
    expect(counts).toEqual({ 3: 2, 4: 2, 5: 2 });
    expect(new Set(rows.map((r) => r.id)).size).toBe(6);
  });

  it("excludes questions used in the last finished exam", () => {
    const db = openDb(":memory:");
    seedFixture(db, 4, "official"); // difficulty-3 ids are 1,2,3,4
    const sid = Number(
      db.prepare("INSERT INTO sessions (mode, started_at, finished_at) VALUES ('exam', 1, 2)").run()
        .lastInsertRowid
    );
    db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, 1, 1)").run(sid);
    db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, 2, 1)").run(sid);

    const d3 = getExamQuestions(db, 2)
      .filter((r) => r.difficulty === 3)
      .map((r) => r.id);
    expect(d3).toHaveLength(2);
    expect(d3).not.toContain(1);
    expect(d3).not.toContain(2);
  });

  it("ignores unfinished exam sessions when excluding", () => {
    const db = openDb(":memory:");
    seedFixture(db, 3, "official");
    const sid = Number(
      db.prepare("INSERT INTO sessions (mode, started_at) VALUES ('exam', 1)").run().lastInsertRowid
    );
    db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, 1, 1)").run(sid);
    db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, 2, 1)").run(sid);
    db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, 3, 1)").run(sid);
    const d3 = getExamQuestions(db, 3).filter((r) => r.difficulty === 3);
    expect(d3).toHaveLength(3);
  });

  it("prefers official over simulation within a difficulty", () => {
    const db = openDb(":memory:");
    const officialIds = [insertAt(db, 3, "official"), insertAt(db, 3, "official"), insertAt(db, 3, "official")];
    for (let i = 0; i < 5; i++) insertAt(db, 3, "simulation");
    const d3 = getExamQuestions(db, 8).filter((r) => r.difficulty === 3);
    expect(d3).toHaveLength(8);
    for (const id of officialIds) expect(d3.map((r) => r.id)).toContain(id);
  });

  it("backfills with simulation when official < perDifficulty", () => {
    const db = openDb(":memory:");
    const officialIds = [insertAt(db, 4, "official"), insertAt(db, 4, "official")];
    for (let i = 0; i < 10; i++) insertAt(db, 4, "simulation");
    const d4 = getExamQuestions(db, 8).filter((r) => r.difficulty === 4);
    expect(d4).toHaveLength(8);
    for (const id of officialIds) expect(d4.map((r) => r.id)).toContain(id);
  });

  it("never draws practice questions into an exam", () => {
    const db = openDb(":memory:");
    seedFixture(db, 3, "practice");
    insertAt(db, 3, "official");
    insertAt(db, 4, "simulation");
    insertAt(db, 5, "simulation");
    const rows = getExamQuestions(db, 8);
    expect(rows.every((r) => r.source !== "practice")).toBe(true);
  });

  it("returns the available count when a difficulty has fewer than perDifficulty (no within-exam dup)", () => {
    const db = openDb(":memory:");
    const ids = [insertAt(db, 3, "simulation"), insertAt(db, 3, "simulation"), insertAt(db, 3, "simulation")];
    const d3 = getExamQuestions(db, 8).filter((r) => r.difficulty === 3);
    expect(d3).toHaveLength(3);
    expect(new Set(d3.map((r) => r.id)).size).toBe(3);
    for (const id of ids) expect(d3.map((r) => r.id)).toContain(id);
  });

  it("fallback re-includes last-exam questions when dedup leaves fewer than perDifficulty", () => {
    const db = openDb(":memory:");
    const ids = [insertAt(db, 3, "simulation"), insertAt(db, 3, "simulation"), insertAt(db, 3, "simulation")];
    const sid = Number(
      db.prepare("INSERT INTO sessions (mode, started_at, finished_at) VALUES ('exam', 1, 2)").run().lastInsertRowid
    );
    for (const id of ids) {
      db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, ?, 1)").run(sid, id);
    }
    const d3 = getExamQuestions(db, 8).filter((r) => r.difficulty === 3);
    expect(d3).toHaveLength(3); // 放宽去重后重新纳入这 3 题
    for (const id of ids) expect(d3.map((r) => r.id)).toContain(id);
  });
});

describe("examComposition", () => {
  it("counts official vs simulation questions", () => {
    const db = openDb(":memory:");
    seedFixture(db, 2, "official"); // 6 official
    seedFixture(db, 1, "simulation"); // 3 simulation
    const official = getExamQuestions(db, 6); // 取一批混合
    const comp = examComposition(official);
    expect(comp.official + comp.simulation).toBe(official.length);
    expect(comp.official).toBeGreaterThan(0);
  });
});
