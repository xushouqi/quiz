"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl">😿</p>
      <h1 className="text-2xl font-bold text-cocoa">哎呀，出了点问题</h1>
      <p className="max-w-md text-cocoa/70">
        页面遇到了一点小麻烦，请再试一次吧！
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-coral px-6 py-2 font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-95"
      >
        重试
      </button>
    </div>
  );
}
