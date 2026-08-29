"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { type ChoiceVariant } from "@/components/quiz/ChoiceButton";
import { ChoiceList } from "@/components/quiz/ChoiceList";
import { Confetti } from "@/components/quiz/Confetti";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import type { Question } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { useUser } from "@/components/contexts/UserContext";

const FULL_SIZE = 100; // 完整答题:全部 100 题
const RANDOM_SIZE = 10; // 随机练习:每次 10 题

type Mode = "full" | "random";
type Phase = "select" | "loading" | "playing" | "done";
type Feedback = { kind: "correct"; stars: number } | { kind: "encourage" } | { kind: "reveal" };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ShangshiPage() {
  const router = useRouter();
  const { currentUser } = useUser();
  const [phase, setPhase] = useState<Phase>("select");
  const [mode, setMode] = useState<Mode>("full");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [earned, setEarned] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef(Date.now());

  const start = useCallback(
    async (m: Mode) => {
      if (!currentUser) {
        router.push("/");
        return;
      }

      setMode(m);
      setPhase("loading");
      setError(null);
      try {
        const [sessRes, qsRes] = await Promise.all([
          fetchWithTimeout("/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode: "practice", userId: currentUser.id }),
          }),
          // 一次取全部 100 题;随机练习在本地洗牌取 10(保证每次不同且不额外请求)
          fetchWithTimeout(`/api/questions?topic=random&limit=100&source=shangshi`),
        ]);
        const sess = (await sessRes.json()) as { id: number };
        const qs = (await qsRes.json()) as { questions: Question[] };
        const pickedQuestions = m === "random" ? shuffle(qs.questions).slice(0, RANDOM_SIZE) : qs.questions;
        setSessionId(sess.id);
        setQuestions(pickedQuestions);
        setIndex(0);
        setAttempt(0);
        setPicked(null);
        setFeedback(null);
        setEarned(0);
        shownAt.current = Date.now();
        setPhase(pickedQuestions.length > 0 ? "playing" : "done");
      } catch {
        setPhase("select");
        setError("加载失败：请确认服务正在运行（npm run dev）后重试。Couldn't reach the server.");
      }
    },
    [currentUser, router]
  );

  const pick = useCallback(
    (i: number) => {
      if (feedback !== null || sessionId === null) return;
      const q = questions[index];
      setPicked(i);
      const correct = i === q.correct_index;
      const timeSpentSeconds = Math.max(0, Math.round((Date.now() - shownAt.current) / 1000));

      // 作答持久化：不阻塞反馈，后台发送；失败自动重试一次
      // 上实机考题同样走统一 answers 记录,答错会进错题本
      const payload = JSON.stringify({ sessionId, questionId: q.id, chosenIndex: i, timeSpentSeconds });
      const send = () =>
        fetchWithTimeout("/api/answers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
        });
      void send().catch(() =>
        send().catch((e) => console.warn("[shangshi] 作答保存失败 answer not saved:", e))
      );

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

  // 从题图路径提取原始 PDF 题号(如 "img:/questions-images/cropped/q023.png" → 23)
  const originalNumber = (() => {
    const m = q?.illustration?.match(/\/q0*(\d+)\./);
    return m ? Number(m[1]) : undefined;
  })();

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
        <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
          <header className="flex items-center justify-between">
            <Link href="/" className="rounded-full bg-white/85 px-3 py-1.5 font-kids text-sm shadow md:px-4 md:py-2 md:text-base">← 回家 Home</Link>
            <h1 className="font-kids text-2xl md:text-3xl">上实机考</h1>
            <span className="w-20 md:w-24" aria-hidden="true" />
          </header>
          <div className="mt-6 flex flex-col items-center gap-3 sm:mt-10 sm:flex-row sm:justify-center sm:gap-4">
            <Kangaroo mood={error ? "sad" : "happy"} className="h-28 animate-idle-hop md:h-36" />
            <p className="max-w-xs rounded-3xl border-4 border-cocoa/10 bg-white/90 p-3 text-center font-kids text-lg shadow md:p-4 md:text-xl">
              上海实验学校机考题，选一种方式练一练吧！ Pick a mode!
            </p>
          </div>
          {error && (
            <p className="mx-auto mt-4 max-w-md rounded-3xl border-4 border-coral/30 bg-coral/10 p-4 text-center font-kids text-lg text-coral">
              {error}
            </p>
          )}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-6">
            <button
              type="button"
              onClick={() => void start("full")}
              className="rounded-[1.5rem] border-4 border-violet/40 bg-violet/10 p-5 text-center shadow-lg transition hover:-translate-y-1 hover:border-violet hover:shadow-xl active:translate-y-0 md:rounded-[2rem] md:p-6"
            >
              <div className="text-4xl md:text-5xl">🏫</div>
              <div className="mt-1 font-kids text-xl md:mt-2 md:text-2xl">完整答题</div>
              <div className="text-xs text-cocoa/60 md:text-sm">全部题目,按题号顺序 Full set</div>
            </button>
            <button
              type="button"
              onClick={() => void start("random")}
              className="rounded-[1.5rem] border-4 border-sunny/50 bg-sunny/15 p-5 text-center shadow-lg transition hover:-translate-y-1 hover:border-sunny hover:shadow-xl active:translate-y-0 md:rounded-[2rem] md:p-6"
            >
              <div className="text-4xl md:text-5xl">🎲</div>
              <div className="mt-1 font-kids text-xl md:mt-2 md:text-2xl">随机练习</div>
              <div className="text-xs text-cocoa/60 md:text-sm">每次随机抽 10 题 Random 10</div>
            </button>
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
        <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col px-3 py-2 md:px-4 md:py-3 lg:h-auto lg:min-h-dvh lg:space-y-5 lg:py-8">
          {feedback?.kind === "correct" && <Confetti />}
          <header className="flex shrink-0 items-center justify-between gap-2">
            <Link href="/" className="rounded-full bg-white/85 px-3 py-1.5 font-kids text-sm shadow md:px-4 md:py-2 md:text-base">← 回家</Link>
            <span className="rounded-full bg-white/85 px-3 py-1.5 font-kids text-sm shadow md:px-4 md:py-2 md:text-base">
              第 {index + 1} / {questions.length} 题{mode === "random" ? " · 随机练习" : ""}
            </span>
            <span className="rounded-full bg-gold/90 px-3 py-1.5 font-kids text-sm shadow md:px-4 md:py-2 md:text-base">⭐ {earned}</span>
          </header>

          <div className="flex min-h-0 flex-1 flex-col py-1">
            <QuestionCard question={q} largeImage questionNumber={originalNumber}>
            <ChoiceList
              choices={q.choices}
              variantFor={variantFor}
              disabled={feedback !== null}
              onSelect={(i2) => void pick(i2)}
            />

            {feedback?.kind === "encourage" && (
              <p className="mt-2 animate-pop rounded-2xl bg-gold/40 p-2 text-center font-kids text-base md:mt-4 md:p-3 md:text-lg">
                差一点点！再试一次吧～ So close! Try again!
              </p>
            )}

            {(feedback?.kind === "correct" || feedback?.kind === "reveal") && (
              <div className="mt-2 animate-pop space-y-2 md:mt-4 md:space-y-3">
                {feedback.kind === "correct" ? (
                  <p className="rounded-2xl bg-grass/25 p-2 text-center font-kids text-lg md:p-3 md:text-xl">
                    太棒了！+{feedback.stars}⭐ Awesome!
                  </p>
                ) : (
                  <p className="rounded-2xl bg-coral/15 p-2 text-center font-kids text-base md:p-3 md:text-lg">
                    没关系，看看答案吧！ Here is the answer!
                  </p>
                )}
                <div className="rounded-2xl border-4 border-cocoa/10 bg-[#fffdf5] p-3 md:p-4">
                  <p className="text-sm font-bold md:text-base">💡 {q.explanation_zh}</p>
                  <p className="mt-1 text-xs text-cocoa/60 md:text-sm">{q.explanation_en}</p>
                </div>
                <button
                  type="button"
                  onClick={next}
                  className="w-full rounded-full bg-sunny p-3 font-kids text-xl text-white shadow-lg transition hover:brightness-105 active:translate-y-1 md:p-4 md:text-2xl"
                >
                  {index + 1 >= questions.length ? "完成！Finish!" : "下一题 Next →"}
                </button>
              </div>
            )}
          </QuestionCard>
          </div>

          <div className="flex shrink-0 justify-center md:mt-0">
            <Kangaroo mood={mood} className="h-16 md:h-20 lg:h-28" />
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="mx-auto max-w-xl space-y-6 px-4 py-16 text-center">
          <Confetti />
          <Kangaroo mood="happy" className="mx-auto h-44 animate-idle-hop" />
          <h1 className="font-kids text-4xl">{mode === "full" ? "全部做完啦！Well done!" : "本轮练完啦！Well done!"}</h1>
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
