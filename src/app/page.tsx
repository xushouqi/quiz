import Link from "next/link";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { getDb } from "@/lib/db";
import { computeStars, computeStreak } from "@/lib/stats";

export const dynamic = "force-dynamic";

const STATIONS = [
  { href: "/practice", emoji: "🏃", zh: "闯关练习", en: "Practice", tint: "border-sunny bg-sunny/20" },
  { href: "/exam", emoji: "📝", zh: "模拟考试", en: "Mock Exam", tint: "border-coral bg-coral/15" },
  { href: "/mistakes", emoji: "📒", zh: "错题本", en: "Mistakes", tint: "border-grass bg-grass/20" },
  { href: "/stars", emoji: "⭐", zh: "我的星星", en: "My Stars", tint: "border-gold bg-gold/30" },
];

export default function Home() {
  const db = getDb();
  const { stars } = computeStars(db);
  const streak = computeStreak(db);
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <OutbackBackground />
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-8">
        <header className="flex items-center justify-between gap-2">
          <h1 className="font-kids text-3xl sm:text-4xl">跳跳的数学冒险</h1>
          <div className="flex gap-2">
            <span className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">🔥 {streak} 天</span>
            <span className="rounded-full bg-gold/90 px-4 py-2 font-kids shadow">⭐ {stars}</span>
          </div>
        </header>

        <section className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-center">
          <Kangaroo mood="happy" className="h-48 animate-idle-hop" />
          <div className="relative max-w-sm rounded-3xl border-4 border-cocoa/10 bg-white/90 p-5 shadow-xl">
            <p className="font-kids text-xl leading-relaxed">
              你好呀！我是跳跳 🦘<br />
              今天想去哪里冒险？
            </p>
            <p className="mt-1 text-sm text-cocoa/60">Hi! I am Tiao Tiao. Where to today?</p>
          </div>
        </section>

        <nav className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {STATIONS.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className={`rounded-[2rem] border-4 p-6 shadow-lg backdrop-blur transition hover:-translate-y-1 hover:shadow-xl active:translate-y-0 ${s.tint} ${i % 2 === 0 ? "sm:-rotate-1" : "sm:rotate-1"}`}
            >
              <div className="text-5xl">{s.emoji}</div>
              <div className="mt-2 font-kids text-2xl">{s.zh}</div>
              <div className="text-sm text-cocoa/60">{s.en}</div>
            </Link>
          ))}
        </nav>

        <footer className="mt-12 text-center">
          <Link href="/parents" className="text-sm text-cocoa/50 underline">
            家长入口 · Parents
          </Link>
        </footer>
      </div>
    </main>
  );
}
