import Link from "next/link";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { StarJar } from "@/components/quiz/StarJar";
import { getDb } from "@/lib/db";
import { computeStars, computeStreak } from "@/lib/stats";

export const dynamic = "force-dynamic";

const BADGES = [
  { at: 30, emoji: "🥉", zh: "铜牌探险家", en: "Bronze Explorer" },
  { at: 100, emoji: "🥈", zh: "银牌探险家", en: "Silver Explorer" },
  { at: 300, emoji: "🥇", zh: "金牌探险家", en: "Gold Explorer" },
  { at: 600, emoji: "🏆", zh: "传奇袋鼠", en: "Legend Kangaroo" },
];

export default function StarsPage() {
  const db = getDb();
  const { stars } = computeStars(db);
  const streak = computeStreak(db);
  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 text-center">
        <header className="flex items-center justify-between">
          <Link href="/" className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">← 回家 Home</Link>
          <h1 className="font-kids text-3xl">我的星星 My Stars</h1>
          <span className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">🔥 {streak} 天</span>
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
