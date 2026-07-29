import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getMistakeQuestions } from "@/lib/questions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get("userId"));

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  return NextResponse.json({ questions: getMistakeQuestions(getDb(), userId) });
}
