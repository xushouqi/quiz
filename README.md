# 跳跳的数学冒险 🦘 — 袋鼠数学竞赛 × 上实机考 双语练习平台

> 为 6–8 岁（1–2 年级）孩子打造的数学闯关平台，覆盖**袋鼠数学竞赛**（Math Kangaroo Level 1–2）与**上海实验学校机考真题**两大体系，中英双语，支持联网 / 离线 / 安卓 APK 三种使用方式。

---

## ✨ 功能总览

| 模块 | 说明 |
|------|------|
| 🏃 **闯关练习** | 6 大题型 + 随机混合，每题两次作答机会，即时动画反馈与双语解析，🔊 中文读题（浏览器 Web Speech / Edge TTS 神经网络语音 双模式） |
| 📝 **模拟考试** | 还原官方赛制：24 题 / 75 分钟 / 起始 24 分 / 答对按难度 +3·+4·+5 / 答错 −1 / 不答 0 / 满分 120；带题号跳转网格、标记回顾、考后分题型正确率报告 |
| 🏫 **上实机考** | 上海实验学校历届机考真题 96 题（100 题规模，图片题为主），完整模式 100 题 + 随机练习 10 题 |
| 📒 **错题本** | 自动收录错题，重做答对即移出，支持反复巩固 |
| ⭐ **星星与徽章** | 首次答对 +3⭐，再次答对 +1⭐；里程碑徽章：🥉 30⭐ → 🥈 100⭐ → 🥇 300⭐ → 🏆 600⭐（星星罐动画） |
| 👪 **家长面板** | 算术密码门（随机两位数加法）；题型正确率雷达图、考试分数曲线、连续打卡天数、活跃天数；多娃切换 |
| 👤 **多用户** | 同一设备支持多个孩子，各有独立的星星 / 错题 / 考试历史 |
| 🔊 **朗读** | 每题可点 🔊 朗读题干；离线 APK 内预生成全部音频，无需网络 |
| 📱 **安卓离线** | 基于 Capacitor，整站打包为 APK，题目 / 音频 / 进度全部本地化，无网也能用 |

---

## 🗂️ 题库规模

| 来源 | 目录 | 用途 | 题目数 |
|------|------|------|--------|
| 原创（按题型） | `questions/practice/` | 闯关练习 | 6 主题 × 21 = **126** |
| 官方公开样题 | `questions/official/` | 模拟考试（优先抽取） | **15** |
| 原创仿真 | `questions/simulation/` | 模拟考试（补齐难度） | 6 主题 × 5 = **30** |
| 上实机考真题 | `questions/shangshi/` | 上实机考模块 | **96** |
| **合计** | | | **267** |

---

## 🚀 快速开始

### 在线模式（家里电脑 / 服务器）

```bash
git clone <repo>
cd quiz
npm install
npm run seed          # 导入题库 → data/quiz.db
npm run dev           # 开发模式：http://localhost:3000（带 HMR）

# 生产部署（推荐）
npm run build
npm start             # 或 systemd 托管，见下文
```

### 离线安卓 APK

```bash
# 1. 预生成全部题干音频（复用 data/tts-cache 已有缓存，支持断点续传）
npm run audio:offline        # → public/tts/*.mp3 + src/lib/offline/audio-map.ts

# 2. 内嵌题目数据到 bundle
npm run export:offline       # → src/lib/offline/data-embedded.ts

# 3. 静态导出（临时移走 API routes，启用 output: 'export'）
npm run build:android        # → out/

# 4. 同步到 Capacitor Android 工程
npx cap sync android

# 5. 用 Android Studio 打开 android/ 打包 APK
```

---

## 📖 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（端口 3000，HMR 热更新） |
| `npm run build && npm start` | 生产模式（本地） |
| `npm test` | 运行 Vitest 测试（13 个文件，97 个用例） |
| `npm run seed` | 重新导入题库（清空作答历史） |
| `npm run audio:offline` | 预生成全部离线朗读音频 |
| `npm run export:offline` | 把题库导出为 TS 常量供离线 bundle |
| `npm run build:android` | 静态导出（供 Capacitor 打包 APK） |

---

## 🏗️ 技术栈

| 层 | 选型 |
|----|------|
| 框架 | Next.js 15（App Router） |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4（自定义 `cocoa / grass / sunny / coral / violet` 童趣调色板） |
| 数据库 | better-sqlite3（SQLite，存于 `data/quiz.db`） |
| 测试 | Vitest（13 个测试文件，97 用例） |
| 朗读 | 浏览器 Web Speech API（免费）+ Edge TTS（Python wrapper，神经网络音质） |
| 图表 / 动画 | 全部手写 SVG（雷达图、分数曲线、星星罐、袋鼠 mascot、Outback 背景） |
| 安卓打包 | Capacitor 8 + 静态导出（`output: 'export'`） |

无第三方图表库、无动画库、无 UI 框架——全部手搓。

---

## 📂 项目结构

```
quiz/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 首页：选娃入口
│   │   ├── dashboard/          # 娃的个人主页（星星 + 四大入口）
│   │   ├── practice/           # 闯关练习
│   │   ├── exam/               # 模拟考试 + report/ 考后报告
│   │   ├── shangshi/           # 上实机考
│   │   ├── mistakes/           # 错题本
│   │   ├── stars/              # 星星罐 + 徽章
│   │   ├── parents/            # 家长面板（密码门）
│   │   └── api/                # 路由处理器
│   │       ├── answers/        # 提交作答
│   │       ├── exam/           # 抽题 + 交卷
│   │       ├── mistakes/       # 错题增删
│   │       ├── questions/      # 按 source/topic 查题
│   │       ├── sessions/       # 会话管理 + finish
│   │       ├── stats/          # 统计数据
│   │       ├── tts/            # 朗读音频（Edge TTS + 磁盘缓存 + single-flight）
│   │       └── users/          # 多用户 CRUD
│   ├── components/
│   │   ├── quiz/               # 题卡 / 选项 / 朗读 / 雷达图 / 分数曲线 / 星星罐 / 撒花
│   │   ├── mascot/             # 袋鼠（多 mood 动画）
│   │   ├── background/         # Outback 背景
│   │   ├── layout/             # UserBar
│   │   └── contexts/           # UserContext（多娃状态）
│   ├── lib/
│   │   ├── db.ts               # SQLite 连接
│   │   ├── types.ts            # 全局类型（Topic / Difficulty / Source / Question / ...）
│   │   ├── scoring.ts          # 考试计分（24 起步 / 按难度 +3·+4·+5 / 答错 −1）
│   │   ├── questions.ts        # 抽题逻辑
│   │   ├── answers.ts          # 作答写入
│   │   ├── sessions.ts         # 会话读写
│   │   ├── stats.ts            # 家长面板统计
│   │   ├── validate.ts         # 题库 JSON schema 校验
│   │   ├── format.ts           # 工具格式化
│   │   ├── fetch-timeout.ts    # 客户端 fetch 封装
│   │   └── offline/            # 离线模式（fetch 拦截 + localStorage + 内嵌数据 + 音频映射）
│   └── scripts/
│       └── seed.ts             # 题库导入
├── questions/                  # 题库 JSON（按 source 分目录）
│   ├── practice/               # 6 个主题 × 21 题
│   ├── official/               # 官方公开样题（带 attribution）
│   ├── simulation/             # 原创仿真（按难度补齐）
│   └── shangshi/               # 上实机考（q001-010 ... q091-100，图片题为主）
├── public/
│   └── questions-images/       # 题目配图（官方样题 + 上实机考裁切图）
├── data/
│   ├── quiz.db                 # SQLite 题库（seed 生成）
│   └── tts-cache/              # Edge TTS 磁盘缓存（sha256 命名）
├── android/                    # Capacitor Android 工程
├── scripts/
│   ├── build-offline.mjs       # 离线静态导出（临时移走 api 目录）
│   ├── export-offline-data.ts  # 题库 → TS 常量
│   ├── generate-offline-audio.js  # 预生成朗读音频
│   ├── edge-tts-wrapper.py     # Edge TTS Python 桥
│   └── make-app-icon.py        # APK 图标生成
└── tests/                      # Vitest（13 文件 / 97 用例）
```

---

## 🎮 使用流程

### 首次使用

1. `npm run seed` 生成数据库
2. `npm run dev` 启动，打开 `http://localhost:3000`
3. 首页选娃（或新建）→ 进入 dashboard
4. dashboard 四入口：
   - 🏃 **闯关练习**：挑主题或随机，每次 10 题
   - 📝 **模拟考试**：24 题 / 75 分钟，完整赛制
   - 🏫 **上实机考**：完整 100 题 或 随机 10 题练习
   - 📒 **错题本**：自动收录，重做答对即移出

### 平板 / 局域网访问

```bash
# 开发模式（带 HMR）
npm run dev -- -H 0.0.0.0

# 生产模式
npm run build && HOST=0.0.0.0 npm start
```

平板浏览器访问 `http://<电脑IP>:3000`。

### 生产部署（systemd 推荐）

```ini
# /etc/systemd/system/kangaroo-quiz.service
[Unit]
Description=Kangaroo Quiz (Next.js)
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/quiz
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=PORT=3000
Environment=HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now kangaroo-quiz
sudo journalctl -u kangaroo-quiz -f   # 看日志
```

### 安卓离线 APK

无需网络、无需服务器，整站打包进 APK：

```bash
npm run seed
npm run audio:offline     # 首次会调用 Edge TTS，之后复用缓存
npm run export:offline
npm run build:android
npx cap sync android
# Android Studio 打开 android/ → Build APK
```

APK 内：
- 题目数据内嵌为 TS 常量（`src/lib/offline/data-embedded.ts`）
- 朗读音频作为静态资源打进 APK（`public/tts/*.mp3`）
- 用户 / 作答 / 会话全部存 localStorage（不可用时降级内存）
- `window.fetch` 被拦截，`/api/*` 请求路由到本地适配器

---

## ✏️ 添加 / 修改题目

题库按来源分四个子目录，`npm run seed` 按目录写入 `source`：

| 目录 | source | 用途 |
|------|--------|------|
| `questions/practice/` | `practice` | 闯关练习（按主题分文件） |
| `questions/official/` | `official` | 官方公开样题（建议带 `attribution`） |
| `questions/simulation/` | `simulation` | 原创仿真（用于模拟考试按难度补齐） |
| `questions/shangshi/` | `shangshi` | 上实机考真题（图片题为主，每 10 题一个文件） |

### 题目 JSON 字段

```jsonc
{
  "difficulty": 3,                          // 3 | 4 | 5（对应 3/4/5 分题）
  "topic": "patterns",                      // counting | shapes | patterns | logic | arithmetic | time
  "text_zh": "看图片，按规律，问号处应该填什么数字？",
  "text_en": "Look at the pattern. What number goes in place of ?",
  "illustration": "img:/questions-images/cropped/q001.png",  // 可选，见下表
  "choices": [
    { "zh": "A", "en": "A", "img": "/questions-images/options/q001_o1.png" }
    // 纯文字选项：{ "zh": "5 个", "en": "5" }
  ],
  "correct_index": 3,                       // 0-based
  "explanation_zh": "答案是6。规律是...",
  "explanation_en": "The answer is 6. ...",
  "attribution": "MK-USA 2024 G1-2 Q3"     // 官方题建议加
}
```

### 插图描述符（`illustration` 字段）

| 前缀 | 示例 | 渲染 |
|------|------|------|
| `emoji:` | `emoji:🍎🍎🍎` | 直接显示 emoji |
| `svg:clock:` | `svg:clock:6:30` | 手绘 SVG 钟表 |
| `svg:grid` | `svg:grid` | 网格 |
| `svg:diagsquare` | `svg:diagsquare` | 对角方块 |
| `svg:dice:` | `svg:dice:5` | 骰子 |
| `svg:bars:` | `svg:bars:3,5,2` | 柱状图 |
| `img:` | `img:/questions-images/xxx.png` | 真实图片 |

选项本身是图片时，给选项加 `img` 字段（描述符同上），`zh`/`en` 作为朗读 / 无障碍标签。

> ⚠️ **重新 seed 会清空作答历史**（题目 ID 变化），星星与错题本随之重置。
>
> 模拟考试只从 `official` + `simulation` 抽题（官方优先、仿真补齐）；闯关练习只用 `practice`；上实机考只用 `shangshi`——三库零重叠。

---

## 🔊 朗读系统

两种模式，客户端 `ReadAloud` 组件统一封装：

| 模式 | 触发条件 | 音质 | 离线 |
|------|----------|------|------|
| `browser`（默认） | 浏览器在线 | 取决于系统语音包 | 部分浏览器支持 |
| `edge` | 后端 API 可用 | 神经网络，自然流畅 | 需预生成 |

服务端 `/api/tts`：
- 调用 Python `scripts/edge-tts-wrapper.py`，使用 `zh-CN-XiaoxiaoNeural`
- 磁盘缓存于 `data/tts-cache/<sha256>.mp3`
- 进程内 single-flight：相同 key 并发生成共享一个任务

离线 APK：
- `npm run audio:offline` 一次性预生成所有题干音频
- 输出 `public/tts/*.mp3`（打进 APK）+ `src/lib/offline/audio-map.ts`（文本 → 路径映射）
- 客户端读 audio-map 直接播放本地 mp3

---

## 📱 安卓离线架构

```
┌──────────────────────────────────────┐
│  Capacitor WebView                   │
│  ┌─────────────────────────────────┐ │
│  │  静态 HTML/JS/CSS（out/）       │ │
│  │  + 内嵌题目（data-embedded.ts） │ │
│  │  + 预生成音频（public/tts/）    │ │
│  └──────────┬──────────────────────┘ │
│             │                        │
│  window.fetch 拦截                   │
│     ↓ 非 /api/* → 原 fetch          │
│     ↓ /api/* → 本地适配器           │
│                                     │
│  localStorage（用户 / 会话 / 作答） │
└──────────────────────────────────────┘
```

`next.config.ts` 检测 `NEXT_PUBLIC_OFFLINE=true` 时：
- 启用 `output: 'export'`（纯静态）
- `scripts/build-offline.mjs` 临时移走 `src/app/api`，构建完恢复，保证在线 / 离线两不干扰

---

## 🧪 测试

```bash
npm test                # 单次运行
npm run test:watch      # watch 模式
```

13 个测试文件，97 个用例，覆盖：

| 文件 | 关注点 |
|------|--------|
| `smoke.test.ts` | 基础导入 / 启动 sanity |
| `db.test.ts` | SQLite schema / 连接 |
| `seed.test.ts` | 题库导入流程 |
| `validate.test.ts` | 题库 JSON schema 校验 |
| `questions.test.ts` | 抽题逻辑（按 source / topic / 难度） |
| `answers.test.ts` | 作答写入 / 正误判定 |
| `answers-route.test.ts` | `/api/answers` 路由 |
| `mistakes.test.ts` | 错题本增删 |
| `scoring.test.ts` | 考试计分（24 起步 / 按难度 / 答错扣分） |
| `stats.test.ts` | 家长面板统计（星星 / 连续打卡 / 题型正确率） |
| `format.test.ts` | 格式化工具 |
| `illustration.test.ts` | 插图描述符解析 |
| `offline.test.ts` | 离线适配器（fetch 拦截 / localStorage） |

---

## 🎨 视觉风格

- **澳洲 Outback 背景**：手绘 SVG 沙漠 + 阳光 + 云彩
- **袋鼠 mascot**：多 mood 动画（idle / happy / sad / cheer）
- **童趣调色板**：`cocoa`（可可棕）/ `grass`（草地绿）/ `sunny`（阳光黄）/ `coral`（珊瑚红）/ `violet`（紫）
- **星星罐**：SVG 罐子 + 液面上升动画
- **撒花**：答对时的 Confetti 粒子效果
- **全部手写**：无图标库、无动画库、无图表库

---

## 📄 说明

- 闯关练习题目为按袋鼠数学竞赛题型风格**原创**编写。
- 模拟考试含**官方公开发布**的样题 / 历年样卷（来源：Math Kangaroo / Kangourou Sans Frontières），仅供个人练习，版权归原作者 / 机构所有；不足部分由原创仿真题按难度补齐。
- 上实机考题目来自上海实验学校历届机考回忆版，整理自家长社区公开资料。
- 官方样题与规则参考：
  - <https://mathkangaroo.org/mks/practice/free-question-samples/>
  - <https://www.mathkangaroo.in/>

---

## 📜 License

本项目仅供个人 / 家庭教育使用。官方袋鼠数学竞赛题目版权归原作者 / 机构所有。
