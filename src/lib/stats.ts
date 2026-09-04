import type { Database } from "better-sqlite3";
import { getFinishedExamSessions } from "./sessions";
import type { SessionRow, Topic } from "./types";

export const TOPIC_LABELS: Record<Topic, string> = {
  counting: "数数",
  shapes: "图形",
  patterns: "规律",
  logic: "逻辑",
  arithmetic: "计算",
  time: "时间",
  number_theory: "数论",
  word_problems: "应用题",
  combinatorics: "组合",
  travel: "行程",
};

export interface Stats {
  stars: number;
  totalCorrect: number;
  perTopic: { topic: Topic; label: string; correct: number; total: number }[];
  examScores: { id: number; score: number; maxScore: number; finishedAt: number }[];
  streakDays: number;
  activeDays: number;
  lastExam: SessionRow | null;
}

export function computeStars(db: Database, userId?: number): {
  stars: number;
  firstCorrect: number;
  totalCorrect: number;
} {
  const userFilter = userId ? "AND s.user_id = ?" : "";
  const userParam = userId ? [userId] : [];

  const first = db
    .prepare(
      `SELECT COUNT(*) AS n FROM answers a
       JOIN sessions s ON s.id = a.session_id
       WHERE a.is_correct = 1
         AND a.id = (SELECT MIN(b.id) FROM answers b WHERE b.question_id = a.question_id AND b.is_correct = 1)
         ${userFilter}`
    )
    .get(...userParam) as { n: number };
  const total = db
    .prepare(
      `SELECT COUNT(*) AS n FROM answers a
       JOIN sessions s ON s.id = a.session_id
       WHERE a.is_correct = 1 ${userFilter}`
    )
    .get(...userParam) as { n: number };
  const firstCorrect = first.n;
  return { stars: firstCorrect * 3 + (total.n - firstCorrect), firstCorrect, totalCorrect: total.n };
}

export function computeStreak(db: Database, userId?: number, now: Date = new Date()): number {
  const userFilter = userId ? "JOIN sessions s ON s.id = a.session_id WHERE s.user_id = ?" : "";
  const userParam = userId ? [userId] : [];

  const rows = db
    .prepare(
      `SELECT DISTINCT date(a.created_at / 1000, 'unixepoch', 'localtime') AS d
       FROM answers a ${userFilter}`
    )
    .all(...userParam) as { d: string }[];
  const days = new Set(rows.map((r) => r.d));
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(fmt(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getStats(db: Database, userId?: number, now: Date = new Date()): Stats {
  const { stars, totalCorrect } = computeStars(db, userId);
  const userFilter = userId ? "JOIN sessions s ON s.id = a.session_id WHERE s.user_id = ?" : "";
  const userParam = userId ? [userId] : [];

  const perTopic = (Object.keys(TOPIC_LABELS) as Topic[]).map((topic) => {
    const row = db
      .prepare(
        `SELECT SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) AS correct, COUNT(*) AS total
         FROM answers a
         JOIN questions q ON q.id = a.question_id
         ${userId ? "JOIN sessions s ON s.id = a.session_id" : ""}
         WHERE q.topic = ? AND a.chosen_index IS NOT NULL ${userId ? "AND s.user_id = ?" : ""}`
      )
      .get(topic, ...(userId ? [userId] : [])) as { correct: number | null; total: number };
    return { topic, label: TOPIC_LABELS[topic], correct: row.correct ?? 0, total: row.total };
  });
  const finished = getFinishedExamSessions(db, userId);
  const examScores = finished.map((s) => ({
    id: s.id,
    score: s.score ?? 0,
    maxScore: s.max_score ?? 120,
    finishedAt: s.finished_at ?? 0,
  }));
  const activeDays = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT date(a.created_at / 1000, 'unixepoch', 'localtime')) AS n
         FROM answers a ${userFilter}`
      )
      .get(...userParam) as { n: number }
  ).n;
  return {
    stars,
    totalCorrect,
    perTopic,
    examScores,
    streakDays: computeStreak(db, userId, now),
    activeDays,
    lastExam: finished.length > 0 ? finished[finished.length - 1] : null,
  };
}
