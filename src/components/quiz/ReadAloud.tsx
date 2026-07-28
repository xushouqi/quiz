"use client";

import { useState } from "react";

export function ReadAloud({ text }: { text: string }) {
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window
  );
  if (!supported) return null;
  const speak = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };
  return (
    <button
      type="button"
      onClick={speak}
      aria-label="朗读题目"
      className="shrink-0 rounded-full bg-gold/70 p-2 text-2xl transition hover:scale-110 active:scale-95"
    >
      🔊
    </button>
  );
}
