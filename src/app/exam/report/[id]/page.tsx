import Link from "next/link";
import { notFound } from "next/navigation";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { getDb } from "@/lib/db";
import { encouragement } from "@/lib/format";
import { getQuestionsByIds } from "@/lib/questions";
import { getAnswersForSession, getSession } from "@/lib/sessions";
import type { Question, Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

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

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const session = getSession(db, Number(id));
  if (!session || session.mode !== "exam" || session.finished_at === null) notFound();

  const answers = getAnswersForSession(db, session.id);
  const questions = getQuestionsByIds(db, answers.map((a) => a.question_id));
  const byId = new Map<number, Question>(questions.map((q) => [q.id, q]));

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
              return (
                <li key={a.id} className="flex items-start gap-2 rounded-2xl bg-[#fffdf5] p-3">
                  <span aria-hidden="true">{icon}</span>
                  <div className="min-w-0 text-sm">
                    <p className="font-bold">{i + 1}. {q.text_zh}</p>
                    <p className="text-cocoa/60">
                      正确答案 Correct: {["A", "B", "C"][q.correct_index]} · {right.zh}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="flex justify-center gap-4 pb-8">
          <Link href="/exam" className="rounded-full bg-sunny px-8 py-4 font-kids text-xl text-white shadow-lg">再考一次 Again</Link>
          <Link href="/" className="rounded-full bg-white px-8 py-4 font-kids text-xl shadow">回家 Home</Link>
        </div>
      </div>
    </main>
  );
}
