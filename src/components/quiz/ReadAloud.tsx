"use client";

import { useCallback, useEffect, useState } from "react";

interface ReadAloudProps {
  text: string;
  autoPlay?: boolean;
}

export function ReadAloud({ text, autoPlay = false }: ReadAloudProps) {
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window
  );
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("kangaroo-read-aloud-muted") === "true";
  });

  // 持久化静音状态
  useEffect(() => {
    localStorage.setItem("kangaroo-read-aloud-muted", String(isMuted));
  }, [isMuted]);

  // iOS Safari 解锁：首次用户交互时 speak 一个空 utterance
  useEffect(() => {
    if (!supported || typeof document === "undefined") return;

    const unlock = () => {
      const utterance = new SpeechSynthesisUtterance("");
      utterance.volume = 0;
      window.speechSynthesis.speak(utterance);
      document.body.removeEventListener("click", unlock);
    };

    document.body.addEventListener("click", unlock, { once: true });
    return () => document.body.removeEventListener("click", unlock);
  }, [supported]);

  const speak = useCallback(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch {
      // 静默失败
    }
  }, [text, supported]);

  // 自动播放逻辑
  useEffect(() => {
    if (autoPlay && !isMuted && supported) {
      speak();
    }
  }, [text, autoPlay, isMuted, supported, speak]);

  if (!supported) return null;

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      speak(); // 切换到正常模式时立即播放一次
    } else {
      window.speechSynthesis.cancel();
      setIsMuted(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleMute}
      aria-label={isMuted ? "取消静音" : "静音"}
      className={`shrink-0 rounded-full p-1.5 text-xl transition hover:scale-110 active:scale-95 md:p-2 md:text-2xl ${
        isMuted ? "bg-cocoa/10" : "bg-gold/70"
      }`}
    >
      {isMuted ? "🔇" : "🔊"}
    </button>
  );
}
