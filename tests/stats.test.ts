import { describe, expect, it } from "vitest";
import { addPracticeAnswer } from "@/lib/answers";
import { openDb } from "@/lib/db";
import { createSession } from "@/lib/sessions";
import { computeStars, computeStreak } from "@/lib/stats";

function insertQ(db: ReturnType<typeof openDb>): number {
  return Number(
    db
      .prepare(
        `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en)
         VALUES (3, 'counting', '题', 'q', '[]', 1, '解', 'a')`
      )
      .run().lastInsertRowid
  );
}

function dayMs(daysAgo: number, now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12, 0, 0).getTime();
}

describe("computeStars", () => {
  it("first correct = 3 stars, each later correct = 1 star", () => {
    const db = openDb(":memory:");
    const q1 = insertQ(db);
    const q2 = insertQ(db);
    const sid = createSession(db, "practice", 1);
    addPracticeAnswer(db, sid, q1, 0, false, 5, 100);
    addPracticeAnswer(db, sid, q1, 1, true, 5, 110); // first correct q1 → +3
    addPracticeAnswer(db, sid, q2, 1, true, 5, 120); // first correct q2 → +3
    addPracticeAnswer(db, sid, q1, 1, true, 5, 130); // repeat q1 → +1
    expect(computeStars(db).stars).toBe(7);
  });

  it("no answers means zero stars", () => {
    const db = openDb(":memory:");
    expect(computeStars(db).stars).toBe(0);
  });
});

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    const db = openDb(":memory:");
    const now = new Date(2026, 6, 28, 15, 0, 0);
    const q = insertQ(db);
    const sid = createSession(db, "practice", 1);
    addPracticeAnswer(db, sid, q, 1, true, 5, dayMs(0, now));
    addPracticeAnswer(db, sid, q, 1, true, 5, dayMs(1, now));
    addPracticeAnswer(db, sid, q, 1, true, 5, dayMs(2, now));
    expect(computeStreak(db, undefined, now)).toBe(3);
  });

  it("keeps the streak alive via yesterday when today is quiet", () => {
    const db = openDb(":memory:");
    const now = new Date(2026, 6, 28, 9, 0, 0);
    const q = insertQ(db);
    const sid = createSession(db, "practice", 1);
    addPracticeAnswer(db, sid, q, 1, true, 5, dayMs(1, now));
    addPracticeAnswer(db, sid, q, 1, true, 5, dayMs(2, now));
    expect(computeStreak(db, undefined, now)).toBe(2);
  });

  it("returns 0 when the streak is broken", () => {
    const db = openDb(":memory:");
    const now = new Date(2026, 6, 28, 9, 0, 0);
    const q = insertQ(db);
    const sid = createSession(db, "practice", 1);
    addPracticeAnswer(db, sid, q, 1, true, 5, dayMs(3, now));
    expect(computeStreak(db, undefined, now)).toBe(0);
  });
});
