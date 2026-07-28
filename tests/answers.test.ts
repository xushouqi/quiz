import type { Database } from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { addPracticeAnswer, insertExamPlaceholders, setExamAnswer } from "@/lib/answers";
import { createSession, finishSession, getAnswersForSession, getSession } from "@/lib/sessions";
import { scoreExam } from "@/lib/scoring";

function makeQuestions(db: Database, rows: [number, number][]): number[] {
  const insert = db.prepare(
    `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en)
     VALUES (?, 'counting', '题', 'q', '[{"zh":"A","en":"A"},{"zh":"B","en":"B"},{"zh":"C","en":"C"}]', ?, '解', 'a')`
  );
  return rows.map(([d, c]) => Number(insert.run(d, c).lastInsertRowid));
}

describe("exam flow", () => {
  it("placeholders → updates → finish with official scoring", () => {
    const db = openDb(":memory:");
    const [q3, q4, q5] = makeQuestions(db, [
      [3, 0],
      [4, 1],
      [5, 2],
    ]);
    const sid = createSession(db, "exam", 1000);
    insertExamPlaceholders(db, sid, [q3, q4, q5], 1000);

    const before = getAnswersForSession(db, sid);
    expect(before).toHaveLength(3);
    expect(before.every((a) => a.chosen_index === null)).toBe(true);

    setExamAnswer(db, sid, q3, 0, true, 30); // +3
    setExamAnswer(db, sid, q4, 0, false, 40); // -1
    // q5 stays blank

    const answers = getAnswersForSession(db, sid);
    const meta: Record<number, { difficulty: number; correctIndex: number }> = {
      [q3]: { difficulty: 3, correctIndex: 0 },
      [q4]: { difficulty: 4, correctIndex: 1 },
      [q5]: { difficulty: 5, correctIndex: 2 },
    };
    const result = scoreExam(
      answers.map((a) => ({
        difficulty: meta[a.question_id].difficulty,
        chosen: a.chosen_index,
        correctIndex: meta[a.question_id].correctIndex,
      }))
    );
    expect(result).toEqual({ score: 26, maxScore: 36, correct: 1, wrong: 1, blank: 1 });

    finishSession(
      db,
      sid,
      {
        score: result.score,
        maxScore: result.maxScore,
        correct: result.correct,
        wrong: result.wrong,
        blank: result.blank,
        durationSeconds: 120,
      },
      2000
    );
    const session = getSession(db, sid);
    expect(session?.score).toBe(26);
    expect(session?.max_score).toBe(36);
    expect(session?.blank_count).toBe(1);
    expect(session?.finished_at).toBe(2000);
  });

  it("setExamAnswer does not add rows, only updates the placeholder", () => {
    const db = openDb(":memory:");
    const [q] = makeQuestions(db, [[3, 0]]);
    const sid = createSession(db, "exam", 1);
    insertExamPlaceholders(db, sid, [q], 1);
    setExamAnswer(db, sid, q, 0, true, 10);
    setExamAnswer(db, sid, q, 1, false, 15);
    expect(getAnswersForSession(db, sid)).toHaveLength(1);
  });
});

describe("practice flow", () => {
  it("appends one row per attempt, keeping order", () => {
    const db = openDb(":memory:");
    const [q] = makeQuestions(db, [[3, 1]]);
    const sid = createSession(db, "practice", 1000);
    addPracticeAnswer(db, sid, q, 0, false, 10, 1001);
    addPracticeAnswer(db, sid, q, 1, true, 12, 1002);
    const answers = getAnswersForSession(db, sid);
    expect(answers).toHaveLength(2);
    expect(answers.map((a) => a.is_correct)).toEqual([0, 1]);
    expect(answers.map((a) => a.chosen_index)).toEqual([0, 1]);
  });
});
