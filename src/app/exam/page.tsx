"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { ChoiceList } from "@/components/quiz/ChoiceList";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { formatClock } from "@/lib/format";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { EXAM_MINUTES } from "@/lib/scoring";
import type { Question } from "@/lib/types";
import { useUser } from "@/components/contexts/UserContext";

type Phase = "intro" | "loading" | "running" | "submitting";

// ----------------------------------------------------------------
// Memoized 子树：每秒倒计时只会重渲染 ExamPage 主体与页头，
// 题号网格与题卡区域在 props 未变时跳过重渲染（避免 24 个网格按钮
// + 题卡 + 选项按钮每秒无谓重建）
// ----------------------------------------------------------------
const QuestionGrid = memo(function QuestionGrid({
  questions,
  current,
  choices,
  flagged,
  onJump,
}: {
  questions: Question[];
  current: number;
  choices: Record<number, number>;
  flagged: number[];
  onJump: (index: number) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap justify-center gap-1 md:gap-1.5">
      {questions.map((item, i) => {
        const answered = choices[item.id] !== undefined;
        const isCurrent = i === current;
        const isFlagged = flagged.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onJump(i)}
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 font-kids text-xs transition md:h-8 md:w-8 md:text-sm ${isCurrent ? "scale-110 border-sunny" : "border-cocoa/20"} ${answered ? "bg-grass text-white" : "bg-white"} ${isFlagged ? "ring-2 ring-gold" : ""}`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
});

const ExamQuestionArea = memo(function ExamQuestionArea({
  question,
  selected,
  disabled,
  isFlagged,
  canPrev,
  canNext,
  onSelect,
  onPrev,
  onNext,
  onFlag,
}: {
  question: Question;
  selected: number | undefined;
  disabled: boolean;
  isFlagged: boolean;
  canPrev: boolean;
  canNext: boolean;
  onSelect: (questionId: number, choiceIndex: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onFlag: (questionId: number) => void;
}) {
  const q = question;
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col py-1.5">
        <QuestionCard question={q}>
          <ChoiceList
            choices={q.choices}
            variantFor={(i) => (selected === i ? "selected" : "idle")}
            disabled={disabled}
            onSelect={(i2) => onSelect(q.id, i2)}
          />
        </QuestionCard>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-1.5 md:gap-3">
        <button
          type="button"
          disabled={!canPrev}
          onClick={onPrev}
          className="rounded-full bg-white px-3 py-1.5 font-kids text-sm shadow disabled:opacity-40 md:px-6 md:py-2.5 md:text-lg"
        >
          ← 上一题
        </button>
        <button
          type="button"
          onClick={() => onFlag(q.id)}
          className={`rounded-full px-2.5 py-1.5 font-kids text-sm shadow md:px-5 md:py-2.5 md:text-lg ${isFlagged ? "bg-gold" : "bg-white"}`}
        >
          🔖 {isFlagged ? "已标记" : "标记"}
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={onNext}
          className="rounded-full bg-white px-3 py-1.5 font-kids text-sm shadow disabled:opacity-40 md:px-6 md:py-2.5 md:text-lg"
        >
          下一题 →
        </button>
      </div>
    </>
  );
});

export default function ExamPage() {
  const router = useRouter();
  const { currentUser } = useUser();
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
    if (!currentUser) {
      router.push("/");
      return;
    }

    setPhase("loading");
    setError(null);
    try {
      const res = await fetchWithTimeout("/api/exam", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
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
  }, [currentUser, router]);

  const submit = useCallback(async () => {
    if (sessionId === null || phase === "submitting") return;
    setPhase("submitting");
    try {
      // 并行提交所有作答（服务端为同一 SQLite 连接，内部串行写入，
      // 但省掉 24 次串行 RTT，交卷等待时间 ≈ 单次最慢请求）
      const requests = questions
        .filter((q) => choices[q.id] !== undefined)
        .map((q) =>
          fetchWithTimeout("/api/answers", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId, questionId: q.id, chosenIndex: choices[q.id], timeSpentSeconds: 0, mode: "exam" }),
          })
        );
      await Promise.all(requests);
      await fetchWithTimeout(`/api/sessions/${sessionId}/finish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ durationSeconds: EXAM_MINUTES * 60 - Math.max(0, remaining) }),
      });
      router.push(`/exam/report?id=${sessionId}`);
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

  // 稳定引用的回调：保证 memo 化的子树在倒计时 tick 时跳过重渲染
  const handleJump = useCallback((i: number) => setCurrent(i), []);
  const handleSelect = useCallback(
    (questionId: number, choiceIndex: number) =>
      setChoices((prev) => ({ ...prev, [questionId]: choiceIndex })),
    []
  );
  const handlePrev = useCallback(() => setCurrent((c) => c - 1), []);
  const handleNext = useCallback(() => setCurrent((c) => c + 1), []);
  const handleFlag = useCallback(
    (questionId: number) =>
      setFlagged((f) => (f.includes(questionId) ? f.filter((x) => x !== questionId) : [...f, questionId])),
    []
  );

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />

      {phase === "intro" && (
        <div className="mx-auto max-w-xl px-4 py-14">
          <div className="rounded-[2rem] border-4 border-cocoa/10 bg-white/95 p-8 shadow-xl">
            <Kangaroo mood="idle" className="mx-auto h-32 animate-idle-hop" />
            <h1 className="mt-3 text-center font-kids text-4xl">模拟考试 Mock Exam</h1>
            <ul className="mt-5 space-y-2 text-lg">
              <li>📋 24 道选择题（每题 3–5 个选项，A–E）</li>
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

          <QuestionGrid
            questions={questions}
            current={current}
            choices={choices}
            flagged={flagged}
            onJump={handleJump}
          />

          <ExamQuestionArea
            question={q}
            selected={choices[q.id]}
            disabled={phase === "submitting"}
            isFlagged={flagged.includes(q.id)}
            canPrev={current > 0}
            canNext={current < questions.length - 1}
            onSelect={handleSelect}
            onPrev={handlePrev}
            onNext={handleNext}
            onFlag={handleFlag}
          />

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
