import { describe, expect, it } from "vitest";
import { addPracticeAnswer } from "@/lib/answers";
import { openDb } from "@/lib/db";
import { getMistakeQuestions } from "@/lib/questions";
import { createSession } from "@/lib/sessions";

function setup() {
  const db = openDb(":memory:");
  const insert = db.prepare(
    `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en)
     VALUES (3, 'counting', '题', 'q', '[]', 1, '解', 'a')`
  );
  const q1 = Number(insert.run().lastInsertRowid);
  const q2 = Number(insert.run().lastInsertRowid);
  const q3 = Number(insert.run().lastInsertRowid);
  const sid = createSession(db, "practice", 1);
  return { db, sid, q1, q2, q3 };
}

describe("getMistakeQuestions", () => {
  it("includes questions whose latest attempt is wrong", () => {
    const { db, sid, q2 } = setup();
    addPracticeAnswer(db, sid, q2, 0, false, 5, 100);
    expect(getMistakeQuestions(db).map((m) => m.id)).toEqual([q2]);
  });

  it("removes a question after a later correct retry", () => {
    const { db, sid, q2 } = setup();
    addPracticeAnswer(db, sid, q2, 0, false, 5, 100);
    addPracticeAnswer(db, sid, q2, 1, true, 6, 200);
    expect(getMistakeQuestions(db)).toEqual([]);
  });

  it("never lists a question answered correctly first time", () => {
    const { db, sid, q1 } = setup();
    addPracticeAnswer(db, sid, q1, 1, true, 5, 100);
    expect(getMistakeQuestions(db)).toEqual([]);
  });

  it("lists a question again if a later attempt is wrong", () => {
    const { db, sid, q3 } = setup();
    addPracticeAnswer(db, sid, q3, 1, true, 5, 100);
    addPracticeAnswer(db, sid, q3, 0, false, 5, 200);
    expect(getMistakeQuestions(db).map((m) => m.id)).toEqual([q3]);
  });
});
