import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, emoji } = body;

  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push("name = ?");
    values.push(name);
  }
  if (emoji !== undefined) {
    updates.push("emoji = ?");
    values.push(emoji);
  }

  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(
      ...values
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 级联删除由数据库外键约束自动处理
  db.prepare("DELETE FROM users WHERE id = ?").run(id);

  return NextResponse.json({ success: true });
}
