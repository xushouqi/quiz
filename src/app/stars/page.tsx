"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { StarJar } from "@/components/quiz/StarJar";

const BADGES = [
  { at: 30, emoji: "🥉", zh: "铜牌探险家", en: "Bronze Explorer" },
  { at: 100, emoji: "🥈", zh: "银牌探险家", en: "Silver Explorer" },
  { at: 300, emoji: "🥇", zh: "金牌探险家", en: "Gold Explorer" },
  { at: 600, emoji: "🏆", zh: "传奇袋鼠", en: "Legend Kangaroo" },
];

interface Stats {
  stars: number;
  streakDays: number;
}

export default function StarsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem("kangaroo-current-user");
    if (!userId) {
      window.location.href = "/";
      return;
    }

    fetch(`/api/stats?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => setStats(data));
  }, []);

  if (!stats) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <OutbackBackground />
        <Kangaroo mood="idle" className="h-40 animate-idle-hop" />
      </main>
    );
  }

  const { stars, streakDays } = stats;

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 text-center">
        <header className="flex items-center justify-between">
          <Link href="/dashboard" className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">← 返回 Back</Link>
          <h1 className="font-kids text-3xl">我的星星 My Stars</h1>
          <span className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">🔥 {streakDays} 天</span>
        </header>
        <div className="flex items-center justify-center gap-8">
          <StarJar stars={stars} />
          <Kangaroo mood={stars > 0 ? "happy" : "idle"} className="h-36 animate-idle-hop" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {BADGES.map((b) => {
            const lit = stars >= b.at;
            return (
              <div
                key={b.at}
                className={`rounded-3xl border-4 p-4 ${lit ? "border-gold bg-gold/30" : "border-cocoa/10 bg-white/50 opacity-60 grayscale"}`}
              >
                <div className="text-4xl">{b.emoji}</div>
                <div className="font-kids">{b.zh}</div>
                <div className="text-xs text-cocoa/60">{lit ? b.en : `还差 ${b.at - stars} ⭐`}</div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
