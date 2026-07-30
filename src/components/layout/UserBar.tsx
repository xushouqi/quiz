"use client";

import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@/components/contexts/UserContext";

export function UserBar() {
  const { currentUser } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  // Hide on the home page (where the user picks an account) or when no user is selected.
  if (!currentUser || pathname === "/") return null;

  const switchUser = () => {
    localStorage.removeItem("kangaroo-current-user");
    router.push("/");
  };

  return (
    <div className="sticky top-0 z-40 border-b-4 border-cocoa/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-1 md:px-4 md:py-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl md:text-3xl">{currentUser.emoji}</span>
          <span className="font-kids text-lg md:text-xl">{currentUser.name}</span>
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
