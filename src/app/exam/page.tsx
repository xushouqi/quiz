"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { ChoiceButton, type ChoiceVariant } from "@/components/quiz/ChoiceButton";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { formatClock } from "@/lib/format";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { EXAM_MINUTES } from "@/lib/scoring";
import type { Question } from "@/lib/types";

type Phase = "intro" | "loading" | "running" | "submitting";

export default function ExamPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [choices, setChoices] = useState<Record<number, number>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [remaining, setRemaining] = useState(EXAM_MINUTES * 60);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const begin = useCallback(async () => {
    const userId = localStorage.getItem("kangaroo-current-user");
    if (!userId) {
      window.location.href = "/";
      return;
    }

    setPhase("loading");
    setError(null);
    try {
      const res = await fetchWithTimeout("/api/exam", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: Number(userId) }),
      });
      const data = (await res.json()) as { sessionId: number; minutes: number; questions: Question[] };
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setRemaining(data.minutes * 60);
      setCurrent(0);
      setChoices({});
      setFlagged([]);
      setPhase("running");
    } catch {
      setPhase("intro");
      setError("开始失败：请确认服务正在运行（npm run dev）后重试。Couldn't reach the server.");
    }
  }, []);

  const submit = useCallback(async () => {
    if (sessionId === null || phase === "submitting") return;
    setPhase("submitting");
    try {
      for (const q of questions) {
        const chosen = choices[q.id];
        if (chosen === undefined) continue;
        await fetchWithTimeout("/api/answers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, questionId: q.id, chosenIndex: chosen, timeSpentSeconds: 0, mode: "exam" }),
        });
      }
      await fetchWithTimeout(`/api/sessions/${sessionId}/finish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ durationSeconds: EXAM_MINUTES * 60 - Math.max(0, remaining) }),
      });
      router.push(`/exam/report/${sessionId}`);
    } catch {
      setConfirmOpen(false);
      setPhase("running");
      setError("提交失败：你的作答已记录在本地页面，请再按一次「交卷」重试。Submit failed — press Submit again.");
    }
  }, [choices, phase, questions, remaining, router, sessionId]);

  useEffect(() => {
    if (phase !== "running") return;
    const t = window.setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "running" && remaining <= 0) void submit();
  }, [phase, remaining, submit]);

  const answeredCount = useMemo(() => Object.keys(choices).length, [choices]);
  const q = questions[current];

  const variantFor = (i: number): ChoiceVariant =>
    q && choices[q.id] === i ? "selected" : "idle";

  const toggleFlag = () => {
    if (!q) return;
    setFlagged((f) => (f.includes(q.id) ? f.filter((x) => x !== q.id) : [...f, q.id]));
  };

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />

      {phase === "intro" && (
        <div className="mx-auto max-w-xl px-4 py-14">
          <div className="rounded-[2rem] border-4 border-cocoa/10 bg-white/95 p-8 shadow-xl">
            <Kangaroo mood="idle" className="mx-auto h-32 animate-idle-hop" />
            <h1 className="mt-3 text-center font-kids text-4xl">模拟考试 Mock Exam</h1>
            <ul className="mt-5 space-y-2 text-lg">
              <li>📋 24 道选择题（A/B/C 三个选项）</li>
              <li>⏰ 限时 75 分钟</li>
              <li>🎁 起始分 24 分：答对加 3/4/5 分，答错扣 1 分，不答不扣分</li>
              <li>🏆 满分 120 分</li>
            </ul>
            <p className="mt-3 text-sm text-cocoa/60">
              24 questions · 75 minutes · +3/+4/+5 for correct, −1 for wrong, 0 for blank.
            </p>
            {error && (
              <p className="mt-4 rounded-3xl border-4 border-coral/30 bg-coral/10 p-3 text-center font-kids text-coral">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void begin()}
              className="mt-6 w-full rounded-full bg-sunny p-4 font-kids text-2xl text-white shadow-lg active:translate-y-1"
            >
              开始考试 Start!
            </button>
            <Link href="/" className="mt-3 block text-center text-sm text-cocoa/50 underline">← 回首页 Home</Link>
          </div>
        </div>
      )}

      {phase === "loading" && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
          <Kangaroo mood="idle" className="h-40 animate-idle-hop" />
          <p className="rounded-full bg-white/90 px-6 py-3 font-kids text-xl shadow">正在发卷… Handing out papers…</p>
        </div>
      )}

      {(phase === "running" || phase === "submitting") && q && (
        <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-3 py-1 md:px-4 lg:h-auto lg:min-h-dvh lg:py-6">
          <header className="flex shrink-0 items-center justify-between gap-1.5 rounded-2xl border-4 border-cocoa/10 bg-white/90 px-3 py-1.5 shadow md:gap-2 md:rounded-3xl md:px-4 md:py-2">
            <span className={`font-kids text-base md:text-2xl ${remaining <= 300 ? "text-coral" : ""}`}>
              ⏰ {formatClock(remaining)}
            </span>
            <span className="font-kids text-xs text-cocoa/70 md:text-lg">已答 {answeredCount}/{questions.length}</span>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="rounded-full bg-grass px-2.5 py-1 font-kids text-xs text-white shadow active:translate-y-1 md:px-5 md:py-2 md:text-lg"
            >
              交卷 Submit
            </button>
          </header>

          {error && (
            <p className="shrink-0 rounded-2xl border-4 border-coral/30 bg-coral/10 p-2 text-center font-kids text-sm text-coral md:rounded-3xl md:p-3 md:text-base">
              {error}
            </p>
          )}

          <div className="flex shrink-0 flex-wrap justify-center gap-1 md:gap-1.5">
            {questions.map((item, i) => {
              const answered = choices[item.id] !== undefined;
              const isCurrent = i === current;
              const isFlagged = flagged.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrent(i)}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 font-kids text-xs transition md:h-8 md:w-8 md:text-sm ${isCurrent ? "scale-110 border-sunny" : "border-cocoa/20"} ${answered ? "bg-grass text-white" : "bg-white"} ${isFlagged ? "ring-2 ring-gold" : ""}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1.5">
            <QuestionCard question={q}>
              <div className="space-y-1.5 md:space-y-2">
                {q.choices.map((c, i) => (
                  <ChoiceButton
                    key={i}
                    index={i}
                    zh={c.zh}
                    en={c.en}
                    variant={variantFor(i)}
                    disabled={phase === "submitting"}
                    onSelect={(i2) => setChoices((prev) => ({ ...prev, [q.id]: i2 }))}
                  />
                ))}
              </div>
            </QuestionCard>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-1.5 md:gap-3">
            <button
              type="button"
              disabled={current === 0}
              onClick={() => setCurrent((c) => c - 1)}
              className="rounded-full bg-white px-3 py-1.5 font-kids text-sm shadow disabled:opacity-40 md:px-6 md:py-2.5 md:text-lg"
            >
              ← 上一题
            </button>
            <button
              type="button"
              onClick={toggleFlag}
              className={`rounded-full px-2.5 py-1.5 font-kids text-sm shadow md:px-5 md:py-2.5 md:text-lg ${flagged.includes(q.id) ? "bg-gold" : "bg-white"}`}
            >
              🔖 {flagged.includes(q.id) ? "已标记" : "标记"}
            </button>
            <button
              type="button"
              disabled={current === questions.length - 1}
              onClick={() => setCurrent((c) => c + 1)}
              className="rounded-full bg-white px-3 py-1.5 font-kids text-sm shadow disabled:opacity-40 md:px-6 md:py-2.5 md:text-lg"
            >
              下一题 →
            </button>
          </div>

          {confirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-cocoa/40 p-4">
              <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
                <p className="font-kids text-2xl">确定交卷吗？</p>
                <p className="mt-2 text-cocoa/70">
                  还有 {questions.length - answeredCount} 题没有作答（不答不扣分）
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    className="flex-1 rounded-full border-4 border-cocoa/10 bg-white p-3 font-kids"
                  >
                    继续答题
                  </button>
                  <button
                    type="button"
                    onClick={() => void submit()}
                    className="flex-1 rounded-full bg-sunny p-3 font-kids text-white"
                  >
                    交卷 Submit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
