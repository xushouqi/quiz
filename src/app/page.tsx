import { Kangaroo } from "@/components/mascot/Kangaroo";
import { OutbackBackground } from "@/components/background/OutbackBackground";

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-6 p-8">
      <OutbackBackground />
      <Kangaroo mood="happy" className="h-44 animate-idle-hop" />
      <h1 className="font-kids text-4xl">跳跳的数学冒险</h1>
      <p className="rounded-full bg-white/85 px-5 py-2 text-cocoa/70 shadow">设计系统就绪 · Design system ready</p>
    </main>
  );
}
