"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { OutbackBackground } from "@/components/background/OutbackBackground";

interface User {
  id: number;
  name: string;
  emoji: string;
}

interface Stats {
  stars: number;
  streakDays: number;
}

const STATIONS = [
  { href: "/practice", emoji: "🏃", zh: "闯关练习", en: "Practice", tint: "border-sunny bg-sunny/20" },
  { href: "/exam", emoji: "📝", zh: "模拟考试", en: "Mock Exam", tint: "border-coral bg-coral/15" },
  { href: "/mistakes", emoji: "📒", zh: "错题本", en: "Mistakes", tint: "border-grass bg-grass/20" },
  { href: "/stars", emoji: "⭐", zh: "我的星星", en: "My Stars", tint: "border-gold bg-gold/30" },
];

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem("kangaroo-current-user");
    if (!userId) {
      window.location.href = "/";
      return;
    }

    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        const found = data.users.find((u: User) => u.id === Number(userId));
        if (found) {
          setUser(found);
          return fetch(`/api/stats?userId=${userId}`).then((r) => r.json());
        }
        window.location.href = "/";
      })
      .then((data) => {
        if (data) setStats(data);
      });
  }, []);

  if (!user || !stats) {
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
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-8">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-4xl">{user.emoji}</span>
            <h1 className="font-kids text-3xl sm:text-4xl">{user.name}的冒险</h1>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">🔥 {stats.streakDays} 天</span>
            <span className="rounded-full bg-gold/90 px-4 py-2 font-kids shadow">⭐ {stats.stars}</span>
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
