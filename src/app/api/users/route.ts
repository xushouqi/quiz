import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const users = db
    .prepare("SELECT * FROM users ORDER BY created_at DESC")
    .all();
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, emoji } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const db = getDb();
  const result = db
    .prepare("INSERT INTO users (name, emoji, created_at) VALUES (?, ?, ?)")
    .run(name, emoji || "🐨", Date.now());

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
