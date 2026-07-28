import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { mode?: unknown };
  const mode = body.mode === "exam" ? "exam" : "practice";
  const id = createSession(getDb(), mode, Date.now());
  return NextResponse.json({ id });
}
