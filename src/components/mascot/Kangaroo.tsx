export type KangarooMood = "idle" | "happy" | "sad";

export function Kangaroo({ mood = "idle", className = "" }: { mood?: KangarooMood; className?: string }) {
  return (
    <svg viewBox="0 0 120 140" className={className} role="img" aria-label="袋鼠跳跳">
      {/* 尾巴 */}
      <path d="M30 120 Q5 118 8 95 Q18 108 34 112 Z" fill="#d97f3e" />
      {/* 脚 */}
      <ellipse cx="52" cy="126" rx="20" ry="9" fill="#e08a45" />
      <ellipse cx="72" cy="130" rx="16" ry="7" fill="#d97f3e" />
      {/* 身体 */}
      <ellipse cx="60" cy="95" rx="28" ry="32" fill="#f09a50" />
      {/* 育儿袋 */}
      <path d="M48 100 Q60 116 72 100 Q66 112 60 112 Q54 112 48 100 Z" fill="#c9773a" />
      {/* 手臂：开心时举高 */}
      {mood === "happy" ? (
        <>
          <path d="M38 78 Q28 66 32 58" stroke="#e08a45" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M82 78 Q92 66 88 58" stroke="#e08a45" strokeWidth="8" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M40 82 Q32 92 36 100" stroke="#e08a45" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M80 82 Q88 92 84 100" stroke="#e08a45" strokeWidth="8" strokeLinecap="round" fill="none" />
        </>
      )}
      {/* 头 */}
      <circle cx="60" cy="45" r="24" fill="#f09a50" />
      {/* 耳朵 */}
      <path d="M42 28 Q38 8 48 6 Q52 18 50 30 Z" fill="#e08a45" />
      <path d="M78 28 Q82 8 72 6 Q68 18 70 30 Z" fill="#e08a45" />
      <path d="M44 26 Q42 14 48 12 Q50 20 49 27 Z" fill="#ffc894" />
      <path d="M76 26 Q78 14 72 12 Q70 20 71 27 Z" fill="#ffc894" />
      {/* 口鼻 */}
      <ellipse cx="60" cy="55" rx="12" ry="9" fill="#ffc894" />
      <ellipse cx="60" cy="51" rx="4" ry="3" fill="#5c4033" />
      {/* 眼睛：难过时眯眼 */}
      {mood === "sad" ? (
        <>
          <path d="M47 42 q5 -4 10 0" stroke="#5c4033" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M63 42 q5 -4 10 0" stroke="#5c4033" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="52" cy="42" r="3.4" fill="#5c4033" />
          <circle cx="68" cy="42" r="3.4" fill="#5c4033" />
          <circle cx="53" cy="41" r="1.1" fill="#ffffff" />
          <circle cx="69" cy="41" r="1.1" fill="#ffffff" />
        </>
      )}
      {/* 嘴巴 */}
      {mood === "happy" && (
        <path d="M52 60 Q60 68 68 60" stroke="#5c4033" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {mood === "sad" && (
        <path d="M53 64 Q60 58 67 64" stroke="#5c4033" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {/* 腮红 */}
      <circle cx="44" cy="52" r="4" fill="#ffb27a" opacity="0.8" />
      <circle cx="76" cy="52" r="4" fill="#ffb27a" opacity="0.8" />
    </svg>
  );
}
