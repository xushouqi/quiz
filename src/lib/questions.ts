import type { Database } from "better-sqlite3";
import type { Question, Topic } from "./types";

export interface QuestionRow {
  id: number;
  difficulty: number;
  topic: string;
  text_zh: string;
  text_en: string;
  illustration: string | null;
  choices: string;
  correct_index: number;
  explanation_zh: string;
  explanation_en: string;
  source: string;
  attribution: string | null;
}

export function rowToQuestion(r: QuestionRow): Question {
  return {
    id: r.id,
    difficulty: r.difficulty as Question["difficulty"],
    topic: r.topic as Topic,
    text_zh: r.text_zh,
    text_en: r.text_en,
    illustration: r.illustration,
    choices: JSON.parse(r.choices) as Question["choices"],
    correct_index: r.correct_index,
    explanation_zh: r.explanation_zh,
    explanation_en: r.explanation_en,
    source: r.source as Question["source"],
    attribution: r.attribution,
  };
}

export function getQuestionsByIds(db: Database, ids: number[]): Question[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`)
    .all(...ids) as QuestionRow[];
  const byId = new Map(rows.map((r) => [r.id, rowToQuestion(r)]));
  return ids.map((id) => byId.get(id)).filter((q): q is Question => q !== undefined);
}

export function getPracticeQuestions(
  db: Database,
  topic: Topic | "random",
  limit: number
): Question[] {
  const rows =
    topic === "random"
      ? (db.prepare("SELECT * FROM questions ORDER BY RANDOM() LIMIT ?").all(limit) as QuestionRow[])
      : (db
          .prepare("SELECT * FROM questions WHERE topic = ? ORDER BY RANDOM() LIMIT ?")
          .all(topic, limit) as QuestionRow[]);
  return rows.map(rowToQuestion);
}

function pickExcluding(
  db: Database,
  difficulty: number,
  excludeIds: number[],
  limit: number
): QuestionRow[] {
  if (limit <= 0) return [];
  if (excludeIds.length === 0) {
    return db
      .prepare("SELECT * FROM questions WHERE difficulty = ? ORDER BY RANDOM() LIMIT ?")
      .all(difficulty, limit) as QuestionRow[];
  }
  const ph = excludeIds.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT * FROM questions WHERE difficulty = ? AND id NOT IN (${ph}) ORDER BY RANDOM() LIMIT ?`
    )
    .all(difficulty, ...excludeIds, limit) as QuestionRow[];
}

export function getLastExamSessionId(db: Database): number | null {
  const row = db
    .prepare(
      "SELECT id FROM sessions WHERE mode = 'exam' AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1"
    )
    .get() as { id: number } | undefined;
  return row?.id ?? null;
}

export function getExamQuestions(db: Database, perDifficulty = 8): Question[] {
  const lastId = getLastExamSessionId(db);
  const excluded =
    lastId === null
      ? []
      : (
          db
            .prepare("SELECT DISTINCT question_id AS id FROM answers WHERE session_id = ?")
            .all(lastId) as { id: number }[]
        ).map((r) => r.id);

  const out: QuestionRow[] = [];
  for (const difficulty of [3, 4, 5]) {
    let rows = pickExcluding(db, difficulty, excluded, perDifficulty);
    if (rows.length < perDifficulty) {
      const have = rows.map((r) => r.id);
      rows = [...rows, ...pickExcluding(db, difficulty, have, perDifficulty - rows.length)];
    }
    out.push(...rows);
  }
  return out.map(rowToQuestion);
}

export function getMistakeQuestions(db: Database, userId?: number): Question[] {
  const userParam = userId ? [userId] : [];

  const rows = db
    .prepare(
      `SELECT q.*
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       ${userId ? "JOIN sessions s ON s.id = a.session_id" : ""}
       WHERE a.id IN (SELECT MAX(id) FROM answers GROUP BY question_id)
         AND a.is_correct = 0
         ${userId ? "AND s.user_id = ?" : ""}
       ORDER BY a.id DESC`
    )
    .all(...userParam) as QuestionRow[];
  return rows.map(rowToQuestion);
}
