import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getOlympiadQuestions, getPracticeQuestions, getShangshiQuestions } from "@/lib/questions";
import { SOURCES, TOPICS, type Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topicParam = url.searchParams.get("topic") ?? "random";
  const sourceParam = url.searchParams.get("source") ?? "practice";
  const topic: Topic | "random" =
    topicParam === "random" || (TOPICS as readonly string[]).includes(topicParam)
      ? (topicParam as Topic | "random")
      : "random";
  const source = (SOURCES as readonly string[]).includes(sourceParam) ? sourceParam : "practice";
  const rawLimit = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.floor(rawLimit)), 100) : 10;
  const clampDiff = (raw: string | null, fallback: number) => {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(Math.max(1, Math.floor(n)), 6) : fallback;
  };
  const diffMin = clampDiff(url.searchParams.get("diffMin"), 1);
  const diffMax = clampDiff(url.searchParams.get("diffMax"), 6);

  const questions =
    source === "shangshi"
      ? getShangshiQuestions(getDb(), topic, limit)
      : source === "olympiad"
        ? getOlympiadQuestions(getDb(), topic, limit, diffMin, diffMax)
        : getPracticeQuestions(getDb(), topic, limit);
  return NextResponse.json({ questions });
}
