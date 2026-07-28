import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { addPracticeAnswer, getCorrectIndex, setExamAnswer } from "@/lib/answers";

export const dynamic = "force-dynamic";

interface Body {
  sessionId?: number;
  questionId?: number;
  chosenIndex?: number;
  timeSpentSeconds?: number;
  mode?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { sessionId, questionId, chosenIndex } = body;
  if (
    typeof sessionId !== "number" ||
    typeof questionId !== "number" ||
    typeof chosenIndex !== "number" ||
    chosenIndex < 0 ||
    chosenIndex > 2
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const db = getDb();
  const correctIndex = getCorrectIndex(db, questionId);
  if (correctIndex === null) {
    return NextResponse.json({ error: "question not found" }, { status: 404 });
  }
  const isCorrect = chosenIndex === correctIndex;
  const timeSpent = typeof body.timeSpentSeconds === "number" ? body.timeSpentSeconds : 0;
  if (body.mode === "exam") {
    setExamAnswer(db, sessionId, questionId, chosenIndex, isCorrect, timeSpent);
  } else {
    addPracticeAnswer(db, sessionId, questionId, chosenIndex, isCorrect, timeSpent, Date.now());
  }
  return NextResponse.json({ ok: true, isCorrect });
}
