"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { encouragement } from "@/lib/format";
import type { Question, Topic, SessionRow, AnswerRow } from "@/lib/types";

const TOPIC_ZH: Record<Topic, string> = {
  counting: "数数",
  shapes: "图形",
  patterns: "规律",
  logic: "逻辑",
  arithmetic: "计算",
  time: "时间",
};

function Bar({ label, correct, total }: { label: string; correct: number; total: number }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-cocoa/60">{correct}/{total}</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-cocoa/10">
        <div className="h-full rounded-full bg-grass" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

interface ReportData {
  session: SessionRow;
  answers: AnswerRow[];
  questions: Question[];
}

function ReportContent() {
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) {
      setState("missing");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`);
        if (!res.ok) throw new Error("not found");
        const d = (await res.json()) as ReportData;
        if (cancelled) return;
        if (!d.session || d.session.mode !== "exam" || d.session.finished_at === null) {
          setState("missing");
          return;
        }
        setData(d);
        setState("ready");
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state === "loading") {
    return (
      <main className="relative min-h-dvh">
        <OutbackBackground />
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <Kangaroo mood="happy" className="mx-auto h-32" />
          <p className="mt-4 font-kids text-xl">正在生成报告 Loading…</p>
        </div>
      </main>
    );
  }

  if (state === "missing" || !data) {
    return (
      <main className="relative min-h-dvh">
        <OutbackBackground />
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <Kangaroo mood="sad" className="mx-auto h-32" />
          <p className="mt-4 font-kids text-xl">没有找到这场考试报告 Not found</p>
          <Link href="/exam" className="mt-6 inline-block rounded-full bg-sunny px-8 py-4 font-kids text-xl text-white shadow-lg">
            去考试 Take an exam
          </Link>
        </div>
      </main>
    );
  }

  const { session, answers, questions } = data;
  const byId = new Map<number, Question>(questions.map((q) => [q.id, q]));
  const composition = {
    official: questions.filter((q) => q.source === "official").length,
    simulation: questions.filter((q) => q.source === "simulation").length,
  };

  const score = session.score ?? 0;
  const maxScore = session.max_score ?? 120;
  const praise = encouragement(score, maxScore);

  const perDifficulty = [3, 4, 5].map((d) => {
    const rows = answers.filter((a) => byId.get(a.question_id)?.difficulty === d);
    return { difficulty: d, correct: rows.filter((a) => a.is_correct === 1).length, total: rows.length };
  });
  const perTopic = (Object.keys(TOPIC_ZH) as Topic[]).map((t) => {
    const rows = answers.filter((a) => byId.get(a.question_id)?.topic === t);
    return { topic: t, correct: rows.filter((a) => a.is_correct === 1).length, total: rows.length };
  });

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <section className="rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-8 text-center shadow-xl">
          <Kangaroo mood={score / maxScore >= 0.5 ? "happy" : "sad"} className="mx-auto h-32" />
          <p className="mt-2 font-kids text-5xl text-sunny">
            {score} <span className="text-2xl text-cocoa/50">/ {maxScore}</span>
          </p>
          <p className="mt-2 font-kids text-xl">{praise.zh}</p>
          <p className="text-sm text-cocoa/60">{praise.en}</p>
          <p className="mt-3 text-cocoa/70">
            答对 {session.correct_count ?? 0} 题 · 答错 {session.wrong_count ?? 0} 题 · 未答 {session.blank_count ?? 0} 题
          </p>
          <p className="mt-2 text-sm text-cocoa/60">
            官方样题 {composition.official} 题 · 仿真模拟 {composition.simulation} 题
          </p>
        </section>

        <section className="space-y-3 rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl">
          <h2 className="font-kids text-2xl">按难度 By difficulty</h2>
          {perDifficulty.map((row) => (
            <Bar key={row.difficulty} label={`${row.difficulty} 分题`} correct={row.correct} total={row.total} />
          ))}
          <h2 className="pt-2 font-kids text-2xl">按题型 By topic</h2>
          {perTopic.map((row) => (
            <Bar key={row.topic} label={TOPIC_ZH[row.topic]} correct={row.correct} total={row.total} />
          ))}
        </section>

        <section className="space-y-2 rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl">
          <h2 className="font-kids text-2xl">每题回顾 Review</h2>
          <ol className="space-y-2">
            {answers.map((a, i) => {
              const q = byId.get(a.question_id);
              if (!q) return null;
              const icon = a.is_correct === 1 ? "✅" : a.is_correct === 0 ? "❌" : "⬜";
              const right = q.choices[q.correct_index];
              const letter = LETTERS[q.correct_index] ?? String(q.correct_index + 1);
              return (
                <li key={a.id} className="flex items-start gap-2 rounded-2xl bg-[#fffdf5] p-3">
                  <span aria-hidden="true">{icon}</span>
                  <div className="min-w-0 text-sm">
                    <p className="font-bold">{i + 1}. {q.text_zh}</p>
                    <p className="text-cocoa/60">
                      正确答案 Correct: {letter} · {right.zh}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <p className="px-4 text-center text-xs text-cocoa/50">
          官方样题来源：Math Kangaroo（Kangourou Sans Frontières）公开发布的样题/历年样卷，仅供个人练习，版权归原作者/机构所有。
        </p>

        <div className="flex justify-center gap-4 pb-8">
          <Link href="/exam" className="rounded-full bg-sunny px-8 py-4 font-kids text-xl text-white shadow-lg">再考一次 Again</Link>
          <Link href="/" className="rounded-full bg-white px-8 py-4 font-kids text-xl shadow">回家 Home</Link>
        </div>
      </div>
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense>
      <ReportContent />
    </Suspense>
  );
}
