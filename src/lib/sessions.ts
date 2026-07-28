import type { Database } from "better-sqlite3";
import type { AnswerRow, SessionRow } from "./types";

export function createSession(db: Database, mode: "practice" | "exam", startedAt: number): number {
  const info = db.prepare("INSERT INTO sessions (mode, started_at) VALUES (?, ?)").run(mode, startedAt);
  return Number(info.lastInsertRowid);
}

export function getSession(db: Database, id: number): SessionRow | null {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
  return row ?? null;
}

export function getAnswersForSession(db: Database, sessionId: number): AnswerRow[] {
  return db
    .prepare("SELECT * FROM answers WHERE session_id = ? ORDER BY id")
    .all(sessionId) as AnswerRow[];
}

export interface FinishStats {
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  blank: number;
  durationSeconds: number | null;
}

export function finishSession(db: Database, id: number, stats: FinishStats, finishedAt: number): void {
  db.prepare(
    `UPDATE sessions
     SET finished_at = ?, score = ?, max_score = ?, correct_count = ?, wrong_count = ?, blank_count = ?, duration_seconds = ?
     WHERE id = ?`
  ).run(
    finishedAt,
    stats.score,
    stats.maxScore,
    stats.correct,
    stats.wrong,
    stats.blank,
    stats.durationSeconds,
    id
  );
}

export function getFinishedExamSessions(db: Database): SessionRow[] {
  return db
    .prepare("SELECT * FROM sessions WHERE mode = 'exam' AND finished_at IS NOT NULL ORDER BY id ASC")
    .all() as SessionRow[];
}
