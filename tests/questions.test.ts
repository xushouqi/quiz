import type { Database } from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { getExamQuestions, getPracticeQuestions } from "@/lib/questions";

const CHOICES = JSON.stringify([
  { zh: "A", en: "A" },
  { zh: "B", en: "B" },
  { zh: "C", en: "C" },
]);

function seedFixture(db: Database, perDifficulty: number) {
  const insert = db.prepare(
    `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en)
     VALUES (?, 'counting', '题', 'q', ?, 0, '解', 'a')`
  );
  for (const d of [3, 4, 5]) {
    for (let i = 0; i < perDifficulty; i++) insert.run(d, CHOICES);
  }
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
});

describe("getExamQuestions", () => {
  it("draws perDifficulty from each difficulty band without duplicates", () => {
    const db = openDb(":memory:");
    seedFixture(db, 4);
    const rows = getExamQuestions(db, 2);
    expect(rows).toHaveLength(6);
    const counts: Record<number, number> = { 3: 0, 4: 0, 5: 0 };
    for (const r of rows) counts[r.difficulty] += 1;
    expect(counts).toEqual({ 3: 2, 4: 2, 5: 2 });
    expect(new Set(rows.map((r) => r.id)).size).toBe(6);
  });

  it("excludes questions used in the last finished exam", () => {
    const db = openDb(":memory:");
    seedFixture(db, 4); // difficulty-3 ids are 1,2,3,4
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
    seedFixture(db, 3);
    const sid = Number(
      db.prepare("INSERT INTO sessions (mode, started_at) VALUES ('exam', 1)").run().lastInsertRowid
    );
    db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, 1, 1)").run(sid);
    db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, 2, 1)").run(sid);
    db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, 3, 1)").run(sid);
    const d3 = getExamQuestions(db, 3).filter((r) => r.difficulty === 3);
    expect(d3).toHaveLength(3);
  });
});
