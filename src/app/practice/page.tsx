"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { ChoiceButton, type ChoiceVariant } from "@/components/quiz/ChoiceButton";
import { Confetti } from "@/components/quiz/Confetti";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import type { Question, Topic } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

const TOPIC_OPTIONS: { key: Topic | "random"; zh: string; en: string; emoji: string }[] = [
  { key: "random", zh: "随机混合", en: "Mixed", emoji: "🎲" },
  { key: "counting", zh: "数数与观察", en: "Counting", emoji: "🔢" },
  { key: "shapes", zh: "图形与空间", en: "Shapes", emoji: "🔷" },
  { key: "patterns", zh: "规律与序列", en: "Patterns", emoji: "🎨" },
  { key: "logic", zh: "逻辑与推理", en: "Logic", emoji: "🧠" },
  { key: "arithmetic", zh: "计算与应用", en: "Arithmetic", emoji: "➕" },
  { key: "time", zh: "时间与生活", en: "Time", emoji: "⏰" },
];

const PRACTICE_SIZE = 10;

type Phase = "select" | "loading" | "playing" | "done";
type Feedback = { kind: "correct"; stars: number } | { kind: "encourage" } | { kind: "reveal" };

export default function PracticePage() {
  const [phase, setPhase] = useState<Phase>("select");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [earned, setEarned] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef(Date.now());

  const start = useCallback(async (topic: Topic | "random") => {
    setPhase("loading");
    setError(null);
    try {
      const [sessRes, qsRes] = await Promise.all([
        fetchWithTimeout("/api/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "practice" }),
        }),
        fetchWithTimeout(`/api/questions?topic=${topic}&limit=${PRACTICE_SIZE}`),
      ]);
      const sess = (await sessRes.json()) as { id: number };
      const qs = (await qsRes.json()) as { questions: Question[] };
      setSessionId(sess.id);
      setQuestions(qs.questions);
      setIndex(0);
      setAttempt(0);
      setPicked(null);
      setFeedback(null);
      setEarned(0);
      shownAt.current = Date.now();
      setPhase(qs.questions.length > 0 ? "playing" : "done");
    } catch {
      setPhase("select");
      setError("加载失败：请确认服务正在运行（npm run dev）后重试。Couldn't reach the server.");
    }
  }, []);

  const pick = useCallback(
    async (i: number) => {
      if (feedback !== null || sessionId === null) return;
      const q = questions[index];
      setPicked(i);
      const correct = i === q.correct_index;
      const timeSpentSeconds = Math.max(0, Math.round((Date.now() - shownAt.current) / 1000));
      await fetchWithTimeout("/api/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, questionId: q.id, chosenIndex: i, timeSpentSeconds }),
      });
      if (correct) {
        const stars = attempt === 0 ? 3 : 1;
        setEarned((e) => e + stars);
        setFeedback({ kind: "correct", stars });
      } else if (attempt === 0) {
        setAttempt(1);
        setFeedback({ kind: "encourage" });
        window.setTimeout(() => {
          setFeedback(null);
          setPicked(null);
        }, 1300);
      } else {
        setFeedback({ kind: "reveal" });
      }
    },
    [attempt, feedback, index, questions, sessionId]
  );

  const next = useCallback(() => {
    if (index + 1 >= questions.length) {
      setPhase("done");
      return;
    }
    setIndex((v) => v + 1);
    setAttempt(0);
    setPicked(null);
    setFeedback(null);
    shownAt.current = Date.now();
  }, [index, questions.length]);

  const q = questions[index];

  const variantFor = (i: number): ChoiceVariant => {
    if (feedback?.kind === "reveal") return i === q?.correct_index ? "correct" : "dimmed";
    if (feedback?.kind === "encourage" && i === picked) return "wrong";
    if (feedback?.kind === "correct" && i === picked) return "correct";
    return "idle";
  };

  const mood =
    feedback?.kind === "correct" ? "happy" : feedback?.kind === "encourage" ? "sad" : "idle";

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      {phase === "select" && (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <header className="flex items-center justify-between">
            <Link href="/" className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">← 回家 Home</Link>
            <h1 className="font-kids text-3xl">闯关练习</h1>
            <span className="w-24" aria-hidden="true" />
          </header>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Kangaroo mood={error ? "sad" : "happy"} className="h-36 animate-idle-hop" />
            <p className="max-w-xs rounded-3xl border-4 border-cocoa/10 bg-white/90 p-4 text-center font-kids text-xl shadow">
              选一个主题开始冒险吧！ Pick a topic!
            </p>
          </div>
          {error && (
            <p className="mx-auto mt-4 max-w-md rounded-3xl border-4 border-coral/30 bg-coral/10 p-4 text-center font-kids text-lg text-coral">
              {error}
            </p>
          )}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {TOPIC_OPTIONS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => void start(t.key)}
                className="rounded-[1.75rem] border-4 border-cocoa/10 bg-white/90 p-5 text-center shadow transition hover:-rotate-1 hover:border-sunny hover:shadow-lg active:translate-y-1"
              >
                <div className="text-4xl">{t.emoji}</div>
                <div className="mt-1 font-kids text-lg">{t.zh}</div>
                <div className="text-xs text-cocoa/60">{t.en}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "loading" && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
          <Kangaroo mood="idle" className="h-40 animate-idle-hop" />
          <p className="rounded-full bg-white/90 px-6 py-3 font-kids text-xl shadow">正在准备题目… Preparing…</p>
        </div>
      )}

      {phase === "playing" && q && (
        <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8">
          {feedback?.kind === "correct" && <Confetti />}
          <header className="flex items-center justify-between gap-2">
            <Link href="/" className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">← 回家</Link>
            <span className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">
              第 {index + 1} / {questions.length} 题
            </span>
            <span className="rounded-full bg-gold/90 px-4 py-2 font-kids shadow">⭐ {earned}</span>
          </header>

          <QuestionCard question={q}>
            <div className="space-y-3">
              {q.choices.map((c, i) => (
                <ChoiceButton
                  key={i}
                  index={i}
                  zh={c.zh}
                  en={c.en}
                  variant={variantFor(i)}
                  disabled={feedback !== null}
                  onSelect={(i2) => void pick(i2)}
                />
              ))}
            </div>

            {feedback?.kind === "encourage" && (
              <p className="mt-4 animate-pop rounded-2xl bg-gold/40 p-3 text-center font-kids text-lg">
                差一点点！再试一次吧～ So close! Try again!
              </p>
            )}

            {(feedback?.kind === "correct" || feedback?.kind === "reveal") && (
              <div className="mt-4 animate-pop space-y-3">
                {feedback.kind === "correct" ? (
                  <p className="rounded-2xl bg-grass/25 p-3 text-center font-kids text-xl">
                    太棒了！+{feedback.stars}⭐ Awesome!
                  </p>
                ) : (
                  <p className="rounded-2xl bg-coral/15 p-3 text-center font-kids text-lg">
                    没关系，看看答案吧！ Here is the answer!
                  </p>
                )}
                <div className="rounded-2xl border-4 border-cocoa/10 bg-[#fffdf5] p-4">
                  <p className="font-bold">💡 {q.explanation_zh}</p>
                  <p className="mt-1 text-sm text-cocoa/60">{q.explanation_en}</p>
                </div>
                <button
                  type="button"
                  onClick={next}
                  className="w-full rounded-full bg-sunny p-4 font-kids text-2xl text-white shadow-lg transition hover:brightness-105 active:translate-y-1"
                >
                  {index + 1 >= questions.length ? "完成！Finish!" : "下一题 Next →"}
                </button>
              </div>
            )}
          </QuestionCard>

          <div className="flex justify-center">
            <Kangaroo mood={mood} className="h-28" />
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="mx-auto max-w-xl space-y-6 px-4 py-16 text-center">
          <Confetti />
          <Kangaroo mood="happy" className="mx-auto h-44 animate-idle-hop" />
          <h1 className="font-kids text-4xl">闯关完成！Well done!</h1>
          <p className="font-kids text-2xl text-cocoa/80">这次一共得到 ⭐ {earned} 颗星星</p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setPhase("select")}
              className="rounded-full bg-sunny px-8 py-4 font-kids text-2xl text-white shadow-lg active:translate-y-1"
            >
              再来一轮 Again
            </button>
            <Link href="/" className="rounded-full bg-white px-8 py-4 font-kids text-2xl shadow">回家 Home</Link>
          </div>
        </div>
      )}
    </main>
  );
}
