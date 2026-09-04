"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { useUser } from "@/components/contexts/UserContext";

interface Stats {
  stars: number;
  streakDays: number;
}

const STATIONS = [
  { href: "/practice", emoji: "🏃", zh: "闯关练习", en: "Practice", tint: "border-sunny bg-sunny/20" },
  { href: "/exam", emoji: "📝", zh: "模拟考试", en: "Mock Exam", tint: "border-coral bg-coral/15" },
  { href: "/shangshi", emoji: "🏫", zh: "上实机考", en: "Shanghai Exam", tint: "border-violet/40 bg-violet/10" },
  { href: "/olympiad", emoji: "🧩", zh: "奥数练习", en: "Olympiad", tint: "border-sky-soft bg-sky-soft/20" },
  { href: "/mistakes", emoji: "📒", zh: "错题本", en: "Mistakes", tint: "border-grass bg-grass/20" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, loading } = useUser();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!currentUser) {
      router.push("/");
      return;
    }
    fetch(`/api/stats?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => setStats(null));
  }, [currentUser, loading, router]);

  if (!currentUser || !stats) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <OutbackBackground />
        <Kangaroo mood="idle" className="h-40 animate-idle-hop" />
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <OutbackBackground />
      <div className="mx-auto max-w-3xl px-4 pb-8 pt-4 md:pb-16 md:pt-8">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-3xl md:text-4xl">{currentUser.emoji}</span>
            <h1 className="font-kids text-2xl sm:text-3xl md:text-4xl">{currentUser.name}的冒险</h1>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-white/85 px-3 py-1 font-kids text-sm shadow md:px-4 md:py-2 md:text-base">🔥 {stats.streakDays} 天</span>
            <Link
              href="/stars"
              aria-label="我的星星 My Stars"
              className="rounded-full bg-gold/90 px-3 py-1 font-kids text-sm shadow transition hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 md:px-4 md:py-2 md:text-base"
            >
              ⭐ {stats.stars}
            </Link>
          </div>
        </header>

        <section className="mt-6 flex flex-col items-center gap-3 sm:mt-10 sm:flex-row sm:items-end sm:justify-center sm:gap-4">
          <Kangaroo mood="happy" className="h-32 animate-idle-hop md:h-48" />
          <div className="relative max-w-sm rounded-3xl border-4 border-cocoa/10 bg-white/90 p-4 shadow-xl md:p-5">
            <p className="font-kids text-lg leading-relaxed md:text-xl">
              你好呀！我是跳跳 🦘<br />
              今天想去哪里冒险？
            </p>
            <p className="mt-1 text-xs text-cocoa/60 md:text-sm">Hi! I am Tiao Tiao. Where to today?</p>
          </div>
        </section>

        <nav className="mt-6 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6 md:mt-12 md:gap-6">
          {STATIONS.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className={`rounded-[1.5rem] border-4 p-4 shadow-lg transition hover:-translate-y-1 hover:shadow-xl active:translate-y-0 md:rounded-[2rem] md:p-6 ${s.tint} ${i % 2 === 0 ? "sm:-rotate-1" : "sm:rotate-1"}`}
            >
              <div className="text-4xl md:text-5xl">{s.emoji}</div>
              <div className="mt-1 font-kids text-xl md:mt-2 md:text-2xl">{s.zh}</div>
              <div className="text-xs text-cocoa/60 md:text-sm">{s.en}</div>
            </Link>
          ))}
        </nav>

        <footer className="mt-12 text-center">
          <Link href="/" className="text-sm text-cocoa/50 underline">
            切换账号 · Switch Account
          </Link>
          <span className="mx-2 text-cocoa/30">·</span>
          <Link href="/parents" className="text-sm text-cocoa/50 underline">
            家长入口 · Parents
          </Link>
        </footer>
      </div>
    </main>
  );
}
