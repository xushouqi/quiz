# 语音自动播放功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将手动点击播放语音改为题目切换时自动播放，并添加静音开关

**Architecture:** 改造现有的 `ReadAloud` 组件，让它内部管理自动播放和静音状态。通过 `autoPlay` prop 控制是否启用自动播放，静音状态用 localStorage 持久化。

**Tech Stack:** React 18 + TypeScript + Web Speech API (SpeechSynthesis)

## Global Constraints

- 使用 Next.js 15 App Router + TypeScript
- Tailwind CSS v4（CSS-first @theme 配置）
- 浏览器 Web Speech API（`window.speechSynthesis`）
- 静音状态存 localStorage（key: `kangaroo-read-aloud-muted`）
- iOS Safari 需要首次用户交互解锁语音引擎

---

### Task 1: 改造 ReadAloud 组件并启用自动播放

**Files:**
- Modify: `/src/components/quiz/ReadAloud.tsx`
- Modify: `/src/components/quiz/QuestionCard.tsx`

**Interfaces:**
- Consumes: `text: string` prop（现有）
- Produces: 新增 `autoPlay?: boolean` prop，组件内部管理 `isMuted` 状态

- [ ] **Step 1: 改造 ReadAloud 组件**

修改 `/src/components/quiz/ReadAloud.tsx`，添加以下功能：

1. 新增 `autoPlay` prop（可选，默认 false）
2. 新增 `isMuted` 状态，从 localStorage 读取初始值
3. 添加 `useEffect` 监听 `text` 变化，自动播放
4. 添加 iOS Safari 解锁逻辑
5. 改造按钮为开关（点击切换静音状态）

```tsx
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
      className={`shrink-0 rounded-full p-2 text-2xl transition hover:scale-110 active:scale-95 ${
        isMuted ? "bg-cocoa/10" : "bg-gold/70"
      }`}
    >
      {isMuted ? "🔇" : "🔊"}
    </button>
  );
}
```

- [ ] **Step 2: 修改 QuestionCard 传 autoPlay prop**

修改 `/src/components/quiz/QuestionCard.tsx`，给 `<ReadAloud>` 传 `autoPlay` prop：

```tsx
import type { Question } from "@/lib/types";
import { Illustration } from "./Illustration";
import { ReadAloud } from "./ReadAloud";

export function QuestionCard({
  question,
  children,
}: {
  question: Question;
  children?: React.ReactNode;
}) {
  return (
    <div className="animate-pop rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="font-kids text-2xl leading-snug sm:text-3xl">{question.text_zh}</p>
        <ReadAloud text={question.text_zh} autoPlay />
      </div>
      <p className="mb-4 text-base text-cocoa/60">{question.text_en}</p>
      <div className="mb-5">
        <Illustration descriptor={question.illustration} />
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: 手动测试验证**

在浏览器中测试以下场景：

**Practice 页面测试：**
1. 进入 `/practice` 页面，选择一个主题
2. 第一题应该自动播放中文语音 ✓
3. 点击 🔊 按钮 → 变成 🔇，语音停止 ✓
4. 点击"下一题" → 不会自动播放（因为处于静音模式）✓
5. 点击 🔇 按钮 → 变成 🔊 + 立即播放当前题目 ✓
6. 点击"下一题" → 自动播放 ✓
7. 快速连点"下一题"多次 → 只有最后一题播放完成 ✓
8. 刷新页面 → 静音状态保持 ✓

**Exam 页面测试：**
1. 进入 `/exam` 页面，开始考试
2. 第一题应该自动播放 ✓
3. 点击题目编号 5 → 切换到第 5 题，自动播放 ✓
4. 测试静音/取消静音逻辑（同上）✓

**Mistakes 页面测试：**
1. 进入 `/mistakes` 页面（需要先有错题）
2. 第一题应该自动播放 ✓
3. 点击"下一题" → 自动播放 ✓
4. 测试静音/取消静音逻辑（同上）✓

**边界情况测试：**
1. 在不支持 Web Speech API 的浏览器中打开 → 🔊 按钮不显示 ✓
2. 在系统中没有中文语音的情况下 → 静默失败，不报错 ✓

- [ ] **Step 4: 提交代码**

```bash
git add src/components/quiz/ReadAloud.tsx src/components/quiz/QuestionCard.tsx
git commit -m "feat: auto-play read aloud on question change with mute toggle

- ReadAloud component now accepts autoPlay prop
- Mute state persisted in localStorage (kangaroo-read-aloud-muted)
- Button toggles between 🔊 (normal) and 🔇 (muted)
- iOS Safari unlock: first user interaction speaks empty utterance
- QuestionCard passes autoPlay to ReadAloud
- All question pages (practice/exam/mistakes) now auto-play"
```

- [ ] **Step 5: 验证构建通过**

```bash
npm run build
```

Expected: 构建成功，无 TypeScript 错误

---

## 实施顺序

1. 改造 `ReadAloud` 组件（Step 1）
2. 修改 `QuestionCard`（Step 2）
3. 手动测试（Step 3）
4. 提交（Step 4）
5. 验证构建（Step 5）

## 不需要自动化测试

- Web Speech API 很难 mock（需要模拟 `window.speechSynthesis`）
- 核心逻辑简单，手动测试足够
- 现有项目也没有前端组件测试
