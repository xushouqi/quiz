import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getQuestionsByIds } from "@/lib/questions";
import { scoreExam } from "@/lib/scoring";
import { finishSession, getAnswersForSession, getSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  const body = (await req.json().catch(() => ({}))) as { durationSeconds?: number };
  const db = getDb();
  const session = getSession(db, sessionId);
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });
  if (session.mode !== "exam") {
    return NextResponse.json({ error: "only exam sessions can be finished" }, { status: 400 });
  }
  if (session.finished_at !== null) {
    return NextResponse.json({ error: "session already finished" }, { status: 409 });
  }

  const answers = getAnswersForSession(db, sessionId);
  const questions = getQuestionsByIds(db, answers.map((a) => a.question_id));
  const byId = new Map(questions.map((q) => [q.id, q]));
  const result = scoreExam(
    answers.map((a) => {
      const q = byId.get(a.question_id);
      return { difficulty: q?.difficulty ?? 0, chosen: a.chosen_index, correctIndex: q?.correct_index ?? -1 };
    })
  );
  const duration = typeof body.durationSeconds === "number" ? body.durationSeconds : null;
  finishSession(
    db,
    sessionId,
    {
      score: result.score,
      maxScore: result.maxScore,
      correct: result.correct,
      wrong: result.wrong,
      blank: result.blank,
      durationSeconds: duration,
    },
    Date.now()
  );
  return NextResponse.json({ sessionId, ...result });
}
