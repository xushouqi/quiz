import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { mode?: unknown; userId?: number };
  const mode = body.mode === "exam" ? "exam" : "practice";
  const userId = body.userId;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const id = createSession(getDb(), mode, Date.now(), userId);
  return NextResponse.json({ id });
}
