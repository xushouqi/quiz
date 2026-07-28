import type { Database } from "better-sqlite3";

export function insertExamPlaceholders(
  db: Database,
  sessionId: number,
  questionIds: number[],
  at: number
): void {
  const insert = db.prepare(
    "INSERT INTO answers (session_id, question_id, created_at) VALUES (?, ?, ?)"
  );
  const tx = db.transaction((ids: number[]) => {
    for (const questionId of ids) insert.run(sessionId, questionId, at);
  });
  tx(questionIds);
}

export function setExamAnswer(
  db: Database,
  sessionId: number,
  questionId: number,
  chosenIndex: number,
  isCorrect: boolean,
  timeSpentSeconds: number
): void {
  db.prepare(
    "UPDATE answers SET chosen_index = ?, is_correct = ?, time_spent_seconds = ? WHERE session_id = ? AND question_id = ?"
  ).run(chosenIndex, isCorrect ? 1 : 0, timeSpentSeconds, sessionId, questionId);
}

export function addPracticeAnswer(
  db: Database,
  sessionId: number,
  questionId: number,
  chosenIndex: number,
  isCorrect: boolean,
  timeSpentSeconds: number,
  at: number
): void {
  db.prepare(
    "INSERT INTO answers (session_id, question_id, chosen_index, is_correct, time_spent_seconds, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(sessionId, questionId, chosenIndex, isCorrect ? 1 : 0, timeSpentSeconds, at);
}

export function getCorrectIndex(db: Database, questionId: number): number | null {
  const row = db
    .prepare("SELECT correct_index FROM questions WHERE id = ?")
    .get(questionId) as { correct_index: number } | undefined;
  return row?.correct_index ?? null;
}
