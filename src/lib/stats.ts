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

export function computeStars(db: Database): {
  stars: number;
  firstCorrect: number;
  totalCorrect: number;
} {
  const first = db
    .prepare(
      `SELECT COUNT(*) AS n FROM answers a
       WHERE a.is_correct = 1
         AND a.id = (SELECT MIN(b.id) FROM answers b WHERE b.question_id = a.question_id AND b.is_correct = 1)`
    )
    .get() as { n: number };
  const total = db
    .prepare("SELECT COUNT(*) AS n FROM answers WHERE is_correct = 1")
    .get() as { n: number };
  const firstCorrect = first.n;
  return { stars: firstCorrect * 3 + (total.n - firstCorrect), firstCorrect, totalCorrect: total.n };
}

export function computeStreak(db: Database, now: Date = new Date()): number {
  const rows = db
    .prepare("SELECT DISTINCT date(created_at / 1000, 'unixepoch', 'localtime') AS d FROM answers")
    .all() as { d: string }[];
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

export function getStats(db: Database, now: Date = new Date()): Stats {
  const { stars, totalCorrect } = computeStars(db);
  const perTopic = (Object.keys(TOPIC_LABELS) as Topic[]).map((topic) => {
    const row = db
      .prepare(
        `SELECT SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) AS correct, COUNT(*) AS total
         FROM answers a JOIN questions q ON q.id = a.question_id
         WHERE q.topic = ? AND a.chosen_index IS NOT NULL`
      )
      .get(topic) as { correct: number | null; total: number };
    return { topic, label: TOPIC_LABELS[topic], correct: row.correct ?? 0, total: row.total };
  });
  const finished = getFinishedExamSessions(db);
  const examScores = finished.map((s) => ({
    id: s.id,
    score: s.score ?? 0,
    maxScore: s.max_score ?? 120,
    finishedAt: s.finished_at ?? 0,
  }));
  const activeDays = (
    db
      .prepare("SELECT COUNT(DISTINCT date(created_at / 1000, 'unixepoch', 'localtime')) AS n FROM answers")
      .get() as { n: number }
  ).n;
  return {
    stars,
    totalCorrect,
    perTopic,
    examScores,
    streakDays: computeStreak(db, now),
    activeDays,
    lastExam: finished.length > 0 ? finished[finished.length - 1] : null,
  };
}
