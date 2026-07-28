import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPracticeQuestions } from "@/lib/questions";
import { TOPICS, type Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topicParam = url.searchParams.get("topic") ?? "random";
  const topic: Topic | "random" =
    topicParam === "random" || (TOPICS as readonly string[]).includes(topicParam)
      ? (topicParam as Topic | "random")
      : "random";
  const rawLimit = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.floor(rawLimit)), 54) : 10;
  const questions = getPracticeQuestions(getDb(), topic, limit);
  return NextResponse.json({ questions });
}
