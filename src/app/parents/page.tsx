"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { RadarChart } from "@/components/quiz/RadarChart";
import { ScoreCurve } from "@/components/quiz/ScoreCurve";

interface StatsPayload {
  stars: number;
  totalCorrect: number;
  perTopic: { topic: string; label: string; correct: number; total: number }[];
  examScores: { id: number; score: number; maxScore: number; finishedAt: number }[];
  streakDays: number;
  activeDays: number;
}

function makeGate() {
  const a = 12 + Math.floor(Math.random() * 20);
  const b = 7 + Math.floor(Math.random() * 20);
  return { a, b, answer: a + b };
}

function StatTile({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <div className="rounded-3xl border-4 border-cocoa/10 bg-white/90 p-4 text-center shadow">
      <div className="text-3xl">{emoji}</div>
      <div className="font-kids text-3xl">{value}</div>
      <div className="text-xs text-cocoa/60">{label}</div>
    </div>
  );
}

export default function ParentsPage() {
  const [gate, setGate] = useState(makeGate);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [stats, setStats] = useState<StatsPayload | null>(null);

  useEffect(() => {
    if (!unlocked) return;
    void fetch("/api/stats")
      .then((r) => r.json())
      .then((s: StatsPayload) => setStats(s));
  }, [unlocked]);

  const radarData = useMemo(() => {
    if (!stats) return [];
    return stats.perTopic.map((t) => ({
      label: t.label,
      value: t.total === 0 ? 0 : t.correct / t.total,
    }));
  }, [stats]);

  const curveData = useMemo(() => {
    if (!stats) return [];
    return stats.examScores.slice(-10).map((e) => ({ label: `#${e.id}`, score: e.score, max: e.maxScore }));
  }, [stats]);

  if (!unlocked) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <OutbackBackground />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (Number(input) === gate.answer) {
              setUnlocked(true);
            } else {
              setError(true);
              setGate(makeGate());
              setInput("");
            }
          }}
          className="w-full max-w-sm rounded-[2rem] border-4 border-cocoa/10 bg-white/95 p-8 text-center shadow-xl"
        >
          <div className="text-4xl">🔒</div>
          <h1 className="mt-2 font-kids text-2xl">家长入口 Parents Gate</h1>
          <p className="mt-1 text-sm text-cocoa/60">算一算才能进来（防止小朋友误触）</p>
          <p className="mt-4 font-kids text-3xl">
            {gate.a} + {gate.b} = ？
          </p>
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            inputMode="numeric"
            aria-label="密码答案"
            className="mt-4 w-32 rounded-2xl border-4 border-cocoa/15 p-3 text-center font-kids text-2xl focus:border-sunny focus:outline-none"
          />
          {error && <p className="mt-2 text-sm text-coral">不对哦，换一题再试！</p>}
          <button type="submit" className="mt-4 w-full rounded-full bg-sunny p-3 font-kids text-xl text-white shadow">
            进入 Enter
          </button>
          <Link href="/" className="mt-3 block text-sm text-cocoa/50 underline">← 回首页 Home</Link>
        </form>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <OutbackBackground />
        <p className="rounded-full bg-white/90 px-6 py-3 font-kids shadow">加载中…</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <header className="flex items-center justify-between">
          <h1 className="font-kids text-3xl">家长面板 Dashboard</h1>
          <Link href="/" className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">← 回首页 Home</Link>
        </header>
        <section className="grid grid-cols-3 gap-3">
          <StatTile emoji="⭐" value={stats.stars} label="星星 Stars" />
          <StatTile emoji="🔥" value={stats.streakDays} label="连续天数 Streak" />
          <StatTile emoji="🗓️" value={stats.activeDays} label="活跃天数 Active" />
        </section>
        <section className="rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl">
          <h2 className="font-kids text-2xl">题型正确率 Accuracy by topic</h2>
          <RadarChart data={radarData} />
        </section>
        <section className="rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl">
          <h2 className="font-kids text-2xl">考试分数曲线 Exam scores</h2>
          <ScoreCurve points={curveData} />
        </section>
      </div>
    </main>
  );
}
