import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getQuestionsByIds } from "@/lib/questions";
import { getAnswersForSession, getSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const session = getSession(db, Number(id));
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });
  const answers = getAnswersForSession(db, session.id);
  const questions = getQuestionsByIds(db, answers.map((a) => a.question_id));
  return NextResponse.json({ session, answers, questions });
}
