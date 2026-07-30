"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { useUser } from "@/components/contexts/UserContext";

export default function HomePage() {
  const router = useRouter();
  const { users, loading, setCurrentUserId } = useUser();

  // Clear current user when landing on the home page so the UserBar stays hidden
  // and the next selectUser() flow refreshes from the fresh localStorage id.
  useEffect(() => {
    setCurrentUserId(null);
    // Only run on mount / when the page is entered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectUser = (userId: number) => {
    setCurrentUserId(userId);
    router.push("/dashboard");
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
          <h1 className="font-kids text-3xl">欢迎来到袋鼠数学！</h1>
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
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
        <header className="mb-4 text-center md:mb-8">
          <h1 className="font-kids text-3xl md:text-4xl">选择你的账号</h1>
          <p className="mt-1 text-sm text-cocoa/60 md:mt-2 md:text-base">Pick your account</p>
        </header>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user.id)}
              className="group rounded-[1.5rem] border-4 border-cocoa/10 bg-white/90 p-4 text-center shadow-xl transition hover:-rotate-2 hover:border-sunny hover:shadow-2xl active:translate-y-1 md:rounded-[2rem] md:p-6"
            >
              <div className="text-5xl transition group-hover:scale-110 md:text-6xl">
                {user.emoji}
              </div>
              <div className="mt-2 font-kids text-xl md:mt-3 md:text-2xl">{user.name}</div>
            </button>
          ))}

          <Link
            href="/parents"
            className="flex items-center justify-center rounded-[1.5rem] border-4 border-dashed border-cocoa/20 bg-white/50 p-4 text-center transition hover:border-sunny hover:bg-white/80 md:rounded-[2rem] md:p-6"
          >
            <div>
              <div className="text-5xl md:text-6xl">➕</div>
              <div className="mt-2 font-kids text-lg text-cocoa/60 md:mt-3 md:text-xl">
                添加新用户
              </div>
            </div>
          </Link>
        </div>

        <footer className="mt-8 text-center md:mt-12">
          <Link href="/parents" className="text-sm text-cocoa/50 underline">
            家长入口 · Parents
          </Link>
        </footer>
      </div>
    </main>
  );
}
