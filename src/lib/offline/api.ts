/**
 * 离线 API 适配器:把 /api/* 请求全部在本地处理。
 *
 * 复刻 app/api 各路由 + lib/* 的服务端逻辑,数据来自:
 *   - 题库:src/lib/offline/data-embedded.ts(OFFLINE_DATA,构建时内嵌)
 *   - 用户/会话/作答:localStorage(见 storage.ts)
 *   - 朗读音频:src/lib/offline/audio-map.ts(OFFLINE_AUDIO,预生成 mp3)
 */
import { OFFLINE_DATA } from "./data-embedded";
import { OFFLINE_AUDIO } from "./audio-map";
import type { Question, Source, Topic } from "../types";
import {
  readUsers,
  writeUsers,
  readSessions,
  writeSessions,
  readAnswers,
  writeAnswers,
  nextSeq,
  type OfflineUser,
  type OfflineSession,
  type OfflineAnswer,
} from "./storage";

const QUESTIONS: Question[] = OFFLINE_DATA.questions as unknown as Question[];

const TOPICS: Topic[] = ["counting", "shapes", "patterns", "logic", "arithmetic", "time", "number_theory", "word_problems", "combinatorics", "travel"];
const SOURCES: Source[] = ["practice", "official", "simulation", "shangshi", "olympiad"];
const BASE_SCORE = 24;
const EXAM_LENGTH = 24;
const EXAM_MINUTES = 75;

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function questionById(id: number): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

function sessionById(id: number): OfflineSession | undefined {
  return readSessions().find((s) => s.id === id);
}

function answersOfSession(sessionId: number): OfflineAnswer[] {
  return readAnswers()
    .filter((a) => a.session_id === sessionId)
    .sort((a, b) => a.id - b.id);
}

// ---------------------------------------------------------------------------
// 题库查询
// ---------------------------------------------------------------------------

function getPracticeQuestions(topic: Topic | "random", limit: number): Question[] {
  const pool = QUESTIONS.filter((q) => q.source === "practice");
  const filtered = topic === "random" ? pool : pool.filter((q) => q.topic === topic);
  return shuffle(filtered).slice(0, limit);
}

function getShangshiQuestions(topic: Topic | "random", limit: number): Question[] {
  const pool = QUESTIONS.filter((q) => q.source === "shangshi").sort((a, b) => a.id - b.id);
  const filtered = topic === "random" ? pool : pool.filter((q) => q.topic === topic);
  return filtered.slice(0, limit);
}

function pickExcluding(
  difficulty: number,
  excludeIds: Set<number>,
  sources: Source[],
  limit: number
): Question[] {
  if (limit <= 0) return [];
  const pool = QUESTIONS.filter(
    (q) => q.difficulty === difficulty && sources.includes(q.source) && !excludeIds.has(q.id)
  );
  return shuffle(pool).slice(0, limit);
}

function getExamQuestions(): Question[] {
  const finished = readSessions()
    .filter((s) => s.mode === "exam" && s.finished_at !== null)
    .sort((a, b) => b.id - a.id);
  const lastId = finished[0]?.id ?? null;
  const excluded =
    lastId === null
      ? new Set<number>()
      : new Set(readAnswers().filter((a) => a.session_id === lastId).map((a) => a.question_id));

  const out: Question[] = [];
  for (const difficulty of [1, 2, 3, 4, 5, 6]) {
    const officials = pickExcluding(difficulty, excluded, ["official"], 8);
    const officialIds = new Set(officials.map((q) => q.id));
    const sims = pickExcluding(
      difficulty,
      new Set([...excluded, ...officialIds]),
      ["simulation"],
      8 - officials.length
    );
    let rows = [...officials, ...sims];
    if (rows.length < 8) {
      const have = new Set(rows.map((q) => q.id));
      rows = [
        ...rows,
        ...pickExcluding(difficulty, have, ["official", "simulation"], 8 - rows.length),
      ];
    }
    out.push(...rows);
  }
  return out;
}

function getMistakeQuestions(userId: number | undefined): Question[] {
  const answers = readAnswers();
  // 每题取最新一条作答(全局,与 SQL 语义一致)
  const latest = new Map<number, OfflineAnswer>();
  for (const a of answers) {
    const prev = latest.get(a.question_id);
    if (!prev || a.id > prev.id) latest.set(a.question_id, a);
  }
  const sessions = readSessions();
  const sessionByIdMap = new Map(sessions.map((s) => [s.id, s]));
  const ids = [...latest.values()]
    .filter((a) => {
      if (a.is_correct !== 0) return false;
      const s = sessionByIdMap.get(a.session_id);
      return userId === undefined || s?.user_id === userId;
    })
    .sort((a, b) => b.id - a.id)
    .map((a) => a.question_id);
  return ids.map((id) => questionById(id)).filter((q): q is Question => q !== undefined);
}

// ---------------------------------------------------------------------------
// 用户
// ---------------------------------------------------------------------------

function listUsers(): OfflineUser[] {
  return readUsers().sort((a, b) => b.created_at - a.created_at);
}

function createUser(name: string, emoji: string): OfflineUser {
  const user: OfflineUser = { id: nextSeq("users"), name, emoji, created_at: Date.now() };
  writeUsers([...readUsers(), user]);
  return user;
}

function updateUser(id: number, patch: { name?: string; emoji?: string }): boolean {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  if (patch.name !== undefined) users[idx].name = patch.name;
  if (patch.emoji !== undefined) users[idx].emoji = patch.emoji;
  writeUsers(users);
  return true;
}

function deleteUser(id: number): boolean {
  const users = readUsers();
  if (!users.some((u) => u.id === id)) return false;
  // 级联删除(与 DB 外键 ON DELETE CASCADE 一致)
  const sessions = readSessions();
  const sessionIds = new Set(sessions.filter((s) => s.user_id === id).map((s) => s.id));
  writeSessions(sessions.filter((s) => s.user_id !== id));
  writeAnswers(readAnswers().filter((a) => !sessionIds.has(a.session_id)));
  writeUsers(users.filter((u) => u.id !== id));
  return true;
}

// ---------------------------------------------------------------------------
// 会话与作答
// ---------------------------------------------------------------------------

function createSession(mode: "practice" | "exam", userId: number): OfflineSession {
  const session: OfflineSession = {
    id: nextSeq("sessions"),
    user_id: userId,
    mode,
    started_at: Date.now(),
    finished_at: null,
    score: null,
    max_score: null,
    correct_count: null,
    wrong_count: null,
    blank_count: null,
    duration_seconds: null,
  };
  writeSessions([...readSessions(), session]);
  return session;
}

function insertExamPlaceholders(sessionId: number, questionIds: number[]): void {
  const at = Date.now();
  const answers = readAnswers();
  const rows: OfflineAnswer[] = questionIds.map((qid) => ({
    id: nextSeq("answers"),
    session_id: sessionId,
    question_id: qid,
    chosen_index: null,
    is_correct: null,
    time_spent_seconds: null,
    created_at: at,
  }));
  writeAnswers([...answers, ...rows]);
}

function addPracticeAnswer(
  sessionId: number,
  questionId: number,
  chosenIndex: number,
  isCorrect: boolean,
  timeSpentSeconds: number
): void {
  const answers = readAnswers();
  answers.push({
    id: nextSeq("answers"),
    session_id: sessionId,
    question_id: questionId,
    chosen_index: chosenIndex,
    is_correct: isCorrect ? 1 : 0,
    time_spent_seconds: timeSpentSeconds,
    created_at: Date.now(),
  });
  writeAnswers(answers);
}

function setExamAnswer(
  sessionId: number,
  questionId: number,
  chosenIndex: number,
  isCorrect: boolean,
  timeSpentSeconds: number
): void {
  const answers = readAnswers();
  const row = answers.find(
    (a) => a.session_id === sessionId && a.question_id === questionId
  );
  if (!row) return;
  row.chosen_index = chosenIndex;
  row.is_correct = isCorrect ? 1 : 0;
  row.time_spent_seconds = timeSpentSeconds;
  writeAnswers(answers);
}

function scoreExam(answers: OfflineAnswer[]): {
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  blank: number;
} {
  let score = BASE_SCORE;
  let maxScore = BASE_SCORE;
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  for (const a of answers) {
    const q = questionById(a.question_id);
    const difficulty = q?.difficulty ?? 0;
    maxScore += difficulty;
    if (a.chosen_index === null) {
      blank += 1;
    } else if (q && a.chosen_index === q.correct_index) {
      correct += 1;
      score += difficulty;
    } else {
      wrong += 1;
      score -= 1;
    }
  }
  return { score, maxScore, correct, wrong, blank };
}

function finishSession(
  sessionId: number,
  stats: { score: number; maxScore: number; correct: number; wrong: number; blank: number },
  durationSeconds: number | null
): boolean {
  const sessions = readSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return false;
  const s = sessions[idx];
  if (s.mode !== "exam") return false;
  if (s.finished_at !== null) return false;
  sessions[idx] = {
    ...s,
    finished_at: Date.now(),
    score: stats.score,
    max_score: stats.maxScore,
    correct_count: stats.correct,
    wrong_count: stats.wrong,
    blank_count: stats.blank,
    duration_seconds: durationSeconds,
  };
  writeSessions(sessions);
  return true;
}

// ---------------------------------------------------------------------------
// 统计(stars / streak / perTopic / examScores / activeDays)
// ---------------------------------------------------------------------------

function ownAnswers(userId?: number): OfflineAnswer[] {
  if (userId === undefined) return readAnswers();
  const sessionUserIds = new Map(readSessions().map((s) => [s.id, s.user_id]));
  return readAnswers().filter((a) => sessionUserIds.get(a.session_id) === userId);
}

function computeStars(userId?: number): { stars: number; totalCorrect: number } {
  const correctAnswers = ownAnswers(userId).filter((a) => a.is_correct === 1);
  // 每题最早答对的 answer id(即 first-correct)
  const firstById = new Map<number, number>();
  for (const a of correctAnswers) {
    if (!firstById.has(a.question_id)) firstById.set(a.question_id, a.id);
  }
  const firstCorrect = correctAnswers.filter(
    (a) => firstById.get(a.question_id) === a.id
  ).length;
  const total = correctAnswers.length;
  return { stars: firstCorrect * 3 + (total - firstCorrect), totalCorrect: total };
}

function fmtDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function computeStreak(userId?: number, now: Date = new Date()): number {
  const days = new Set(ownAnswers(userId).map((a) => fmtDay(a.created_at)));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(fmtDay(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(fmtDay(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getStats(userId: number) {
  const { stars, totalCorrect } = computeStars(userId);
  const own = ownAnswers(userId).filter((a) => a.chosen_index !== null);
  const TOPIC_LABEL: Record<Topic, string> = {
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
  const perTopic = TOPICS.map((topic) => {
    const rows = own.filter((a) => questionById(a.question_id)?.topic === topic);
    const correct = rows.filter((a) => a.is_correct === 1).length;
    return {
      topic,
      label: TOPIC_LABEL[topic],
      correct,
      total: rows.length,
    };
  });
  const finished = readSessions()
    .filter((s) => s.user_id === userId && s.mode === "exam" && s.finished_at !== null)
    .sort((a, b) => a.id - b.id);
  const examScores = finished.map((s) => ({
    id: s.id,
    score: s.score ?? 0,
    maxScore: s.max_score ?? 120,
    finishedAt: s.finished_at ?? 0,
  }));
  const activeDays = new Set(ownAnswers(userId).map((a) => fmtDay(a.created_at))).size;
  const lastExam = finished.length > 0 ? finished[finished.length - 1] : null;
  return {
    stars,
    totalCorrect,
    perTopic,
    examScores,
    streakDays: computeStreak(userId),
    activeDays,
    lastExam,
  };
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

export async function handleOfflineFetch(
  pathWithQuery: string,
  init: RequestInit | undefined,
  origFetch: typeof fetch
): Promise<Response> {
  const [path, query = ""] = pathWithQuery.split("?");
  const method = (init?.method ?? "GET").toUpperCase();
  const params = new URLSearchParams(query);
  let body: Record<string, unknown> = {};
  if (init?.body) {
    try {
      body = JSON.parse(String(init.body)) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }

  // ---- /api/users ---------------------------------------------------------
  if (path === "/api/users") {
    if (method === "GET") {
      return json({ users: listUsers() });
    }
    if (method === "POST") {
      const name = body.name;
      const emoji = body.emoji;
      if (typeof name !== "string" || name.trim() === "") {
        return json({ error: "name is required" }, 400);
      }
      const user = createUser(name.trim(), typeof emoji === "string" ? emoji : "🐨");
      return json({ id: user.id }, 201);
    }
  }
  if (path.startsWith("/api/users/")) {
    const id = Number(path.split("/")[3]);
    if (Number.isFinite(id) && id > 0) {
      if (method === "PATCH") {
        if (!updateUser(id, { name: body.name as string | undefined, emoji: body.emoji as string | undefined })) {
          return json({ error: "User not found" }, 404);
        }
        return json({ success: true });
      }
      if (method === "DELETE") {
        if (!deleteUser(id)) {
          return json({ error: "User not found" }, 404);
        }
        return json({ success: true });
      }
    }
  }

  // ---- /api/questions -----------------------------------------------------
  if (path === "/api/questions" && method === "GET") {
    const topicParam = params.get("topic") ?? "random";
    const sourceParam = params.get("source") ?? "practice";
    const topic: Topic | "random" =
      topicParam === "random" || TOPICS.includes(topicParam as Topic) ? (topicParam as Topic | "random") : "random";
    const source: Source = SOURCES.includes(sourceParam as Source) ? (sourceParam as Source) : "practice";
    const rawLimit = Number(params.get("limit") ?? "10");
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.floor(rawLimit)), 100) : 10;
    const clampDiff = (raw: string | null, fallback: number) => {
      const n = Number(raw);
      return Number.isFinite(n) ? Math.min(Math.max(1, Math.floor(n)), 6) : fallback;
    };
    const diffMin = clampDiff(params.get("diffMin"), 1);
    const diffMax = clampDiff(params.get("diffMax"), 6);
    const questions =
      source === "shangshi"
        ? getShangshiQuestions(topic, limit)
        : source === "olympiad"
          ? getOlympiadQuestions(topic, limit, diffMin, diffMax)
          : getPracticeQuestions(topic, limit);
    return json({ questions });
  }

  // ---- /api/exam ----------------------------------------------------------
  if (path === "/api/exam" && method === "POST") {
    const userId = body.userId;
    if (typeof userId !== "number") {
      return json({ error: "userId is required" }, 400);
    }
    const questions = getExamQuestions();
    const session = createSession("exam", userId);
    insertExamPlaceholders(session.id, questions.map((q) => q.id));
    return json({ sessionId: session.id, minutes: EXAM_MINUTES, questions });
  }

  // ---- /api/sessions ------------------------------------------------------
  if (path === "/api/sessions" && method === "POST") {
    const mode = body.mode === "exam" ? "exam" : "practice";
    const userId = body.userId;
    if (typeof userId !== "number") {
      return json({ error: "userId is required" }, 400);
    }
    const session = createSession(mode, userId);
    return json({ id: session.id });
  }
  if (path.startsWith("/api/sessions/")) {
    const parts = path.split("/"); // ["", "api", "sessions", id, ...]
    const sessionId = Number(parts[3]);
    const isFinish = parts[4] === "finish";
    if (Number.isFinite(sessionId) && sessionId > 0) {
      if (isFinish && method === "POST") {
        const session = sessionById(sessionId);
        if (!session) return json({ error: "session not found" }, 404);
        if (session.mode !== "exam") return json({ error: "only exam sessions can be finished" }, 400);
        if (session.finished_at !== null) return json({ error: "session already finished" }, 409);
        const answers = answersOfSession(sessionId);
        const result = scoreExam(answers);
        const duration =
          typeof body.durationSeconds === "number" ? (body.durationSeconds as number) : null;
        finishSession(sessionId, result, duration);
        return json({ sessionId, ...result });
      }
      if (!isFinish && method === "GET") {
        const session = sessionById(sessionId);
        if (!session) return json({ error: "session not found" }, 404);
        const answers = answersOfSession(sessionId);
        const questions = answers
          .map((a) => questionById(a.question_id))
          .filter((q): q is Question => q !== undefined);
        return json({ session, answers, questions });
      }
    }
  }

  // ---- /api/answers -------------------------------------------------------
  if (path === "/api/answers" && method === "POST") {
    const sessionId = body.sessionId;
    const questionId = body.questionId;
    const chosenIndex = body.chosenIndex;
    if (
      typeof sessionId !== "number" ||
      typeof questionId !== "number" ||
      typeof chosenIndex !== "number" ||
      chosenIndex < 0
    ) {
      return json({ error: "invalid payload" }, 400);
    }
    const q = questionById(questionId);
    if (!q) return json({ error: "question not found" }, 404);
    // 注意:在线版 API 残留旧约束 chosenIndex>2,上实机考 8 选项会 400;
    // 离线版按真实选项数校验(修正该 bug)。
    if (chosenIndex >= q.choices.length) {
      return json({ error: "invalid payload" }, 400);
    }
    const isCorrect = chosenIndex === q.correct_index;
    const timeSpent = typeof body.timeSpentSeconds === "number" ? (body.timeSpentSeconds as number) : 0;
    if (body.mode === "exam") {
      setExamAnswer(sessionId, questionId, chosenIndex, isCorrect, timeSpent);
    } else {
      addPracticeAnswer(sessionId, questionId, chosenIndex, isCorrect, timeSpent);
    }
    return json({ ok: true, isCorrect });
  }

  // ---- /api/mistakes ------------------------------------------------------
  if (path === "/api/mistakes" && method === "GET") {
    const userIdParam = Number(params.get("userId"));
    const userId = Number.isFinite(userIdParam) && userIdParam > 0 ? userIdParam : undefined;
    return json({ questions: getMistakeQuestions(userId) });
  }

  // ---- /api/stats ---------------------------------------------------------
  if (path === "/api/stats" && method === "GET") {
    const userId = Number(params.get("userId"));
    if (!Number.isFinite(userId) || userId <= 0) {
      return json({ error: "userId is required" }, 400);
    }
    return json(getStats(userId));
  }

  // ---- /api/tts -----------------------------------------------------------
  if (path === "/api/tts" && method === "POST") {
    const text = body.text;
    if (typeof text !== "string" || text.length === 0) {
      return json({ error: "Missing or invalid 'text' field" }, 400);
    }
    if (text.length > 500) {
      return json({ error: "Text too long (max 500 chars)" }, 400);
    }
    const audioFile = OFFLINE_AUDIO[text];
    if (!audioFile) {
      return json({ error: "no offline audio" }, 404);
    }
    try {
      const resp = await origFetch(audioFile);
      if (!resp.ok) return json({ error: "audio missing" }, 404);
      const blob = await resp.blob();
      return new Response(blob, { headers: { "content-type": "audio/mpeg" } });
    } catch {
      return json({ error: "audio load failed" }, 500);
    }
  }

  // ---- 未匹配 --------------------------------------------------------------
  return json({ error: `offline api: unsupported ${method} ${path}` }, 404);
}
