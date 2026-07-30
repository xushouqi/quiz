import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl">🔍</p>
      <h1 className="text-2xl font-bold text-cocoa">找不到这个页面</h1>
      <p className="max-w-md text-cocoa/70">
        你要找的页面好像走丢了，回首页看看吧！
      </p>
      <Link
        href="/"
        className="rounded-full bg-coral px-6 py-2 font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-95"
      >
        回到首页
      </Link>
    </div>
  );
}
