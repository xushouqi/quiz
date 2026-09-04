import type { Database } from "better-sqlite3";
import type { Question, Source, Topic } from "./types";

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
      ? (db.prepare("SELECT * FROM questions WHERE source = 'practice' ORDER BY RANDOM() LIMIT ?").all(limit) as QuestionRow[])
      : (db
          .prepare("SELECT * FROM questions WHERE source = 'practice' AND topic = ? ORDER BY RANDOM() LIMIT ?")
          .all(topic, limit) as QuestionRow[]);
  return rows.map(rowToQuestion);
}

export function getShangshiQuestions(
  db: Database,
  topic: Topic | "random",
  limit: number
): Question[] {
  const rows =
    topic === "random"
      ? (db.prepare("SELECT * FROM questions WHERE source = 'shangshi' ORDER BY id LIMIT ?").all(limit) as QuestionRow[])
      : (db
          .prepare("SELECT * FROM questions WHERE source = 'shangshi' AND topic = ? ORDER BY id LIMIT ?")
          .all(topic, limit) as QuestionRow[]);
  return rows.map(rowToQuestion);
}

/** 奥数练习：可按主题和难度区间筛选题目。difficulty 为 1–6。 */
export function getOlympiadQuestions(
  db: Database,
  topic: Topic | "random",
  limit: number,
  diffMin = 1,
  diffMax = 6
): Question[] {
  const lo = Math.min(Math.max(1, Math.floor(diffMin)), 6);
  const hi = Math.min(Math.max(lo, Math.floor(diffMax)), 6);
  const rows =
    topic === "random"
      ? (db
          .prepare(
            "SELECT * FROM questions WHERE source = 'olympiad' AND difficulty BETWEEN ? AND ? ORDER BY RANDOM() LIMIT ?"
          )
          .all(lo, hi, limit) as QuestionRow[])
      : (db
          .prepare(
            "SELECT * FROM questions WHERE source = 'olympiad' AND topic = ? AND difficulty BETWEEN ? AND ? ORDER BY RANDOM() LIMIT ?"
          )
          .all(topic, lo, hi, limit) as QuestionRow[]);
  return rows.map(rowToQuestion);
}

/** 某个难度区间内奥数题的数量，用于页面提示。 */
export function countOlympiadQuestions(db: Database, diffMin = 1, diffMax = 6): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS n FROM questions WHERE source = 'olympiad' AND difficulty BETWEEN ? AND ?"
    )
    .get(Math.min(Math.max(1, Math.floor(diffMin)), 6), Math.min(Math.max(1, Math.floor(diffMax)), 6)) as {
    n: number;
  };
  return row?.n ?? 0;
}

function pickExcluding(
  db: Database,
  difficulty: number,
  excludeIds: number[],
  sources: Source[],
  limit: number
): QuestionRow[] {
  if (limit <= 0) return [];
  const srcPh = sources.map(() => "?").join(",");
  if (excludeIds.length === 0) {
    return db
      .prepare(`SELECT * FROM questions WHERE difficulty = ? AND source IN (${srcPh}) ORDER BY RANDOM() LIMIT ?`)
      .all(difficulty, ...sources, limit) as QuestionRow[];
  }
  const ph = excludeIds.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT * FROM questions WHERE difficulty = ? AND source IN (${srcPh}) AND id NOT IN (${ph}) ORDER BY RANDOM() LIMIT ?`
    )
    .all(difficulty, ...sources, ...excludeIds, limit) as QuestionRow[];
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
  for (const difficulty of [1, 2, 3, 4, 5, 6]) {
    const officials = pickExcluding(db, difficulty, excluded, ["official"], perDifficulty);
    const officialIds = officials.map((r) => r.id);
    const sims = pickExcluding(
      db,
      difficulty,
      [...excluded, ...officialIds],
      ["simulation"],
      perDifficulty - officials.length
    );
    let rows = [...officials, ...sims];
    if (rows.length < perDifficulty) {
      const have = rows.map((r) => r.id);
      rows = [...rows, ...pickExcluding(db, difficulty, have, ["official", "simulation"], perDifficulty - rows.length)];
    }
    out.push(...rows);
  }
  return out.map(rowToQuestion);
}

export function examComposition(questions: Question[]): { official: number; simulation: number } {
  let official = 0;
  let simulation = 0;
  for (const q of questions) {
    if (q.source === "official") official += 1;
    else if (q.source === "simulation") simulation += 1;
  }
  return { official, simulation };
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
