"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface User {
  id: number;
  name: string;
  emoji: string;
}

export function UserBar() {
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const userId = localStorage.getItem("kangaroo-current-user");
    if (userId && pathname !== "/") {
      fetch("/api/users")
        .then((r) => r.json())
        .then((data) => {
          const found = data.users.find((u: User) => u.id === Number(userId));
          if (found) setUser(found);
        });
    } else {
      setUser(null);
    }
  }, [pathname]);

  if (!user) return null;

  const switchUser = () => {
    localStorage.removeItem("kangaroo-current-user");
    window.location.href = "/";
  };

  return (
    <div className="sticky top-0 z-40 border-b-4 border-cocoa/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-1 md:px-4 md:py-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl md:text-3xl">{user.emoji}</span>
          <span className="font-kids text-lg md:text-xl">{user.name}</span>
        </div>
        <button
          type="button"
          onClick={switchUser}
          className="rounded-full bg-cocoa/10 px-3 py-0.5 font-kids text-xs transition hover:bg-cocoa/20 md:px-4 md:py-1 md:text-sm"
        >
          切换账号
        </button>
      </div>
    </div>
  );
}
