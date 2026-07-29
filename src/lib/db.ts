import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🐨',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  difficulty INTEGER NOT NULL CHECK (difficulty IN (3, 4, 5)),
  topic TEXT NOT NULL CHECK (topic IN ('counting', 'shapes', 'patterns', 'logic', 'arithmetic', 'time')),
  text_zh TEXT NOT NULL,
  text_en TEXT NOT NULL,
  illustration TEXT,
  choices TEXT NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index IN (0, 1, 2)),
  explanation_zh TEXT NOT NULL,
  explanation_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('practice', 'exam')),
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  score INTEGER,
  max_score INTEGER,
  correct_count INTEGER,
  wrong_count INTEGER,
  blank_count INTEGER,
  duration_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  chosen_index INTEGER CHECK (chosen_index IS NULL OR chosen_index IN (0, 1, 2)),
  is_correct INTEGER CHECK (is_correct IS NULL OR is_correct IN (0, 1)),
  time_spent_seconds INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
`;

export function openDb(dbPath: string): Database.Database {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

const globalForDb = globalThis as unknown as { quizDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.quizDb) {
    const dbPath = process.env.QUIZ_DB_PATH ?? path.join(process.cwd(), "data", "quiz.db");
    globalForDb.quizDb = openDb(dbPath);
  }
  return globalForDb.quizDb;
}
