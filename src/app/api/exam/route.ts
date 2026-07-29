import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getExamQuestions } from "@/lib/questions";
import { insertExamPlaceholders } from "@/lib/answers";
import { createSession } from "@/lib/sessions";
import { EXAM_MINUTES } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const userId = body.userId;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();
  const questions = getExamQuestions(db);
  const startedAt = Date.now();
  const sessionId = createSession(db, "exam", startedAt, userId);
  insertExamPlaceholders(db, sessionId, questions.map((q) => q.id), startedAt);
  return NextResponse.json({ sessionId, minutes: EXAM_MINUTES, questions });
}
