/**
 * 离线持久化层:localStorage + 内存降级。
 *
 * Capacitor WebView 的 localStorage 在正常情况下可持久化;
 * 极少数设备上 localStorage 不可用(隐私模式/存储被清)时降级为内存,
 * 保证本次会话内功能可用。
 */

const memoryStore = new Map<string, string>();

export function safeGet(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(key);
      if (v !== null) return v;
    }
  } catch {
    /* ignore */
  }
  return memoryStore.get(key) ?? null;
}

export function safeSet(key: string, value: string): void {
  memoryStore.set(key, value);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {
    /* ignore */
  }
}

export function safeRemove(key: string): void {
  memoryStore.delete(key);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

function readCollection<T>(key: string): T[] {
  const raw = safeGet(key);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

function writeCollection<T>(key: string, arr: T[]): void {
  safeSet(key, JSON.stringify(arr));
}

const USERS_KEY = "kangaroo-offline-users";
const SESSIONS_KEY = "kangaroo-offline-sessions";
const ANSWERS_KEY = "kangaroo-offline-answers";
const SEQ_KEY = "kangaroo-offline-seq";

export interface OfflineUser {
  id: number;
  name: string;
  emoji: string;
  created_at: number;
}

export interface OfflineSession {
  id: number;
  user_id: number;
  mode: "practice" | "exam";
  started_at: number;
  finished_at: number | null;
  score: number | null;
  max_score: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  blank_count: number | null;
  duration_seconds: number | null;
}

export interface OfflineAnswer {
  id: number;
  session_id: number;
  question_id: number;
  chosen_index: number | null;
  is_correct: number | null;
  time_spent_seconds: number | null;
  created_at: number;
}

export function readUsers(): OfflineUser[] {
  return readCollection<OfflineUser>(USERS_KEY);
}
export function writeUsers(users: OfflineUser[]): void {
  writeCollection(USERS_KEY, users);
}
export function readSessions(): OfflineSession[] {
  return readCollection<OfflineSession>(SESSIONS_KEY);
}
export function writeSessions(sessions: OfflineSession[]): void {
  writeCollection(SESSIONS_KEY, sessions);
}
export function readAnswers(): OfflineAnswer[] {
  return readCollection<OfflineAnswer>(ANSWERS_KEY);
}
export function writeAnswers(answers: OfflineAnswer[]): void {
  writeCollection(ANSWERS_KEY, answers);
}

export function nextSeq(kind: "users" | "sessions" | "answers"): number {
  let seq: Record<string, number> = {};
  const raw = safeGet(SEQ_KEY);
  if (raw) {
    try {
      const v = JSON.parse(raw);
      if (v && typeof v === "object") seq = v;
    } catch {
      /* ignore */
    }
  }
  const next = (seq[kind] ?? 0) + 1;
  seq = { ...seq, [kind]: next };
  safeSet(SEQ_KEY, JSON.stringify(seq));
  return next;
}

/** 清空全部离线数据(测试隔离 / 家长面板重置用)。 */
export function clearAllOfflineData(): void {
  for (const key of [USERS_KEY, SESSIONS_KEY, ANSWERS_KEY, SEQ_KEY]) {
    safeRemove(key);
  }
}
