import { describe, expect, it, beforeEach } from "vitest";
import { handleOfflineFetch } from "@/lib/offline/api";
import { clearAllOfflineData } from "@/lib/offline/storage";
import { OFFLINE_AUDIO } from "@/lib/offline/audio-map";
import { OFFLINE_DATA } from "@/lib/offline/data-embedded";
import type { Question } from "@/lib/types";

const origFetch = (async () =>
  new Response(new Blob(["fake-mp3"], { type: "audio/mpeg" }), { status: 200 })) as unknown as typeof fetch;

function api(path: string, init?: RequestInit): Promise<Response> {
  return handleOfflineFetch(path, init, origFetch);
}

async function createUser(name = "跳跳"): Promise<number> {
  const res = await api("/api/users", {
    method: "POST",
    body: JSON.stringify({ name, emoji: "🦘" }),
  });
  expect(res.status).toBe(201);
  const { id } = (await res.json()) as { id: number };
  return id;
}

async function postAnswer(
  sessionId: number,
  questionId: number,
  chosenIndex: number,
  extra: Record<string, unknown> = {}
): Promise<{ status: number; body: { ok?: boolean; isCorrect?: boolean; error?: string } }> {
  const res = await api("/api/answers", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      questionId,
      chosenIndex,
      timeSpentSeconds: 3,
      ...extra,
    }),
  });
  return { status: res.status, body: (await res.json()) as { ok?: boolean; isCorrect?: boolean; error?: string } };
}

beforeEach(() => {
  clearAllOfflineData();
});

describe("offline data", () => {
  it("embeds all 316 questions", () => {
    expect(OFFLINE_DATA.questions.length).toBe(316);
    const sources = new Set(OFFLINE_DATA.questions.map((q) => q.source));
    expect(sources).toEqual(new Set(["practice", "official", "simulation", "shangshi"]));
  });
});

describe("offline users", () => {
  it("creates and lists users (desc by created_at)", async () => {
    const id1 = await createUser("孩子1");
    const id2 = await createUser("孩子2");
    expect(id2).toBeGreaterThan(id1);
    const res = await api("/api/users");
    const { users } = (await res.json()) as { users: { id: number; name: string; emoji: string }[] };
    expect(users.map((u) => u.name)).toEqual(["孩子2", "孩子1"]);
  });

  it("rejects empty name", async () => {
    const res = await api("/api/users", { method: "POST", body: JSON.stringify({ name: "  " }) });
    expect(res.status).toBe(400);
  });

  it("patches and deletes user with cascade", async () => {
    const id = await createUser("跳跳");
    const sessRes = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ mode: "practice", userId: id }),
    });
    const { id: sessionId } = (await sessRes.json()) as { id: number };
    const q = OFFLINE_DATA.questions[0] as unknown as Question;
    await postAnswer(sessionId, q.id, q.correct_index);

    const patch = await api(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify({ name: "新名字" }) });
    expect(patch.status).toBe(200);
    const users = (await (await api("/api/users")).json()) as { users: { id: number; name: string }[] };
    expect(users.users[0].name).toBe("新名字");

    const del = await api(`/api/users/${id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    const after = (await (await api("/api/users")).json()) as { users: unknown[] };
    expect(after.users).toHaveLength(0);

    // 级联:session/answers 应随用户删除
    const sessionRes = await api(`/api/sessions/${sessionId}`);
    expect(sessionRes.status).toBe(404);
  });
});

describe("offline practice", () => {
  it("returns practice questions and records correct/incorrect answers", async () => {
    const userId = await createUser();
    const qsRes = await api("/api/questions?topic=random&limit=5&source=practice");
    const { questions } = (await qsRes.json()) as { questions: Question[] };
    expect(questions.length).toBe(5);
    expect(questions.every((q) => q.source === "practice")).toBe(true);

    const sessRes = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ mode: "practice", userId }),
    });
    const { id: sessionId } = (await sessRes.json()) as { id: number };

    const correct = await postAnswer(sessionId, questions[0].id, questions[0].correct_index);
    expect(correct.status).toBe(200);
    expect(correct.body.isCorrect).toBe(true);

    const wrong = await postAnswer(sessionId, questions[0].id, (questions[0].correct_index + 1) % questions[0].choices.length);
    expect(wrong.status).toBe(200);
    expect(wrong.body.isCorrect).toBe(false);
  });
});

describe("offline shangshi (上实机考, 选项可达 8 个)", () => {
  it("returns all 100 shangshi questions ordered by id", async () => {
    const res = await api("/api/questions?source=shangshi&limit=100");
    const { questions } = (await res.json()) as { questions: Question[] };
    expect(questions.length).toBe(100);
    expect(questions.every((q) => q.source === "shangshi")).toBe(true);
    expect(questions.map((q) => q.id)).toEqual([...questions.map((q) => q.id)].sort((a, b) => a - b));
  });

  it("accepts chosenIndex up to 7 (在线版残留 chosenIndex>2 bug, 离线版修正)", async () => {
    const q8 = (OFFLINE_DATA.questions as unknown as Question[]).find((q) => q.choices.length >= 8);
    if (!q8) return;
    const userId = await createUser();
    const sessRes = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ mode: "practice", userId }),
    });
    const { id: sessionId } = (await sessRes.json()) as { id: number };
    const res = await postAnswer(sessionId, q8.id, 7);
    expect(res.status).toBe(200);
  });
});

describe("offline exam", () => {
  it("starts 24-question exam and scores on finish", async () => {
    const userId = await createUser();
    const examRes = await api("/api/exam", { method: "POST", body: JSON.stringify({ userId }) });
    const { sessionId, minutes, questions } = (await examRes.json()) as {
      sessionId: number;
      minutes: number;
      questions: Question[];
    };
    expect(minutes).toBe(75);
    expect(questions.length).toBe(24);
    const byDifficulty = [3, 4, 5].map(
      (d) => questions.filter((q) => q.difficulty === d).length
    );
    expect(byDifficulty).toEqual([8, 8, 8]);

    // 全部答对
    for (const q of questions) {
      const res = await postAnswer(sessionId, q.id, q.correct_index, { mode: "exam" });
      expect(res.status).toBe(200);
      expect(res.body.isCorrect).toBe(true);
    }
    const finRes = await api(`/api/sessions/${sessionId}/finish`, {
      method: "POST",
      body: JSON.stringify({ durationSeconds: 600 }),
    });
    const result = (await finRes.json()) as { score: number; maxScore: number; correct: number; wrong: number; blank: number };
    expect(result.correct).toBe(24);
    expect(result.wrong).toBe(0);
    expect(result.blank).toBe(0);
    const expected = 24 + questions.reduce((s, q) => s + q.difficulty, 0);
    expect(result.score).toBe(expected);
    expect(result.maxScore).toBe(expected);
  });

  it("penalizes wrong answers (-1) and counts blanks", async () => {
    const userId = await createUser();
    const examRes = await api("/api/exam", { method: "POST", body: JSON.stringify({ userId }) });
    const { sessionId, questions } = (await examRes.json()) as { sessionId: number; questions: Question[] };
    const q0 = questions[0];
    await postAnswer(sessionId, q0.id, (q0.correct_index + 1) % q0.choices.length, { mode: "exam" });
    const finRes = await api(`/api/sessions/${sessionId}/finish`, { method: "POST", body: "{}" });
    const result = (await finRes.json()) as { score: number; correct: number; wrong: number; blank: number };
    expect(result.correct).toBe(0);
    expect(result.wrong).toBe(1);
    expect(result.blank).toBe(23);
    // 起始 24 分,答错 1 题 -1,其余空白不扣分
    expect(result.score).toBe(23);
  });
});

describe("offline mistakes", () => {
  it("collects wrong questions and removes them after a correct redo", async () => {
    const userId = await createUser();
    const sessRes = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ mode: "practice", userId }),
    });
    const { id: sessionId } = (await sessRes.json()) as { id: number };
    const q = OFFLINE_DATA.questions[0] as unknown as Question;

    // 第一次答错
    await postAnswer(sessionId, q.id, (q.correct_index + 1) % q.choices.length);
    let mistakes = (await (await api(`/api/mistakes?userId=${userId}`)).json()) as { questions: Question[] };
    expect(mistakes.questions.some((m) => m.id === q.id)).toBe(true);

    // 重做答对 → 移出错题本
    const sessRes2 = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ mode: "practice", userId }),
    });
    const { id: sessionId2 } = (await sessRes2.json()) as { id: number };
    await postAnswer(sessionId2, q.id, q.correct_index);
    mistakes = (await (await api(`/api/mistakes?userId=${userId}`)).json()) as { questions: Question[] };
    expect(mistakes.questions.some((m) => m.id === q.id)).toBe(false);
  });
});

describe("offline stats", () => {
  it("computes stars: first correct +3, repeat +1", async () => {
    const userId = await createUser();
    const q = OFFLINE_DATA.questions[0] as unknown as Question;

    const sessRes = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ mode: "practice", userId }),
    });
    const { id: sessionId } = (await sessRes.json()) as { id: number };

    // 第一次答对 → 3 星
    await postAnswer(sessionId, q.id, q.correct_index);
    let stats = (await (await api(`/api/stats?userId=${userId}`)).json()) as { stars: number };
    expect(stats.stars).toBe(3);

    // 同一题再次答对 → +1 星
    const sessRes2 = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ mode: "practice", userId }),
    });
    const { id: sessionId2 } = (await sessRes2.json()) as { id: number };
    await postAnswer(sessionId2, q.id, q.correct_index);
    stats = (await (await api(`/api/stats?userId=${userId}`)).json()) as { stars: number };
    expect(stats.stars).toBe(4);
  });
});

describe("offline tts", () => {
  it("returns audio/mpeg for a known offline text", async () => {
    const texts = Object.keys(OFFLINE_AUDIO);
    expect(texts.length).toBeGreaterThan(0);
    const res = await api("/api/tts", { method: "POST", body: JSON.stringify({ text: texts[0] }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("audio/mpeg");
  });

  it("404 for text without pre-generated audio", async () => {
    const res = await api("/api/tts", { method: "POST", body: JSON.stringify({ text: "没有预生成音频的文本 XYZ" }) });
    expect(res.status).toBe(404);
  });
});
