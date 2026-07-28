import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getStats(getDb()));
}
