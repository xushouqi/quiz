import { describe, expect, it, beforeEach } from "vitest";
import { POST } from "@/app/api/answers/route";
import { getDb } from "@/lib/db";
import type { Database } from "better-sqlite3";

/**
 * /api/answers 路由层测试:验证 chosenIndex 校验按题目真实选项数
 * (上实机考最多 8 选项),而非历史残留的硬编码 >2 约束。
 */

function resetDb(): Database.Database {
  // 重置 getDb 单例,并指向独立内存库
  (globalThis as unknown as { quizDb?: unknown }).quizDb = undefined;
  process.env.QUIZ_DB_PATH = ":memory:";
  return getDb();
}

function insertQuestion(db: Database, choiceCount: number, correctIndex: number): number {
  const choices = Array.from({ length: choiceCount }, (_, i) => ({ zh: String(i + 1), en: String(i + 1) }));
  const info = db
    .prepare(
      `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en, source)
       VALUES (3, 'counting', '题', 'q', ?, ?, '解', 'a', 'shangshi')`
    )
    .run(JSON.stringify(choices), correctIndex);
  return Number(info.lastInsertRowid);
}

function insertSession(db: Database): number {
  db.prepare("INSERT INTO users (name, emoji, created_at) VALUES ('测试', '🐨', 1)").run();
  const info = db
    .prepare("INSERT INTO sessions (user_id, mode, started_at) VALUES (1, 'practice', 1)")
    .run();
  return Number(info.lastInsertRowid);
}

function postAnswer(sessionId: number, questionId: number, chosenIndex: number): Promise<Response> {
  const req = new Request("http://localhost/api/answers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, questionId, chosenIndex, timeSpentSeconds: 3 }),
  });
  return POST(req);
}

beforeEach(() => {
  resetDb();
});

describe("answers route chosenIndex validation", () => {
  it("accepts chosenIndex beyond 2 for an 8-choice question (上实机考)", async () => {
    const db = resetDb();
    const qid = insertQuestion(db, 8, 7);
    const sid = insertSession(db);
    const res = await postAnswer(sid, qid, 7);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; isCorrect?: boolean };
    expect(body.isCorrect).toBe(true);
  });

  it("rejects chosenIndex at or beyond the question's choice count", async () => {
    const db = resetDb();
    const qid = insertQuestion(db, 3, 1);
    const sid = insertSession(db);
    const res = await postAnswer(sid, qid, 3);
    expect(res.status).toBe(400);
  });

  it("rejects a negative chosenIndex", async () => {
    const db = resetDb();
    const qid = insertQuestion(db, 3, 1);
    const sid = insertSession(db);
    const res = await postAnswer(sid, qid, -1);
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown question", async () => {
    const db = resetDb();
    const sid = insertSession(db);
    const res = await postAnswer(sid, 99999, 0);
    expect(res.status).toBe(404);
  });
});
