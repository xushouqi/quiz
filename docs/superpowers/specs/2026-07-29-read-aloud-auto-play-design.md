# 语音自动播放功能设计

## 概述

将现有的手动点击播放语音功能改为题目切换时自动播放，并添加静音开关。

## 需求

- **页面范围**：practice、exam、mistakes 三个页面都启用自动播放
- **朗读内容**：只读中文题干（`text_zh`），保持现状
- **静音开关**：用户可随时切换静音/正常模式，状态持久化

## 架构设计

采用**组件内部处理**方案：改造 `ReadAloud` 组件，让它自己管理自动播放和静音状态。

### 为什么选这个方案

- 封装好，页面代码几乎不改（只在 `QuestionCard` 传一个 prop）
- 逻辑集中在一个组件，符合现有架构
- YAGNI 原则：不需要全局状态管理

### 其他被否决的方案

- **页面层控制**：每个页面用 useEffect 监听 question 变化，代码重复
- **全局 AudioContext**：创建 React Context 管理音频设置，过度设计

## 组件改造

### ReadAloud API 变化

```tsx
// 新增 autoPlay prop
<ReadAloud text={question.text_zh} autoPlay />
```

### 按钮即开关

按钮图标和行为：

| 当前状态 | 点击行为 |
|---------|---------|
| 🔊 正常模式 | 切换到 🔇 静音模式（立即停止播放） |
| 🔇 静音模式 | 切换到 🔊 正常模式 + 立即播放一次当前题目 |

### 自动播放逻辑

- 组件内部 `useEffect` 监听 `text` 变化
- 条件：`autoPlay && !isMuted` → 自动调用 `speak()`
- 静音状态存 `localStorage`（key: `kangaroo-read-aloud-muted`），刷新页面后保持

### 浏览器约束处理

**Chrome**：
- `SpeechSynthesis.speak()` 需要用户手势触发
- "下一题"按钮点击本身是用户手势，`useEffect` 在其同步调用链中执行，浏览器会认可

**iOS Safari**：
- 更严格：需要首次用户交互后才能调用 speak()
- 解决方案：在 `document.body` 上挂一个一次性的 click 监听器，首次交互时 speak 一个空 utterance 解锁语音引擎

### 状态管理

```tsx
// ReadAloud 组件内部
const [isMuted, setIsMuted] = useState(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("kangaroo-read-aloud-muted") === "true";
});

useEffect(() => {
  localStorage.setItem("kangaroo-read-aloud-muted", String(isMuted));
}, [isMuted]);

useEffect(() => {
  if (autoPlay && !isMuted && supported) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }
}, [text, autoPlay, isMuted, supported]);
```

## 触发时机

### QuestionCard 修改

给 `<ReadAloud>` 传 `autoPlay` prop：

```tsx
<ReadAloud text={question.text_zh} autoPlay />
```

### 自动播放触发

- 依赖 `useEffect` 的 `text` 依赖变化自动触发
- 题目切换时 `question` 变化 → `text` 变化 → useEffect 触发 → 自动播放

### 避免冲突

- 切换题目时先 `cancel()` 停止上一次朗读（现有逻辑已有）
- 如果用户快速连点"下一题"，每次都会 cancel 上一次的 utterance，只有最后一次会真正播放完成

### 考试页面

- 考试页面题目是通过 `current` index 切换的，`q` 对象变化 → `text` 变化 → 自动播放
- 无需额外处理

## 错误处理

- Web Speech API 在某些浏览器/系统上可能不可用（已有 `supported` 检查）
- 如果 `speechSynthesis.getVoices()` 返回空数组（某些系统没有中文语音），静默降级，不报错
- `speak()` 调用包在 try/catch 中，捕获任何意外错误

```tsx
const speak = useCallback(() => {
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  } catch {
    // 静默失败，不影响用户体验
  }
}, [text]);
```

## 测试策略

### 手动测试清单

- [ ] 进入 practice 页面 → 自动播放 ✓
- [ ] 切到静音模式 → 不再播放 ✓
- [ ] 切回正常模式 → 立即播放一次 ✓
- [ ] 快速连点"下一题" → 只有最后一次播放 ✓
- [ ] 刷新页面 → 静音状态保持 ✓
- [ ] exam 页面 → 切换题目时自动播放 ✓
- [ ] mistakes 页面 → 切换错题时自动播放 ✓

### 不需要自动化测试

- UI 交互 + 浏览器 API，E2E 测试成本高
- 核心逻辑简单，手动测试足够

## 不做的事

- 不加全局 Context（YAGNI）
- 不改页面层代码（除了给 QuestionCard 传 autoPlay）
- 不加朗读内容配置（保持只读 text_zh）
- 不加音量控制
- 不加多语言朗读切换

## 文件改动清单

1. `/src/components/quiz/ReadAloud.tsx` — 改造组件（主要改动）
2. `/src/components/quiz/QuestionCard.tsx` — 传 `autoPlay` prop
3. 无需改动 practice/exam/mistakes 页面代码

## 实施顺序

1. 改造 `ReadAloud` 组件（加 autoPlay、静音状态、按钮即开关）
2. 修改 `QuestionCard`（传 autoPlay prop）
3. 手动测试验证
4. 提交
