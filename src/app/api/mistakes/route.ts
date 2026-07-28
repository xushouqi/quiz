import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getMistakeQuestions } from "@/lib/questions";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ questions: getMistakeQuestions(getDb()) });
}
