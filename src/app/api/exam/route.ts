import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getExamQuestions } from "@/lib/questions";
import { insertExamPlaceholders } from "@/lib/answers";
import { createSession } from "@/lib/sessions";
import { EXAM_MINUTES } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function POST() {
  const db = getDb();
  const questions = getExamQuestions(db);
  const startedAt = Date.now();
  const sessionId = createSession(db, "exam", startedAt);
  insertExamPlaceholders(db, sessionId, questions.map((q) => q.id), startedAt);
  return NextResponse.json({ sessionId, minutes: EXAM_MINUTES, questions });
}
