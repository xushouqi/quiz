"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { ChoiceButton, type ChoiceVariant } from "@/components/quiz/ChoiceButton";
import { Confetti } from "@/components/quiz/Confetti";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import type { Question } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

type Result = "correct" | "wrong" | null;

export default function MistakesPage() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    void (async () => {
      const userId = localStorage.getItem("kangaroo-current-user");
      if (!userId) {
        window.location.href = "/";
        return;
      }

      try {
        const [mRes, sRes] = await Promise.all([
          fetchWithTimeout(`/api/mistakes?userId=${userId}`),
          fetchWithTimeout("/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode: "practice", userId: Number(userId) }),
          }),
        ]);
        const m = (await mRes.json()) as { questions: Question[] };
        const s = (await sRes.json()) as { id: number };
        setQuestions(m.questions);
        setSessionId(s.id);
      } catch {
        setLoadError(true);
      }
    })();
  }, []);

  const pick = useCallback(
    async (i: number) => {
      if (result !== null || sessionId === null || questions === null) return;
      const q = questions[index];
      setPicked(i);
      const correct = i === q.correct_index;
      await fetchWithTimeout("/api/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, questionId: q.id, chosenIndex: i, timeSpentSeconds: 0 }),
      });
      setResult(correct ? "correct" : "wrong");
    },
    [index, questions, result, sessionId]
  );

  const next = useCallback(() => {
    setIndex((v) => v + 1);
    setPicked(null);
    setResult(null);
  }, []);

  const q = questions?.[index];

  const variantFor = (i: number): ChoiceVariant => {
    if (result === "wrong") return q && i === q.correct_index ? "correct" : i === picked ? "wrong" : "dimmed";
    if (result === "correct") return i === picked ? "correct" : "dimmed";
    return "idle";
  };

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <header className="mb-3 flex items-center justify-between md:mb-5">
          <Link href="/" className="rounded-full bg-white/85 px-3 py-1.5 font-kids text-sm shadow md:px-4 md:py-2 md:text-base">← 回家 Home</Link>
          <h1 className="font-kids text-2xl md:text-3xl">错题本 Mistakes</h1>
          <span className="w-20 md:w-24" aria-hidden="true" />
        </header>

        {questions === null && !loadError && (
          <div className="flex flex-col items-center gap-4 py-20">
            <Kangaroo mood="idle" className="h-36 animate-idle-hop" />
            <p className="rounded-full bg-white/90 px-6 py-3 font-kids shadow">加载中…</p>
          </div>
        )}

        {loadError && (
          <div className="flex flex-col items-center gap-4 py-20">
            <Kangaroo mood="sad" className="h-36" />
            <p className="max-w-sm rounded-3xl border-4 border-coral/30 bg-coral/10 p-4 text-center font-kids text-lg text-coral">
              加载失败：请确认服务正在运行（npm run dev）后刷新页面。Couldn&apos;t reach the server — refresh once it&apos;s running.
            </p>
            <Link href="/" className="rounded-full bg-sunny px-8 py-3 font-kids text-xl text-white shadow-lg">回家 Home</Link>
          </div>
        )}

        {questions !== null && (index >= questions.length) && (
          <div className="space-y-6 py-16 text-center">
            <Confetti />
            <Kangaroo mood="happy" className="mx-auto h-44 animate-idle-hop" />
            <h2 className="font-kids text-3xl">
              {questions.length === 0 ? "错题本是空的，太棒啦！" : "今天的错题都消灭啦！"}
            </h2>
            <p className="text-cocoa/70">No mistakes left. Great job!</p>
            <Link href="/" className="inline-block rounded-full bg-sunny px-8 py-4 font-kids text-2xl text-white shadow-lg">回家 Home</Link>
          </div>
        )}

        {q && (
          <div className="flex h-dvh flex-col overflow-y-auto px-3 py-2 md:px-4 md:py-3 lg:h-auto lg:min-h-dvh lg:space-y-5 lg:py-8">
            {result === "correct" && <Confetti />}
            <p className="shrink-0 text-center font-kids text-base text-cocoa/70 md:text-lg">
              第 {index + 1} / {questions.length} 道错题
            </p>
            <QuestionCard question={q}>
              <div className="space-y-2 md:space-y-3">
                {q.choices.map((c, i) => (
                  <ChoiceButton
                    key={i}
                    index={i}
                    zh={c.zh}
                    en={c.en}
                    variant={variantFor(i)}
                    disabled={result !== null}
                    onSelect={(i2) => void pick(i2)}
                  />
                ))}
              </div>
              {result !== null && (
                <div className="mt-2 animate-pop space-y-2 md:mt-4 md:space-y-3">
                  {result === "correct" ? (
                    <p className="rounded-2xl bg-grass/25 p-2 text-center font-kids text-lg md:p-3 md:text-xl">答对啦，移出错题本！+1⭐</p>
                  ) : (
                    <p className="rounded-2xl bg-coral/15 p-2 text-center font-kids text-base md:p-3 md:text-lg">还是不对哦，看看解析吧！</p>
                  )}
                  <div className="rounded-2xl border-4 border-cocoa/10 bg-[#fffdf5] p-3 md:p-4">
                    <p className="text-sm font-bold md:text-base">💡 {q.explanation_zh}</p>
                    <p className="mt-1 text-xs text-cocoa/60 md:text-sm">{q.explanation_en}</p>
                  </div>
                  <button
                    type="button"
                    onClick={next}
                    className="w-full rounded-full bg-sunny p-3 font-kids text-xl text-white shadow-lg active:translate-y-1 md:p-4 md:text-2xl"
                  >
                    下一题 Next →
                  </button>
                </div>
              )}
            </QuestionCard>
            <div className="flex shrink-0 justify-center">
              <Kangaroo mood={result === "correct" ? "happy" : result === "wrong" ? "sad" : "idle"} className="h-16 md:h-20 lg:h-28" />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
