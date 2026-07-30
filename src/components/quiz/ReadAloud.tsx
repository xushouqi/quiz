"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ReadAloudProps {
  text: string;
  autoPlay?: boolean;
  /**
   * TTS 模式：
   * - 'browser': 使用浏览器内置 Web Speech API（免费，音质取决于系统语音包）
   * - 'edge': 使用 Edge TTS 神经网络语音（自然流畅，需后端 API）
   * @default 'browser'
   */
  mode?: "browser" | "edge";
}

// ============================================================
// 方案 C：浏览器 Web Speech API - 语音选择逻辑
// ============================================================

// 按优先级排序的高质量普通话语音名称关键词（越靠前越优先）
// 只包含 zh-CN / zh-Hans 系语音，绝不包含粤语 (zh-HK) 或台湾国语 (zh-TW)
const VOICE_PRIORITY = [
  // Windows 神经网络语音（最自然，全部 zh-CN）
  "xiaoxiao",
  "yunxi",
  "yunyang",
  "yunye",
  "xiaoyi",
  "xiaochen",
  "xiaomo",
  "xiaoshuang",
  // macOS/iOS 普通话语音（zh-CN）
  "tingting",
  // Google 普通话（Android/Chrome）
  "google 普通话",
  "mandarin",
];

// 只接受普通话变体，排除粤语、台湾国语等
function isMandarinVoice(v: SpeechSynthesisVoice): boolean {
  const lang = v.lang.toLowerCase();
  return (
    lang === "zh-cn" ||
    lang.startsWith("zh-cn-") ||
    lang.startsWith("zh-hans")
  );
}

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const zhVoices = voices.filter(isMandarinVoice);
  if (zhVoices.length === 0) return voices[0] || null;

  // 1. 优先找神经网络/增强语音（名称含 neural/natural/premium/enhanced）
  const neural = zhVoices.find((v) =>
    /neural|natural|premium|enhanced/i.test(v.name)
  );
  if (neural) return neural;

  // 2. 按优先级列表匹配已知高质量语音
  const lowerList = zhVoices.map((v) => v.name.toLowerCase());
  for (const keyword of VOICE_PRIORITY) {
    const idx = lowerList.findIndex((n) => n.includes(keyword));
    if (idx !== -1) return zhVoices[idx];
  }

  // 3. 优先选 localService 的本地语音（通常比网络语音延迟低、更稳定）
  const local = zhVoices.find((v) => v.localService);
  if (local) return local;

  // 4. 兜底：任意中文语音
  return zhVoices[0];
}

// ============================================================
// 方案 A：Edge TTS - 音频缓存（避免重复请求）
// ============================================================
const edgeAudioCache = new Map<string, string>(); // text -> object URL

// ============================================================
// 主组件
// ============================================================

export function ReadAloud({
  text,
  autoPlay = false,
  mode = "browser",
}: ReadAloudProps) {
  const [supported] = useState(
    () => typeof window !== "undefined" && (mode === "edge" || "speechSynthesis" in window)
  );
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("kangaroo-read-aloud-muted") === "true";
  });
  const [isLoading, setIsLoading] = useState(false);

  // 持久化静音状态
  useEffect(() => {
    localStorage.setItem("kangaroo-read-aloud-muted", String(isMuted));
  }, [isMuted]);

  // 播放状态追踪（防止组件卸载后 setState）
  const isPlayingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 浏览器模式：缓存选中的最佳语音
  const bestVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // 浏览器模式：加载语音列表
  useEffect(() => {
    if (mode !== "browser" || !supported) return;

    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        bestVoiceRef.current = pickBestVoice(voices);
      }
    };

    loadVoice();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoice);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoice);
  }, [mode, supported]);

  // 浏览器模式：iOS Safari 解锁
  useEffect(() => {
    if (mode !== "browser" || !supported || typeof document === "undefined")
      return;

    const unlock = () => {
      const utterance = new SpeechSynthesisUtterance("");
      utterance.volume = 0;
      window.speechSynthesis.speak(utterance);
      document.body.removeEventListener("click", unlock);
    };

    document.body.addEventListener("click", unlock, { once: true });
    return () => document.body.removeEventListener("click", unlock);
  }, [mode, supported]);

  // Edge 模式：清理 object URLs（组件卸载时）
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ----------------------------------------------------------------
  // 停止播放
  // ----------------------------------------------------------------
  const stop = useCallback(() => {
    if (mode === "browser") {
      window.speechSynthesis.cancel();
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    isPlayingRef.current = false;
    setIsLoading(false);
  }, [mode]);

  // ----------------------------------------------------------------
  // 播放
  // ----------------------------------------------------------------
  const speak = useCallback(async () => {
    if (!supported) return;

    // 先停掉正在播放的内容
    if (mode === "browser") window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      if (mode === "browser") {
        // 方案 C：浏览器 TTS
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "zh-CN";
        if (bestVoiceRef.current) {
          utterance.voice = bestVoiceRef.current;
        }
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        isPlayingRef.current = true;
        utterance.onend = () => {
          isPlayingRef.current = false;
        };
        utterance.onerror = () => {
          isPlayingRef.current = false;
        };
        window.speechSynthesis.speak(utterance);
      } else {
        // 方案 A：Edge TTS
        setIsLoading(true);

        // 优先使用缓存
        let audioUrl = edgeAudioCache.get(text);
        if (!audioUrl) {
          const resp = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          if (!resp.ok) throw new Error(`TTS API error: ${resp.status}`);
          const blob = await resp.blob();
          audioUrl = URL.createObjectURL(blob);
          edgeAudioCache.set(text, audioUrl);
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        isPlayingRef.current = true;
        setIsLoading(false);

        audio.onended = () => {
          isPlayingRef.current = false;
          audioRef.current = null;
        };
        audio.onerror = () => {
          isPlayingRef.current = false;
          audioRef.current = null;
        };

        await audio.play();
      }
    } catch (error) {
      console.error("TTS playback failed:", error);
      isPlayingRef.current = false;
      setIsLoading(false);
    }
  }, [text, supported, mode]);

  // ----------------------------------------------------------------
  // 自动播放逻辑
  // ----------------------------------------------------------------
  useEffect(() => {
    if (autoPlay && !isMuted && supported) {
      speak();
    }
    // text 变化时重新播放
    return () => {
      if (isPlayingRef.current) stop();
    };
  }, [text, autoPlay, isMuted, supported, speak, stop]);

  if (!supported) return null;

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      speak(); // 切换到正常模式时立即播放一次
    } else {
      stop();
      setIsMuted(true);
    }
  };

  // 根据模式和加载状态决定按钮样式
  const buttonStyle = isMuted
    ? "bg-cocoa/10"
    : isLoading
      ? "bg-gold/40 animate-pulse"
      : "bg-gold/70";

  return (
    <button
      type="button"
      onClick={toggleMute}
      aria-label={isMuted ? "取消静音" : "静音"}
      title={mode === "edge" ? "Edge TTS (神经网络)" : "浏览器 TTS"}
      className={`shrink-0 rounded-full p-1.5 text-xl transition hover:scale-110 active:scale-95 md:p-2 md:text-2xl ${buttonStyle}`}
    >
      {isMuted ? "🔇" : isLoading ? "⏳" : "🔊"}
    </button>
  );
}
