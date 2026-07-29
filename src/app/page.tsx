"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { Kangaroo } from "@/components/mascot/Kangaroo";

interface User {
  id: number;
  name: string;
  emoji: string;
}

export default function HomePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users);
        setLoading(false);
      });
  }, []);

  const selectUser = (userId: number) => {
    localStorage.setItem("kangaroo-current-user", String(userId));
    window.location.href = "/dashboard";
  };

  if (loading) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <OutbackBackground />
        <Kangaroo mood="idle" className="h-40 animate-idle-hop" />
      </main>
    );
  }

  if (users.length === 0) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <OutbackBackground />
        <div className="mx-auto max-w-md rounded-[2rem] border-4 border-cocoa/10 bg-white/95 p-8 text-center shadow-xl">
          <Kangaroo mood="happy" className="mx-auto h-32 animate-idle-hop" />
          <h1 className="mt-4 font-kids text-3xl">欢迎来到袋鼠数学！</h1>
          <p className="mt-2 text-cocoa/70">先创建第一个用户吧</p>
          <Link
            href="/parents"
            className="mt-6 inline-block rounded-full bg-sunny px-8 py-4 font-kids text-2xl text-white shadow-lg active:translate-y-1"
          >
            去家长面板 ➡️
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8 text-center">
          <h1 className="font-kids text-4xl">选择你的账号</h1>
          <p className="mt-2 text-cocoa/60">Pick your account</p>
        </header>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user.id)}
              className="group rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 text-center shadow-xl transition hover:-rotate-2 hover:border-sunny hover:shadow-2xl active:translate-y-1"
            >
              <div className="text-6xl transition group-hover:scale-110">
                {user.emoji}
              </div>
              <div className="mt-3 font-kids text-2xl">{user.name}</div>
            </button>
          ))}

          <Link
            href="/parents"
            className="flex items-center justify-center rounded-[2rem] border-4 border-dashed border-cocoa/20 bg-white/50 p-6 text-center transition hover:border-sunny hover:bg-white/80"
          >
            <div>
              <div className="text-6xl">➕</div>
              <div className="mt-3 font-kids text-xl text-cocoa/60">
                添加新用户
              </div>
            </div>
          </Link>
        </div>

        <footer className="mt-12 text-center">
          <Link href="/parents" className="text-sm text-cocoa/50 underline">
            家长入口 · Parents
          </Link>
        </footer>
      </div>
    </main>
  );
}
