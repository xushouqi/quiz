# 袋鼠数学测验网站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 6-8 岁孩子构建一个袋鼠数学竞赛（Level 1-2）双语测验网站，含闯关练习、全真模拟考试、错题本、星星激励与家长统计。

**Architecture:** Next.js 15 App Router 全栈应用。服务端用 better-sqlite3 直连 SQLite（`data/quiz.db`）；题库以 JSON 文件维护、seed 脚本导入；页面为 React 客户端组件 + 服务端组件混合；无第三方图表/动画库，全部手写 CSS/SVG。

**Tech Stack:** Next.js 15 · TypeScript · Tailwind CSS v4 · better-sqlite3 · Vitest · tsx · next/font (ZCOOL KuaiLe / Baloo 2 / Noto Sans SC)

## Global Constraints

- Next.js 15 App Router + TypeScript，Tailwind CSS（scaffold 自带的 v4，CSS-first 配置写在 `src/app/globals.css` 的 `@theme` 中）
- SQLite 经 better-sqlite3 访问，数据库文件 `data/quiz.db`，可用环境变量 `QUIZ_DB_PATH` 覆盖（测试用 `:memory:`）
- 每道题**恰好 3 个选项**；`correct_index ∈ {0,1,2}`；双语题干与解析（zh/en）均非空——seed 前强制校验，不合法即报错退出
- 考试赛制：24 题（8×3 分 + 8×4 分 + 8×5 分）、75 分钟、起始分 24、答对加该题分值、答错 −1、不答 0、满分 120
- 星星由 `answers` 表派生：每题首次答对 +3⭐，同一题再次答对 +1⭐
- 不引入任何图表库、动画库（纯 CSS keyframes + 内联 SVG）；不引入 ORM
- UI 文案中文为主、英文为辅（每题/每按钮成对出现）
- 无登录、无多用户（家庭单孩子使用）；家长页用算术密码门防孩子误触
- 服务端代码中使用 better-sqlite3 的模块需在 `next.config.ts` 的 `serverExternalPackages` 中声明
- 每个任务结束必须通过对应测试并 git 提交

---

## File Structure

```
/home/xsq/quiz/
├── package.json                     # 脚本: dev/build/start/seed/test
├── next.config.ts                   # serverExternalPackages: ["better-sqlite3"]
├── vitest.config.ts                 # node 环境, @ → src 别名
├── tsconfig.json                    # scaffold 生成, 含 @/* 路径
├── data/                            # quiz.db（gitignore）
├── questions/                       # 题库 JSON（每主题一个文件，每文件 9 题）
│   ├── counting.json
│   ├── shapes.json
│   ├── patterns.json
│   ├── logic.json
│   ├── arithmetic.json
│   └── time.json
├── src/
│   ├── app/
│   │   ├── layout.tsx               # 字体挂载、全局背景色
│   │   ├── globals.css              # @theme 调色板/字体/动画 keyframes
│   │   ├── page.tsx                 # 首页·冒险地图
│   │   ├── practice/page.tsx        # 闯关练习（客户端）
│   │   ├── exam/page.tsx            # 模拟考试（客户端）
│   │   ├── exam/report/[id]/page.tsx# 考试报告（服务端）
│   │   ├── mistakes/page.tsx        # 错题本（客户端）
│   │   ├── stars/page.tsx           # 星星与徽章（服务端）
│   │   ├── parents/page.tsx         # 家长统计 + 密码门（客户端）
│   │   └── api/
│   │       ├── questions/route.ts       # GET 练习题
│   │       ├── exam/route.ts            # POST 开考（创建会话+占位答案）
│   │       ├── sessions/route.ts        # POST 创建练习会话
│   │       ├── answers/route.ts         # POST 记录一次作答
│   │       ├── sessions/[id]/route.ts   # GET 会话+答案+题目（报告用）
│   │       ├── sessions/[id]/finish/route.ts  # POST 交卷计分
│   │       ├── mistakes/route.ts        # GET 错题
│   │       └── stats/route.ts           # GET 统计数据
│   ├── components/
│   │   ├── background/OutbackBackground.tsx  # 天空/云/山丘/太阳
│   │   ├── mascot/Kangaroo.tsx               # 袋鼠跳跳 SVG（idle/happy/sad）
│   │   └── quiz/
│   │       ├── Illustration.tsx   # emoji + svg:clock/grid/diagsquare
│   │       ├── ChoiceButton.tsx
│   │       ├── QuestionCard.tsx
│   │       ├── ReadAloud.tsx      # speechSynthesis zh-CN
│   │       ├── Confetti.tsx
│   │       ├── StarJar.tsx
│   │       ├── RadarChart.tsx
│   │       └── ScoreCurve.tsx
│   ├── lib/
│   │   ├── types.ts        # 共享类型
│   │   ├── db.ts           # openDb / getDb / SCHEMA
│   │   ├── scoring.ts      # scoreExam（官方计分）
│   │   ├── format.ts       # formatClock / encouragement
│   │   ├── validate.ts     # 题库校验
│   │   ├── questions.ts    # 取题查询（练习/考试/错题）
│   │   ├── sessions.ts     # 会话查询
│   │   ├── answers.ts      # 作答写入
│   │   └── stats.ts        # 星星/连续天数/统计派生
│   └── scripts/
│       └── seed.ts         # 读 JSON → 校验 → 写库
└── tests/
    ├── db.test.ts
    ├── scoring.test.ts
    ├── format.test.ts
    ├── validate.test.ts
    ├── seed.test.ts
    ├── questions.test.ts
    ├── answers.test.ts
    ├── mistakes.test.ts
    ├── stats.test.ts
    └── illustration.test.ts
```

---

### Task 1: 项目脚手架与工具链

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `.gitignore`（scaffold 生成，随后调整）
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: 可运行的 Next.js 项目；`npm run test` 可执行 Vitest；`@/*` 别名指向 `src/*`

- [ ] **Step 1: 用 create-next-app 生成脚手架到临时目录**

在仓库内临时目录生成（这样 create-next-app 检测到父级 git 仓库，不会另建 git）：

```bash
cd /home/xsq/quiz
mkdir -p .scaffold && cd .scaffold
CI=1 npx --yes create-next-app@15 . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

预期：安装成功，生成 `package.json`、`src/app/`、`tsconfig.json` 等。

- [ ] **Step 2: 把脚手架内容移入仓库根目录**

```bash
cd /home/xsq/quiz
shopt -s dotglob
mv .scaffold/* .
rmdir .scaffold
ls package.json src/app/layout.tsx
```

预期：根目录出现 Next 项目文件，`.git`、`docs/` 原样保留。

- [ ] **Step 3: 安装运行时与开发依赖**

```bash
cd /home/xsq/quiz
npm install better-sqlite3
npm install -D vitest tsx @types/better-sqlite3
```

- [ ] **Step 4: 配置 next.config.ts**

把 `src/../next.config.ts`（scaffold 生成的）内容替换为：

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

- [ ] **Step 5: 添加 npm scripts**

在 `package.json` 的 `"scripts"` 中加入（保留 scaffold 原有的 dev/build/start/lint）：

```json
"seed": "tsx src/scripts/seed.ts",
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: 创建 vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(dir, "src") },
  },
});
```

- [ ] **Step 7: 更新 .gitignore**

在 scaffold 生成的 `.gitignore` 末尾追加：

```
# quiz app
/data/*.db
/data/*.db-*
```

- [ ] **Step 8: 写一个冒烟测试**

创建 `tests/smoke.test.ts`：

```ts
import { describe, expect, it } from "vitest";

describe("vitest setup", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 9: 运行测试与构建验证**

Run: `npm test`
预期：PASS，1 个测试通过。

Run: `npm run build`
预期：构建成功（首页为 scaffold 默认页）。

- [ ] **Step 10: 提交**

```bash
git add -A
git commit -m "chore: 初始化 Next.js 15 脚手架与 Vitest 工具链"
```

---

### Task 2: 数据库层（db.ts + types.ts）

**Files:**
- Create: `src/lib/types.ts`, `src/lib/db.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Produces:
  - `type Topic = "counting" | "shapes" | "patterns" | "logic" | "arithmetic" | "time"`，`TOPICS: Topic[]`
  - `type Difficulty = 3 | 4 | 5`，`DIFFICULTIES: Difficulty[]`
  - `interface Choice { zh: string; en: string }`
  - `interface Question { id: number; difficulty: Difficulty; topic: Topic; text_zh: string; text_en: string; illustration: string | null; choices: Choice[]; correct_index: number; explanation_zh: string; explanation_en: string }`
  - `type RawQuestion = Omit<Question, "id">`
  - `interface SessionRow { id: number; mode: "practice" | "exam"; started_at: number; finished_at: number | null; score: number | null; max_score: number | null; correct_count: number | null; wrong_count: number | null; blank_count: number | null; duration_seconds: number | null }`
  - `interface AnswerRow { id: number; session_id: number; question_id: number; chosen_index: number | null; is_correct: number | null; time_spent_seconds: number | null; created_at: number }`
  - `SCHEMA: string`（建表 SQL）
  - `openDb(dbPath: string): Database.Database` — 打开（或创建）数据库并执行建表
  - `getDb(): Database.Database` — 进程级单例，路径取 `process.env.QUIZ_DB_PATH`，默认 `<cwd>/data/quiz.db`

- [ ] **Step 1: 写失败测试**

创建 `tests/db.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";

describe("openDb", () => {
  it("creates the three tables", () => {
    const db = openDb(":memory:");
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["questions", "sessions", "answers"]));
  });

  it("enforces the difficulty CHECK constraint", () => {
    const db = openDb(":memory:");
    expect(() =>
      db
        .prepare(
          "INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en) VALUES (7, 'counting', 'z', 'e', '[]', 0, 'z', 'e')"
        )
        .run()
    ).toThrow();
  });

  it("inserts and reads a session row", () => {
    const db = openDb(":memory:");
    const info = db
      .prepare("INSERT INTO sessions (mode, started_at) VALUES ('practice', 123)")
      .run();
    const row = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(Number(info.lastInsertRowid)) as { mode: string; started_at: number };
    expect(row.mode).toBe("practice");
    expect(row.started_at).toBe(123);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/db.test.ts`
预期：FAIL，提示找不到模块 `@/lib/db`。

- [ ] **Step 3: 创建 src/lib/types.ts**

```ts
export type Topic = "counting" | "shapes" | "patterns" | "logic" | "arithmetic" | "time";
export const TOPICS: Topic[] = ["counting", "shapes", "patterns", "logic", "arithmetic", "time"];

export type Difficulty = 3 | 4 | 5;
export const DIFFICULTIES: Difficulty[] = [3, 4, 5];

export interface Choice {
  zh: string;
  en: string;
}

export interface Question {
  id: number;
  difficulty: Difficulty;
  topic: Topic;
  text_zh: string;
  text_en: string;
  illustration: string | null;
  choices: Choice[];
  correct_index: number;
  explanation_zh: string;
  explanation_en: string;
}

export type RawQuestion = Omit<Question, "id">;

export interface SessionRow {
  id: number;
  mode: "practice" | "exam";
  started_at: number;
  finished_at: number | null;
  score: number | null;
  max_score: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  blank_count: number | null;
  duration_seconds: number | null;
}

export interface AnswerRow {
  id: number;
  session_id: number;
  question_id: number;
  chosen_index: number | null;
  is_correct: number | null;
  time_spent_seconds: number | null;
  created_at: number;
}
```

- [ ] **Step 4: 创建 src/lib/db.ts**

```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  difficulty INTEGER NOT NULL CHECK (difficulty IN (3, 4, 5)),
  topic TEXT NOT NULL CHECK (topic IN ('counting', 'shapes', 'patterns', 'logic', 'arithmetic', 'time')),
  text_zh TEXT NOT NULL,
  text_en TEXT NOT NULL,
  illustration TEXT,
  choices TEXT NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index IN (0, 1, 2)),
  explanation_zh TEXT NOT NULL,
  explanation_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL CHECK (mode IN ('practice', 'exam')),
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  score INTEGER,
  max_score INTEGER,
  correct_count INTEGER,
  wrong_count INTEGER,
  blank_count INTEGER,
  duration_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  chosen_index INTEGER CHECK (chosen_index IS NULL OR chosen_index IN (0, 1, 2)),
  is_correct INTEGER CHECK (is_correct IS NULL OR is_correct IN (0, 1)),
  time_spent_seconds INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
`;

export function openDb(dbPath: string): Database.Database {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

const globalForDb = globalThis as unknown as { quizDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.quizDb) {
    const dbPath = process.env.QUIZ_DB_PATH ?? path.join(process.cwd(), "data", "quiz.db");
    globalForDb.quizDb = openDb(dbPath);
  }
  return globalForDb.quizDb;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/db.test.ts`
预期：PASS，3 个测试通过。

- [ ] **Step 6: 提交**

```bash
git add src/lib/types.ts src/lib/db.ts tests/db.test.ts
git commit -m "feat: 数据库层 — 三表 schema、openDb/getDb 与类型定义"
```

---

### Task 3: 计分引擎（官方赛制，TDD）

**Files:**
- Create: `src/lib/scoring.ts`, `src/lib/format.ts`
- Test: `tests/scoring.test.ts`, `tests/format.test.ts`

**Interfaces:**
- Produces:
  - `BASE_SCORE = 24`，`EXAM_LENGTH = 24`，`EXAM_MINUTES = 75`，`MAX_SCORE = 120`
  - `interface ScoredAnswer { difficulty: number; chosen: number | null; correctIndex: number }`
  - `interface ExamResult { score: number; maxScore: number; correct: number; wrong: number; blank: number }`
  - `scoreExam(answers: ScoredAnswer[]): ExamResult`
  - `formatClock(totalSeconds: number): string`（`4500 → "75:00"`）
  - `encouragement(score: number, maxScore: number): { zh: string; en: string }`

- [ ] **Step 1: 写失败测试（计分）**

创建 `tests/scoring.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { BASE_SCORE, scoreExam } from "@/lib/scoring";

const block = (difficulty: number, chosen: number | null, correctIndex: number, n: number) =>
  Array.from({ length: n }, () => ({ difficulty, chosen, correctIndex }));

describe("scoreExam", () => {
  it("all correct: 24 + 8*3 + 8*4 + 8*5 = 120", () => {
    const answers = [
      ...block(3, 0, 0, 8),
      ...block(4, 1, 1, 8),
      ...block(5, 2, 2, 8),
    ];
    expect(scoreExam(answers)).toEqual({
      score: 120,
      maxScore: 120,
      correct: 24,
      wrong: 0,
      blank: 0,
    });
  });

  it("all wrong: 24 - 24 = 0", () => {
    const answers = [
      ...block(3, 1, 0, 8),
      ...block(4, 1, 0, 8),
      ...block(5, 1, 0, 8),
    ];
    const r = scoreExam(answers);
    expect(r.score).toBe(0);
    expect(r.wrong).toBe(24);
  });

  it("all blank: stays at base score 24", () => {
    const answers = block(5, null, 0, 24);
    const r = scoreExam(answers);
    expect(r).toEqual({ score: BASE_SCORE, maxScore: 24 + 120, correct: 0, wrong: 0, blank: 24 });
  });

  it("mixed: correct adds difficulty, wrong subtracts 1, blank adds 0", () => {
    const r = scoreExam([
      { difficulty: 3, chosen: 0, correctIndex: 0 },
      { difficulty: 5, chosen: 1, correctIndex: 0 },
      { difficulty: 4, chosen: null, correctIndex: 2 },
    ]);
    expect(r).toEqual({ score: 26, maxScore: 36, correct: 1, wrong: 1, blank: 1 });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/scoring.test.ts`
预期：FAIL，找不到模块 `@/lib/scoring`。

- [ ] **Step 3: 实现 src/lib/scoring.ts**

```ts
export const BASE_SCORE = 24;
export const EXAM_LENGTH = 24;
export const EXAM_MINUTES = 75;
export const MAX_SCORE = 120;

export interface ScoredAnswer {
  difficulty: number;
  chosen: number | null;
  correctIndex: number;
}

export interface ExamResult {
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  blank: number;
}

export function scoreExam(answers: ScoredAnswer[]): ExamResult {
  let score = BASE_SCORE;
  let maxScore = BASE_SCORE;
  let correct = 0;
  let wrong = 0;
  let blank = 0;

  for (const a of answers) {
    maxScore += a.difficulty;
    if (a.chosen === null) {
      blank += 1;
    } else if (a.chosen === a.correctIndex) {
      correct += 1;
      score += a.difficulty;
    } else {
      wrong += 1;
      score -= 1;
    }
  }

  return { score, maxScore, correct, wrong, blank };
}
```

- [ ] **Step 4: 运行计分测试确认通过**

Run: `npx vitest run tests/scoring.test.ts`
预期：PASS，4 个测试通过。

- [ ] **Step 5: 写失败测试（格式化与评语）**

创建 `tests/format.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { encouragement, formatClock } from "@/lib/format";

describe("formatClock", () => {
  it("formats 75 minutes", () => expect(formatClock(4500)).toBe("75:00"));
  it("pads seconds", () => expect(formatClock(59)).toBe("0:59"));
  it("clamps negatives to zero", () => expect(formatClock(-5)).toBe("0:00"));
});

describe("encouragement", () => {
  it("returns 4 distinct bands", () => {
    const top = encouragement(110, 120);
    const high = encouragement(90, 120);
    const mid = encouragement(70, 120);
    const low = encouragement(30, 120);
    const texts = new Set([top.zh, high.zh, mid.zh, low.zh]);
    expect(texts.size).toBe(4);
    expect(top.en.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: 运行测试确认失败**

Run: `npx vitest run tests/format.test.ts`
预期：FAIL，找不到模块 `@/lib/format`。

- [ ] **Step 7: 实现 src/lib/format.ts**

```ts
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function encouragement(score: number, maxScore: number): { zh: string; en: string } {
  const pct = maxScore > 0 ? score / maxScore : 0;
  if (pct >= 0.9) {
    return { zh: "太棒了！你简直是小袋鼠天才！", en: "Amazing! You are a little kangaroo genius!" };
  }
  if (pct >= 0.7) {
    return { zh: "非常厉害！再细心一点就更完美啦！", en: "Great job! A little more care and it will be perfect!" };
  }
  if (pct >= 0.5) {
    return { zh: "不错哦！多练习，下次会更好！", en: "Nice! Keep practicing and you will do even better!" };
  }
  return { zh: "没关系，跳跳陪你多练几次就会啦！", en: "No worries — practice makes progress!" };
}
```

- [ ] **Step 8: 运行全部测试确认通过**

Run: `npx vitest run tests/scoring.test.ts tests/format.test.ts`
预期：全部 PASS。

- [ ] **Step 9: 提交**

```bash
git add src/lib/scoring.ts src/lib/format.ts tests/scoring.test.ts tests/format.test.ts
git commit -m "feat: 官方计分引擎 scoreExam 与格式化/评语工具"
```

---

### Task 4: 题库校验器 + seed 脚本 + 前 27 道题（counting / shapes / patterns）

**Files:**
- Create: `src/lib/validate.ts`, `src/scripts/seed.ts`, `questions/counting.json`, `questions/shapes.json`, `questions/patterns.json`
- Test: `tests/validate.test.ts`, `tests/seed.test.ts`

**Interfaces:**
- Produces:
  - `validateQuestion(q: unknown, label: string): string[]` — 返回该题的错误列表（空 = 合法）
  - `validateBank(raw: unknown[]): RawQuestion[]` — 全部合法则返回规范化后的题目（`illustration` 缺省补 null），否则抛出汇总错误
  - `loadQuestionFiles(dir: string): unknown[]` — 读取目录下所有 `*.json`（按文件名排序）并展平
  - `seedDb(db: Database, questions: RawQuestion[]): number` — 清空三表后写入，返回写入数
  - `runSeed(db: Database, dir?: string): number` — load + validate + seed
  - `QUESTIONS_DIR: string` — `<cwd>/questions`
- 题目 JSON 结构（每题）：`{ difficulty: 3|4|5, topic, text_zh, text_en, illustration?, choices: [{zh,en},{zh,en},{zh,en}], correct_index: 0|1|2, explanation_zh, explanation_en }`

- [ ] **Step 1: 写校验器失败测试**

创建 `tests/validate.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { validateBank, validateQuestion } from "@/lib/validate";

const good = {
  difficulty: 3,
  topic: "counting",
  text_zh: "1 + 1 等于几？",
  text_en: "What is 1 + 1?",
  illustration: null,
  choices: [
    { zh: "1", en: "1" },
    { zh: "2", en: "2" },
    { zh: "3", en: "3" },
  ],
  correct_index: 1,
  explanation_zh: "1 再加 1 就是 2。",
  explanation_en: "One more than 1 is 2.",
};

describe("validateQuestion", () => {
  it("accepts a valid question", () => {
    expect(validateQuestion(good, "q")).toEqual([]);
  });
  it("rejects a bad difficulty", () => {
    const errors = validateQuestion({ ...good, difficulty: 6 }, "q");
    expect(errors.some((e) => e.includes("difficulty"))).toBe(true);
  });
  it("rejects a bad topic", () => {
    const errors = validateQuestion({ ...good, topic: "chess" }, "q");
    expect(errors.some((e) => e.includes("topic"))).toBe(true);
  });
  it("rejects choices that are not exactly 3", () => {
    const errors = validateQuestion({ ...good, choices: good.choices.slice(0, 2) }, "q");
    expect(errors.some((e) => e.includes("choices"))).toBe(true);
  });
  it("rejects a bad correct_index", () => {
    const errors = validateQuestion({ ...good, correct_index: 5 }, "q");
    expect(errors.some((e) => e.includes("correct_index"))).toBe(true);
  });
  it("rejects an empty text field", () => {
    const errors = validateQuestion({ ...good, text_en: "  " }, "q");
    expect(errors.some((e) => e.includes("text_en"))).toBe(true);
  });
  it("allows a missing illustration", () => {
    const { illustration: _drop, ...rest } = good;
    expect(validateQuestion(rest, "q")).toEqual([]);
  });
});

describe("validateBank", () => {
  it("normalizes a missing illustration to null", () => {
    const { illustration: _drop, ...rest } = good;
    const [q] = validateBank([rest]);
    expect(q.illustration).toBeNull();
  });
  it("throws a combined error message", () => {
    expect(() => validateBank([{ ...good, correct_index: 9 }])).toThrow(/correct_index/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/validate.test.ts`
预期：FAIL，找不到模块 `@/lib/validate`。

- [ ] **Step 3: 实现 src/lib/validate.ts**

```ts
import { DIFFICULTIES, TOPICS, type RawQuestion } from "./types";

const TEXT_FIELDS = ["text_zh", "text_en", "explanation_zh", "explanation_en"] as const;

export function validateQuestion(q: unknown, label: string): string[] {
  if (typeof q !== "object" || q === null) return [`${label}: 必须是对象`];
  const obj = q as Record<string, unknown>;
  const errors: string[] = [];

  if (!DIFFICULTIES.includes(obj.difficulty as 3 | 4 | 5)) {
    errors.push(`${label}: difficulty 必须是 3、4 或 5（当前 ${JSON.stringify(obj.difficulty)}）`);
  }
  if (!TOPICS.includes(obj.topic as (typeof TOPICS)[number])) {
    errors.push(`${label}: topic "${String(obj.topic)}" 不在 ${TOPICS.join("|")} 中`);
  }
  for (const f of TEXT_FIELDS) {
    if (typeof obj[f] !== "string" || (obj[f] as string).trim() === "") {
      errors.push(`${label}: ${f} 必须是非空字符串`);
    }
  }
  if (!Array.isArray(obj.choices) || obj.choices.length !== 3) {
    errors.push(`${label}: choices 必须是恰好 3 项的数组`);
  } else {
    (obj.choices as unknown[]).forEach((c, i) => {
      const choice = c as Record<string, unknown> | null;
      if (typeof choice?.zh !== "string" || choice.zh.trim() === "") {
        errors.push(`${label}: choices[${i}].zh 为空`);
      }
      if (typeof choice?.en !== "string" || choice.en.trim() === "") {
        errors.push(`${label}: choices[${i}].en 为空`);
      }
    });
  }
  if (
    typeof obj.correct_index !== "number" ||
    !Number.isInteger(obj.correct_index) ||
    obj.correct_index < 0 ||
    obj.correct_index > 2
  ) {
    errors.push(`${label}: correct_index 必须是 0、1 或 2（当前 ${JSON.stringify(obj.correct_index)}）`);
  }
  if (
    obj.illustration !== null &&
    obj.illustration !== undefined &&
    typeof obj.illustration !== "string"
  ) {
    errors.push(`${label}: illustration 必须是字符串或 null`);
  }
  return errors;
}

export function validateBank(raw: unknown[]): RawQuestion[] {
  const errors = raw.flatMap((q, i) => validateQuestion(q, `question[${i}]`));
  if (errors.length > 0) {
    throw new Error(`题库校验失败：\n${errors.join("\n")}`);
  }
  return raw.map((q) => {
    const obj = q as Omit<RawQuestion, "illustration"> & { illustration?: string | null };
    return { ...obj, illustration: obj.illustration ?? null };
  });
}
```

- [ ] **Step 4: 运行校验器测试确认通过**

Run: `npx vitest run tests/validate.test.ts`
预期：PASS，9 个测试通过。

- [ ] **Step 5: 创建 questions/counting.json（9 道：3×3 分 + 3×4 分 + 3×5 分）**

```json
[
  {
    "difficulty": 3,
    "topic": "counting",
    "text_zh": "桌子上一共有几个苹果？",
    "text_en": "How many apples are on the table?",
    "illustration": "emoji:🍎🍎🍎🍎🍎",
    "choices": [
      { "zh": "4 个", "en": "4" },
      { "zh": "5 个", "en": "5" },
      { "zh": "6 个", "en": "6" }
    ],
    "correct_index": 1,
    "explanation_zh": "一个一个数：1、2、3、4、5，一共 5 个苹果。",
    "explanation_en": "Count one by one: 1, 2, 3, 4, 5. There are 5 apples."
  },
  {
    "difficulty": 3,
    "topic": "counting",
    "text_zh": "每只小鸡有 2 条腿。3 只小鸡一共有几条腿？",
    "text_en": "Each chick has 2 legs. How many legs do 3 chicks have altogether?",
    "illustration": "emoji:🐔🐔🐔",
    "choices": [
      { "zh": "6 条", "en": "6" },
      { "zh": "8 条", "en": "8" },
      { "zh": "10 条", "en": "10" }
    ],
    "correct_index": 0,
    "explanation_zh": "2 + 2 + 2 = 6，一共 6 条腿。",
    "explanation_en": "2 + 2 + 2 = 6 legs."
  },
  {
    "difficulty": 3,
    "topic": "counting",
    "text_zh": "一双手一共有几根手指？",
    "text_en": "How many fingers do two hands have?",
    "illustration": "emoji:🖐️🖐️",
    "choices": [
      { "zh": "8 根", "en": "8" },
      { "zh": "12 根", "en": "12" },
      { "zh": "10 根", "en": "10" }
    ],
    "correct_index": 2,
    "explanation_zh": "一只手 5 根，5 + 5 = 10 根。",
    "explanation_en": "Each hand has 5 fingers, so 5 + 5 = 10."
  },
  {
    "difficulty": 4,
    "topic": "counting",
    "text_zh": "一辆自行车有 2 个轮子。4 辆自行车一共有几个轮子？",
    "text_en": "A bicycle has 2 wheels. How many wheels do 4 bicycles have?",
    "illustration": "emoji:🚲🚲🚲🚲",
    "choices": [
      { "zh": "6 个", "en": "6" },
      { "zh": "12 个", "en": "12" },
      { "zh": "8 个", "en": "8" }
    ],
    "correct_index": 2,
    "explanation_zh": "2 + 2 + 2 + 2 = 8 个轮子。",
    "explanation_en": "2 + 2 + 2 + 2 = 8 wheels."
  },
  {
    "difficulty": 4,
    "topic": "counting",
    "text_zh": "1 只蜘蛛有 8 条腿，1 只小鸡有 2 条腿。2 只蜘蛛和 1 只小鸡一共有几条腿？",
    "text_en": "A spider has 8 legs and a chick has 2 legs. How many legs do 2 spiders and 1 chick have altogether?",
    "illustration": "emoji:🕷️🕷️🐔",
    "choices": [
      { "zh": "18 条", "en": "18" },
      { "zh": "20 条", "en": "20" },
      { "zh": "16 条", "en": "16" }
    ],
    "correct_index": 0,
    "explanation_zh": "蜘蛛：8 + 8 = 16 条，再加小鸡的 2 条：16 + 2 = 18 条。",
    "explanation_en": "Spiders: 8 + 8 = 16 legs; plus the chick's 2 legs: 16 + 2 = 18."
  },
  {
    "difficulty": 4,
    "topic": "counting",
    "text_zh": "下面的图形里一共有几个三角形？",
    "text_en": "How many triangles can you see?",
    "illustration": "emoji:🔺🟦🔺🟡🔺",
    "choices": [
      { "zh": "2 个", "en": "2" },
      { "zh": "4 个", "en": "4" },
      { "zh": "3 个", "en": "3" }
    ],
    "correct_index": 2,
    "explanation_zh": "红色的 🔺 是三角形，一个一个数：1、2、3，共 3 个。",
    "explanation_en": "The red triangles: count them one by one — there are 3."
  },
  {
    "difficulty": 5,
    "topic": "counting",
    "text_zh": "小朋友们排成一队。从前面数小明排第 4，从后面数他排第 3。这一队一共有几个人？",
    "text_en": "Children stand in a line. Counting from the front, Ming is 4th. Counting from the back, he is 3rd. How many children are in the line?",
    "choices": [
      { "zh": "6 个", "en": "6" },
      { "zh": "7 个", "en": "7" },
      { "zh": "5 个", "en": "5" }
    ],
    "correct_index": 0,
    "explanation_zh": "小明被数了两次，所以 4 + 3 − 1 = 6 个人。",
    "explanation_en": "Ming is counted twice, so 4 + 3 − 1 = 6 children."
  },
  {
    "difficulty": 5,
    "topic": "counting",
    "text_zh": "小狗和小猫都有 4 条腿。图中的动物一共有几条腿？",
    "text_en": "Dogs and cats each have 4 legs. How many legs do all the animals in the picture have?",
    "illustration": "emoji:🐶🐶🐶🐱🐱",
    "choices": [
      { "zh": "20 条", "en": "20" },
      { "zh": "16 条", "en": "16" },
      { "zh": "24 条", "en": "24" }
    ],
    "correct_index": 0,
    "explanation_zh": "3 只小狗 12 条腿，2 只小猫 8 条腿：12 + 8 = 20 条。",
    "explanation_en": "3 dogs give 12 legs and 2 cats give 8 legs: 12 + 8 = 20."
  },
  {
    "difficulty": 5,
    "topic": "counting",
    "text_zh": "10 个小朋友玩捉迷藏，其中 1 个人负责找。已经找到了 3 个躲起来的人，还有几个没被找到？",
    "text_en": "10 children play hide-and-seek and 1 is the seeker. 3 hiders have been found. How many are still hiding?",
    "choices": [
      { "zh": "7 个", "en": "7" },
      { "zh": "6 个", "en": "6" },
      { "zh": "5 个", "en": "5" }
    ],
    "correct_index": 1,
    "explanation_zh": "躲起来的有 10 − 1 = 9 人，减去找到的 3 人：9 − 3 = 6 个。",
    "explanation_en": "There are 10 − 1 = 9 hiders; 9 − 3 = 6 are still hiding."
  }
]
```

- [ ] **Step 6: 创建 questions/shapes.json（9 道）**

```json
[
  {
    "difficulty": 3,
    "topic": "shapes",
    "text_zh": "下面哪一个是圆形？",
    "text_en": "Which one is a circle?",
    "choices": [
      { "zh": "🔺 三角形", "en": "🔺 triangle" },
      { "zh": "⭕ 圆形", "en": "⭕ circle" },
      { "zh": "🟦 正方形", "en": "🟦 square" }
    ],
    "correct_index": 1,
    "explanation_zh": "圆形圆圆的，没有角。",
    "explanation_en": "A circle is round and has no corners."
  },
  {
    "difficulty": 3,
    "topic": "shapes",
    "text_zh": "正方形有几个角？",
    "text_en": "How many corners does a square have?",
    "choices": [
      { "zh": "3 个", "en": "3" },
      { "zh": "5 个", "en": "5" },
      { "zh": "4 个", "en": "4" }
    ],
    "correct_index": 2,
    "explanation_zh": "正方形有四条边、四个角。",
    "explanation_en": "A square has four sides and four corners."
  },
  {
    "difficulty": 3,
    "topic": "shapes",
    "text_zh": "哪一个物体的形状像球？",
    "text_en": "Which object is shaped like a ball?",
    "choices": [
      { "zh": "📦 纸箱", "en": "📦 box" },
      { "zh": "⚽ 足球", "en": "⚽ football" },
      { "zh": "📖 书本", "en": "📖 book" }
    ],
    "correct_index": 1,
    "explanation_zh": "足球圆圆的，形状像球；纸箱和书本是方的。",
    "explanation_en": "A football is round like a ball; the box and book are flat and square."
  },
  {
    "difficulty": 4,
    "topic": "shapes",
    "text_zh": "把一张正方形的纸对折一次，不可能得到下面哪个形状？",
    "text_en": "You fold a square piece of paper in half once. Which shape can you NOT get?",
    "choices": [
      { "zh": "长方形", "en": "rectangle" },
      { "zh": "圆形", "en": "circle" },
      { "zh": "三角形", "en": "triangle" }
    ],
    "correct_index": 1,
    "explanation_zh": "对折可以得到长方形（边对边折）或三角形（角对角折），但折不出圆形。",
    "explanation_en": "Folding can make a rectangle or a triangle, but never a circle."
  },
  {
    "difficulty": 4,
    "topic": "shapes",
    "text_zh": "字母 b 照镜子，镜子里看到的是哪个字母？",
    "text_en": "The letter b looks in a mirror. Which letter do you see?",
    "choices": [
      { "zh": "b", "en": "b" },
      { "zh": "d", "en": "d" },
      { "zh": "p", "en": "p" }
    ],
    "correct_index": 1,
    "explanation_zh": "镜子把左右反过来，b 的圆圈到了右边，变成 d。",
    "explanation_en": "The mirror swaps left and right, so b becomes d."
  },
  {
    "difficulty": 4,
    "topic": "shapes",
    "text_zh": "图中一共有几个三角形？",
    "text_en": "How many triangles are in the picture?",
    "illustration": "svg:diagsquare",
    "choices": [
      { "zh": "2 个", "en": "2" },
      { "zh": "1 个", "en": "1" },
      { "zh": "3 个", "en": "3" }
    ],
    "correct_index": 0,
    "explanation_zh": "一条对角线把正方形分成了 2 个三角形。",
    "explanation_en": "The diagonal cuts the square into 2 triangles."
  },
  {
    "difficulty": 5,
    "topic": "shapes",
    "text_zh": "用小棒摆三角形，小棒可以共用。摆出 2 个三角形最少要几根小棒？",
    "text_en": "You make triangles from sticks. Sticks may be shared. What is the fewest sticks needed to make 2 triangles?",
    "choices": [
      { "zh": "5 根", "en": "5" },
      { "zh": "6 根", "en": "6" },
      { "zh": "4 根", "en": "4" }
    ],
    "correct_index": 0,
    "explanation_zh": "分开摆要 3 + 3 = 6 根；让两个三角形共用 1 根小棒，省下 1 根：6 − 1 = 5 根。",
    "explanation_en": "Separate triangles need 3 + 3 = 6 sticks; sharing one stick saves one: 6 − 1 = 5."
  },
  {
    "difficulty": 5,
    "topic": "shapes",
    "text_zh": "一个圆蛋糕，切 2 刀（每刀都是直线），最多能切成几块？",
    "text_en": "You cut a round cake with 2 straight cuts. What is the largest number of pieces you can get?",
    "choices": [
      { "zh": "3 块", "en": "3" },
      { "zh": "5 块", "en": "5" },
      { "zh": "4 块", "en": "4" }
    ],
    "correct_index": 2,
    "explanation_zh": "让两刀交叉（像十字），就能切成 4 块。",
    "explanation_en": "Let the two cuts cross like a plus sign and you get 4 pieces."
  },
  {
    "difficulty": 5,
    "topic": "shapes",
    "text_zh": "图中的大正方形被分成了小方格。一共有几个正方形？（要把大正方形也算进去）",
    "text_en": "The big square is split into small squares. How many squares are there in total, including the big one?",
    "illustration": "svg:grid",
    "choices": [
      { "zh": "4 个", "en": "4" },
      { "zh": "5 个", "en": "5" },
      { "zh": "6 个", "en": "6" }
    ],
    "correct_index": 1,
    "explanation_zh": "4 个小正方形 + 1 个大正方形 = 5 个。",
    "explanation_en": "4 small squares + 1 large square = 5 squares."
  }
]
```

- [ ] **Step 7: 创建 questions/patterns.json（9 道）**

```json
[
  {
    "difficulty": 3,
    "topic": "patterns",
    "text_zh": "按规律，问号处应该是什么？",
    "text_en": "What comes next?",
    "illustration": "emoji:🔴🔵🔴🔵🔴❓",
    "choices": [
      { "zh": "🔴", "en": "🔴" },
      { "zh": "🟢", "en": "🟢" },
      { "zh": "🔵", "en": "🔵" }
    ],
    "correct_index": 2,
    "explanation_zh": "红、蓝、红、蓝轮流出现，红色后面该轮到蓝色。",
    "explanation_en": "Red and blue alternate — after red comes blue."
  },
  {
    "difficulty": 3,
    "topic": "patterns",
    "text_zh": "1，2，3，4，❓ 下一个数是几？",
    "text_en": "1, 2, 3, 4, ❓ What comes next?",
    "choices": [
      { "zh": "6", "en": "6" },
      { "zh": "5", "en": "5" },
      { "zh": "4", "en": "4" }
    ],
    "correct_index": 1,
    "explanation_zh": "每次多 1，4 后面是 5。",
    "explanation_en": "The numbers go up by one: next is 5."
  },
  {
    "difficulty": 3,
    "topic": "patterns",
    "text_zh": "按规律，问号处应该是什么？",
    "text_en": "What comes next?",
    "illustration": "emoji:🌙⭐⭐🌙⭐⭐🌙❓",
    "choices": [
      { "zh": "🌙", "en": "🌙" },
      { "zh": "☀️", "en": "☀️" },
      { "zh": "⭐", "en": "⭐" }
    ],
    "correct_index": 2,
    "explanation_zh": "「月亮、星星、星星」一组重复出现，月亮后面是星星。",
    "explanation_en": "The group moon-star-star repeats — a star comes after the moon."
  },
  {
    "difficulty": 4,
    "topic": "patterns",
    "text_zh": "2，4，6，8，❓ 下一个数是几？",
    "text_en": "2, 4, 6, 8, ❓ What comes next?",
    "choices": [
      { "zh": "10", "en": "10" },
      { "zh": "9", "en": "9" },
      { "zh": "12", "en": "12" }
    ],
    "correct_index": 0,
    "explanation_zh": "每次多 2：8 + 2 = 10。",
    "explanation_en": "It goes up by 2 each time: 8 + 2 = 10."
  },
  {
    "difficulty": 4,
    "topic": "patterns",
    "text_zh": "按规律，问号处应该是什么？",
    "text_en": "What comes next?",
    "illustration": "emoji:🔺🔺🔵🔺🔺🔵🔺❓",
    "choices": [
      { "zh": "🔵", "en": "🔵" },
      { "zh": "🔺", "en": "🔺" },
      { "zh": "🟩", "en": "🟩" }
    ],
    "correct_index": 1,
    "explanation_zh": "「三角形、三角形、圆形」一组重复，问号是一组里的第 2 个，所以是三角形。",
    "explanation_en": "The group triangle-triangle-circle repeats — the next item is a triangle."
  },
  {
    "difficulty": 4,
    "topic": "patterns",
    "text_zh": "1，3，5，7，❓ 下一个数是几？",
    "text_en": "1, 3, 5, 7, ❓ What comes next?",
    "choices": [
      { "zh": "8", "en": "8" },
      { "zh": "11", "en": "11" },
      { "zh": "9", "en": "9" }
    ],
    "correct_index": 2,
    "explanation_zh": "这是单数（奇数），每次多 2：7 + 2 = 9。",
    "explanation_en": "Odd numbers go up by 2: 7 + 2 = 9."
  },
  {
    "difficulty": 5,
    "topic": "patterns",
    "text_zh": "1，2，4，7，11，❓ 下一个数是几？",
    "text_en": "1, 2, 4, 7, 11, ❓ What comes next?",
    "choices": [
      { "zh": "16", "en": "16" },
      { "zh": "15", "en": "15" },
      { "zh": "17", "en": "17" }
    ],
    "correct_index": 0,
    "explanation_zh": "增加的数依次是 1、2、3、4，下一次加 5：11 + 5 = 16。",
    "explanation_en": "The steps grow 1, 2, 3, 4 — so the next step is +5: 11 + 5 = 16."
  },
  {
    "difficulty": 5,
    "topic": "patterns",
    "text_zh": "按规律，问号处应该是什么？",
    "text_en": "What comes next?",
    "illustration": "emoji:🐸🐸🐱🐸🐸🐱🐸🐸❓",
    "choices": [
      { "zh": "🐱", "en": "🐱" },
      { "zh": "🐶", "en": "🐶" },
      { "zh": "🐸", "en": "🐸" }
    ],
    "correct_index": 0,
    "explanation_zh": "「青蛙、青蛙、小猫」一组重复，两只青蛙后面该是小猫。",
    "explanation_en": "The group frog-frog-cat repeats — next is a cat."
  },
  {
    "difficulty": 5,
    "topic": "patterns",
    "text_zh": "10，9，8，7，❓ 下一个数是几？",
    "text_en": "10, 9, 8, 7, ❓ What comes next?",
    "choices": [
      { "zh": "5", "en": "5" },
      { "zh": "6", "en": "6" },
      { "zh": "8", "en": "8" }
    ],
    "correct_index": 1,
    "explanation_zh": "倒着数，每次少 1：7 − 1 = 6。",
    "explanation_en": "Counting down by 1: 7 − 1 = 6."
  }
]
```

- [ ] **Step 8: 实现 src/scripts/seed.ts**

```ts
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Database } from "better-sqlite3";
import { openDb } from "../lib/db";
import { validateBank } from "../lib/validate";
import type { RawQuestion } from "../lib/types";

export const QUESTIONS_DIR = path.join(process.cwd(), "questions");

export function loadQuestionFiles(dir: string): unknown[] {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) throw new Error(`questions 目录中没有 JSON 文件: ${dir}`);
  return files.flatMap((f) => {
    const data: unknown = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
    if (!Array.isArray(data)) throw new Error(`${f} 的顶层必须是数组`);
    return data;
  });
}

export function seedDb(db: Database, questions: RawQuestion[]): number {
  const insert = db.prepare(`
    INSERT INTO questions (difficulty, topic, text_zh, text_en, illustration, choices, correct_index, explanation_zh, explanation_en)
    VALUES (@difficulty, @topic, @text_zh, @text_en, @illustration, @choices, @correct_index, @explanation_zh, @explanation_en)
  `);
  const tx = db.transaction((rows: RawQuestion[]) => {
    db.prepare("DELETE FROM answers").run();
    db.prepare("DELETE FROM sessions").run();
    db.prepare("DELETE FROM questions").run();
    for (const q of rows) {
      insert.run({
        difficulty: q.difficulty,
        topic: q.topic,
        text_zh: q.text_zh,
        text_en: q.text_en,
        illustration: q.illustration,
        choices: JSON.stringify(q.choices),
        correct_index: q.correct_index,
        explanation_zh: q.explanation_zh,
        explanation_en: q.explanation_en,
      });
    }
  });
  tx(questions);
  return questions.length;
}

export function runSeed(db: Database, dir: string = QUESTIONS_DIR): number {
  const raw = loadQuestionFiles(dir);
  const valid = validateBank(raw);
  return seedDb(db, valid);
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  const dbPath = process.env.QUIZ_DB_PATH ?? path.join(process.cwd(), "data", "quiz.db");
  const db = openDb(dbPath);
  const count = runSeed(db);
  console.log(`⚠️  重新 seed 会清空历史作答记录。已导入 ${count} 道题目 → ${dbPath}`);
}
```

- [ ] **Step 9: 写 seed 测试**

创建 `tests/seed.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { runSeed } from "@/scripts/seed";

describe("runSeed", () => {
  it("seeds 27 questions, 9 per difficulty", () => {
    const db = openDb(":memory:");
    const n = runSeed(db);
    expect(n).toBe(27);
    const per = db
      .prepare("SELECT difficulty, COUNT(*) AS n FROM questions GROUP BY difficulty ORDER BY difficulty")
      .all() as { difficulty: number; n: number }[];
    expect(per).toEqual([
      { difficulty: 3, n: 9 },
      { difficulty: 4, n: 9 },
      { difficulty: 5, n: 9 },
    ]);
  });

  it("stores choices as JSON with exactly 3 items", () => {
    const db = openDb(":memory:");
    runSeed(db);
    const row = db.prepare("SELECT choices FROM questions LIMIT 1").get() as { choices: string };
    const choices = JSON.parse(row.choices) as { zh: string; en: string }[];
    expect(choices).toHaveLength(3);
    expect(typeof choices[0].zh).toBe("string");
    expect(typeof choices[0].en).toBe("string");
  });
});
```

- [ ] **Step 10: 运行 seed 测试确认通过**

Run: `npx vitest run tests/seed.test.ts`
预期：PASS，2 个测试通过。

- [ ] **Step 11: 执行真实 seed 生成开发数据库**

Run: `npm run seed`
预期：输出 `已导入 27 道题目 → /home/xsq/quiz/data/quiz.db`，生成 `data/quiz.db`。

- [ ] **Step 12: 提交**

```bash
git add src/lib/validate.ts src/scripts/seed.ts questions/ tests/validate.test.ts tests/seed.test.ts
git commit -m "feat: 题库校验与 seed 脚本，导入 counting/shapes/patterns 共 27 道双语题"
```

---

### Task 5: 补齐其余 27 道题（logic / arithmetic / time）

**Files:**
- Create: `questions/logic.json`, `questions/arithmetic.json`, `questions/time.json`
- Modify: `tests/seed.test.ts`（数量 27 → 54，并校验主题分布）

**Interfaces:**
- Consumes: Task 4 的 `runSeed`
- Produces: 完整题库 54 题（每主题 9 题；3/4/5 分各 18 题），满足考试 8/8/8 抽题需求

- [ ] **Step 1: 创建 questions/logic.json（9 道）**

```json
[
  {
    "difficulty": 3,
    "topic": "logic",
    "text_zh": "小红比小明高，小明比小刚高。他们三个谁最矮？",
    "text_en": "Hong is taller than Ming, and Ming is taller than Gang. Who is the shortest?",
    "choices": [
      { "zh": "小刚", "en": "Gang" },
      { "zh": "小红", "en": "Hong" },
      { "zh": "小明", "en": "Ming" }
    ],
    "correct_index": 0,
    "explanation_zh": "从高到矮排：小红 > 小明 > 小刚，所以小刚最矮。",
    "explanation_en": "From tall to short: Hong > Ming > Gang, so Gang is the shortest."
  },
  {
    "difficulty": 3,
    "topic": "logic",
    "text_zh": "盒子里只有红球和蓝球。闭眼摸出一个，不是红球，那它一定是？",
    "text_en": "A box holds only red and blue balls. You pick one without looking. It is not red. What must it be?",
    "choices": [
      { "zh": "蓝球", "en": "a blue ball" },
      { "zh": "红球", "en": "a red ball" },
      { "zh": "黄球", "en": "a yellow ball" }
    ],
    "correct_index": 0,
    "explanation_zh": "盒子里只有红、蓝两种球，不是红球就只能是蓝球。",
    "explanation_en": "The box has only red and blue balls — not red means it must be blue."
  },
  {
    "difficulty": 3,
    "topic": "logic",
    "text_zh": "小猫在小狗的左边，小鸡在小狗的右边。谁站在中间？",
    "text_en": "The cat is on the dog's left, and the chick is on the dog's right. Who stands in the middle?",
    "choices": [
      { "zh": "小猫", "en": "the cat" },
      { "zh": "小狗", "en": "the dog" },
      { "zh": "小鸡", "en": "the chick" }
    ],
    "correct_index": 1,
    "explanation_zh": "从左到右是：小猫、小狗、小鸡，小狗在中间。",
    "explanation_en": "Left to right: cat, dog, chick — the dog is in the middle."
  },
  {
    "difficulty": 4,
    "topic": "logic",
    "text_zh": "四个小朋友比高矮：小云比小风高；小星比小云矮，但比小风高；小月最矮。谁第二高？",
    "text_en": "Four children compare heights: Yun is taller than Feng; Xing is shorter than Yun but taller than Feng; Yue is the shortest. Who is the second tallest?",
    "choices": [
      { "zh": "小星", "en": "Xing" },
      { "zh": "小云", "en": "Yun" },
      { "zh": "小风", "en": "Feng" }
    ],
    "correct_index": 0,
    "explanation_zh": "从高到矮排：小云 > 小星 > 小风 > 小月，第二高是小星。",
    "explanation_en": "Tall to short: Yun > Xing > Feng > Yue, so Xing is second tallest."
  },
  {
    "difficulty": 4,
    "topic": "logic",
    "text_zh": "小明排队买冰淇淋，他前面有 3 个人，后面有 2 个人。这一队一共有几个人？",
    "text_en": "Ming is in a line. There are 3 people in front of him and 2 behind him. How many people are in the line?",
    "choices": [
      { "zh": "5 个", "en": "5" },
      { "zh": "6 个", "en": "6" },
      { "zh": "7 个", "en": "7" }
    ],
    "correct_index": 1,
    "explanation_zh": "前面的 3 人 + 小明自己 + 后面的 2 人 = 6 人。别忘了数小明自己！",
    "explanation_en": "3 in front + Ming himself + 2 behind = 6. Do not forget Ming!"
  },
  {
    "difficulty": 4,
    "topic": "logic",
    "text_zh": "哥哥和弟弟一共有 10 颗糖，哥哥比弟弟多 2 颗。哥哥有几颗糖？",
    "text_en": "Two brothers have 10 candies altogether. The older brother has 2 more than the younger one. How many candies does the older brother have?",
    "choices": [
      { "zh": "6 颗", "en": "6" },
      { "zh": "5 颗", "en": "5" },
      { "zh": "7 颗", "en": "7" }
    ],
    "correct_index": 0,
    "explanation_zh": "先去掉多出的 2 颗：10 − 2 = 8，两人就一样多，各 4 颗；哥哥再加回 2 颗：4 + 2 = 6 颗。",
    "explanation_en": "Remove the extra 2: 10 − 2 = 8, so each has 4; the older brother gets his 2 back: 4 + 2 = 6."
  },
  {
    "difficulty": 5,
    "topic": "logic",
    "text_zh": "一块蛋糕被一个孩子偷吃了。小甲说：“我没吃。”小乙说：“是小甲吃的。”小丙说：“我没吃。”三个人里只有一个说了真话。谁偷吃了蛋糕？",
    "text_en": "A child secretly ate a cake. Jia says: I did not eat it. Yi says: Jia ate it. Bing says: I did not eat it. Only one of them tells the truth. Who ate the cake?",
    "choices": [
      { "zh": "小丙", "en": "Bing" },
      { "zh": "小甲", "en": "Jia" },
      { "zh": "小乙", "en": "Yi" }
    ],
    "correct_index": 0,
    "explanation_zh": "小甲和小乙的话正好相反，一定是一真一假。唯一的真话在他俩之中，所以小丙说的是假话——“我没吃”是假的，蛋糕是小丙吃的。",
    "explanation_en": "Jia and Yi contradict each other, so exactly one of them is true. The only truth is between them, so Bing lies — Bing ate the cake."
  },
  {
    "difficulty": 5,
    "topic": "logic",
    "text_zh": "小华有 3 件上衣和 2 条裤子。一件上衣配一条裤子，一共有多少种不同的穿法？",
    "text_en": "Hua has 3 shirts and 2 pairs of pants. One shirt with one pair of pants makes an outfit. How many different outfits are possible?",
    "choices": [
      { "zh": "5 种", "en": "5" },
      { "zh": "9 种", "en": "9" },
      { "zh": "6 种", "en": "6" }
    ],
    "correct_index": 2,
    "explanation_zh": "每件上衣都能配 2 条裤子：3 × 2 = 6 种。",
    "explanation_en": "Each of the 3 shirts pairs with 2 pants: 3 × 2 = 6 outfits."
  },
  {
    "difficulty": 5,
    "topic": "logic",
    "text_zh": "四个小朋友赛跑。小A不是第一名也不是最后一名；小B比小A晚到达；小C是第二名。谁是第一名？",
    "text_en": "Four children race. A is neither first nor last; B finishes after A; C is second. Who is first?",
    "choices": [
      { "zh": "小D", "en": "D" },
      { "zh": "小A", "en": "A" },
      { "zh": "小B", "en": "B" }
    ],
    "correct_index": 0,
    "explanation_zh": "小C第二；小A不是第一也不是第四，只能是第三；小B比小A晚，是第四；剩下小D是第一。",
    "explanation_en": "C is 2nd. A is not 1st or 4th, so A is 3rd. B is after A, so B is 4th. That leaves D in 1st."
  }
]
```

- [ ] **Step 2: 创建 questions/arithmetic.json（9 道）**

```json
[
  {
    "difficulty": 3,
    "topic": "arithmetic",
    "text_zh": "3 + 4 = ？",
    "text_en": "3 + 4 = ?",
    "choices": [
      { "zh": "7", "en": "7" },
      { "zh": "6", "en": "6" },
      { "zh": "8", "en": "8" }
    ],
    "correct_index": 0,
    "explanation_zh": "从 3 往后数 4 个数：4、5、6、7，所以 3 + 4 = 7。",
    "explanation_en": "Count on 4 from 3: 4, 5, 6, 7. So 3 + 4 = 7."
  },
  {
    "difficulty": 3,
    "topic": "arithmetic",
    "text_zh": "你有 5 颗糖，吃掉了 2 颗，还剩几颗？",
    "text_en": "You have 5 candies and eat 2. How many are left?",
    "illustration": "emoji:🍬🍬🍬🍬🍬",
    "choices": [
      { "zh": "2 颗", "en": "2" },
      { "zh": "4 颗", "en": "4" },
      { "zh": "3 颗", "en": "3" }
    ],
    "correct_index": 2,
    "explanation_zh": "5 − 2 = 3，还剩 3 颗。",
    "explanation_en": "5 − 2 = 3 candies left."
  },
  {
    "difficulty": 3,
    "topic": "arithmetic",
    "text_zh": "5 + 5 = ？",
    "text_en": "5 + 5 = ?",
    "choices": [
      { "zh": "9", "en": "9" },
      { "zh": "11", "en": "11" },
      { "zh": "10", "en": "10" }
    ],
    "correct_index": 2,
    "explanation_zh": "一只手 5 根手指，两只手合起来就是 10。",
    "explanation_en": "5 fingers on each hand — two hands make 10."
  },
  {
    "difficulty": 4,
    "topic": "arithmetic",
    "text_zh": "一支铅笔 2 元钱，买 3 支要几元钱？",
    "text_en": "One pencil costs 2 yuan. How much do 3 pencils cost?",
    "choices": [
      { "zh": "5 元", "en": "5 yuan" },
      { "zh": "6 元", "en": "6 yuan" },
      { "zh": "8 元", "en": "8 yuan" }
    ],
    "correct_index": 1,
    "explanation_zh": "2 + 2 + 2 = 6 元。",
    "explanation_en": "2 + 2 + 2 = 6 yuan."
  },
  {
    "difficulty": 4,
    "topic": "arithmetic",
    "text_zh": "12 块饼干平均分给 3 个小朋友，每人能分到几块？",
    "text_en": "12 cookies are shared equally among 3 children. How many does each child get?",
    "choices": [
      { "zh": "3 块", "en": "3" },
      { "zh": "4 块", "en": "4" },
      { "zh": "6 块", "en": "6" }
    ],
    "correct_index": 1,
    "explanation_zh": "12 ÷ 3 = 4，每人 4 块（4 + 4 + 4 = 12）。",
    "explanation_en": "12 ÷ 3 = 4 (because 4 + 4 + 4 = 12)."
  },
  {
    "difficulty": 4,
    "topic": "arithmetic",
    "text_zh": "小明有 10 元钱，买冰淇淋花了 4 元，妈妈又给了他 2 元。他现在有几元钱？",
    "text_en": "Ming has 10 yuan. He spends 4 yuan on ice cream, then his mum gives him 2 yuan. How much does he have now?",
    "choices": [
      { "zh": "8 元", "en": "8 yuan" },
      { "zh": "6 元", "en": "6 yuan" },
      { "zh": "12 元", "en": "12 yuan" }
    ],
    "correct_index": 0,
    "explanation_zh": "先花掉：10 − 4 = 6；再得到：6 + 2 = 8 元。",
    "explanation_en": "Spend first: 10 − 4 = 6; then receive: 6 + 2 = 8 yuan."
  },
  {
    "difficulty": 5,
    "topic": "arithmetic",
    "text_zh": "一本笔记本 5 元钱。下面哪种付钱方法正好是 5 元？",
    "text_en": "A notebook costs 5 yuan. Which way of paying is exactly 5 yuan?",
    "choices": [
      { "zh": "1 张 5 元", "en": "one 5-yuan note" },
      { "zh": "2 张 2 元", "en": "two 2-yuan notes" },
      { "zh": "5 张 2 元", "en": "five 2-yuan notes" }
    ],
    "correct_index": 0,
    "explanation_zh": "1 张 5 元正好是 5 元；2 张 2 元是 4 元（不够）；5 张 2 元是 10 元（太多）。",
    "explanation_en": "One 5-yuan note is exactly 5; two 2s make 4 (too little); five 2s make 10 (too much)."
  },
  {
    "difficulty": 5,
    "topic": "arithmetic",
    "text_zh": "公交车上原来有 8 人，到站后下去 3 人，又上来 5 人。现在车上有几人？",
    "text_en": "A bus has 8 people. At a stop, 3 get off and 5 get on. How many people are on the bus now?",
    "choices": [
      { "zh": "8 人", "en": "8" },
      { "zh": "13 人", "en": "13" },
      { "zh": "10 人", "en": "10" }
    ],
    "correct_index": 2,
    "explanation_zh": "8 − 3 + 5 = 10 人。",
    "explanation_en": "8 − 3 + 5 = 10 people."
  },
  {
    "difficulty": 5,
    "topic": "arithmetic",
    "text_zh": "姐姐今年 7 岁，妹妹 4 岁。等姐姐 10 岁的时候，妹妹几岁？",
    "text_en": "The older sister is 7 and the younger one is 4. When the older sister is 10, how old will the younger one be?",
    "choices": [
      { "zh": "7 岁", "en": "7" },
      { "zh": "6 岁", "en": "6" },
      { "zh": "8 岁", "en": "8" }
    ],
    "correct_index": 0,
    "explanation_zh": "姐妹相差 7 − 4 = 3 岁，年龄差永远不变。姐姐 10 岁时，妹妹是 10 − 3 = 7 岁。",
    "explanation_en": "The age gap is 7 − 4 = 3 years and never changes. When the sister is 10, the younger one is 10 − 3 = 7."
  }
]
```

- [ ] **Step 3: 创建 questions/time.json（9 道）**

```json
[
  {
    "difficulty": 3,
    "topic": "time",
    "text_zh": "钟面上现在是几点？",
    "text_en": "What time does the clock show?",
    "illustration": "svg:clock:3:00",
    "choices": [
      { "zh": "3 点", "en": "3 o'clock" },
      { "zh": "6 点", "en": "6 o'clock" },
      { "zh": "12 点", "en": "12 o'clock" }
    ],
    "correct_index": 0,
    "explanation_zh": "短短时针指着 3，长长分针指着 12，所以是 3 点整。",
    "explanation_en": "The short hand points to 3 and the long hand points to 12 — it is 3 o'clock."
  },
  {
    "difficulty": 3,
    "topic": "time",
    "text_zh": "一个星期有几天？",
    "text_en": "How many days are there in a week?",
    "choices": [
      { "zh": "5 天", "en": "5" },
      { "zh": "7 天", "en": "7" },
      { "zh": "10 天", "en": "10" }
    ],
    "correct_index": 1,
    "explanation_zh": "星期一、二、三、四、五、六、日，一共 7 天。",
    "explanation_en": "Monday through Sunday — 7 days."
  },
  {
    "difficulty": 3,
    "topic": "time",
    "text_zh": "今天是星期一，明天是星期几？",
    "text_en": "Today is Monday. What day is tomorrow?",
    "choices": [
      { "zh": "星期二", "en": "Tuesday" },
      { "zh": "星期日", "en": "Sunday" },
      { "zh": "星期三", "en": "Wednesday" }
    ],
    "correct_index": 0,
    "explanation_zh": "星期一的后面一天是星期二。",
    "explanation_en": "The day after Monday is Tuesday."
  },
  {
    "difficulty": 4,
    "topic": "time",
    "text_zh": "钟面上现在是几点？",
    "text_en": "What time does the clock show?",
    "illustration": "svg:clock:6:30",
    "choices": [
      { "zh": "6 点半", "en": "half past 6" },
      { "zh": "6 点", "en": "6 o'clock" },
      { "zh": "7 点", "en": "7 o'clock" }
    ],
    "correct_index": 0,
    "explanation_zh": "分针指着 6（走了半圈），时针在 6 和 7 中间，所以是 6 点半。",
    "explanation_en": "The minute hand points to 6 (half way round) and the hour hand is between 6 and 7 — half past 6."
  },
  {
    "difficulty": 4,
    "topic": "time",
    "text_zh": "一节课 40 分钟，两节课一共有多少分钟？",
    "text_en": "One lesson lasts 40 minutes. How many minutes do two lessons last?",
    "choices": [
      { "zh": "60 分钟", "en": "60 minutes" },
      { "zh": "80 分钟", "en": "80 minutes" },
      { "zh": "100 分钟", "en": "100 minutes" }
    ],
    "correct_index": 1,
    "explanation_zh": "40 + 40 = 80 分钟。",
    "explanation_en": "40 + 40 = 80 minutes."
  },
  {
    "difficulty": 4,
    "topic": "time",
    "text_zh": "今天是星期五，后天是星期几？",
    "text_en": "Today is Friday. What day is the day after tomorrow?",
    "choices": [
      { "zh": "星期六", "en": "Saturday" },
      { "zh": "星期日", "en": "Sunday" },
      { "zh": "星期一", "en": "Monday" }
    ],
    "correct_index": 1,
    "explanation_zh": "明天是星期六，后天（再过两天）是星期日。",
    "explanation_en": "Tomorrow is Saturday, so the day after tomorrow is Sunday."
  },
  {
    "difficulty": 5,
    "topic": "time",
    "text_zh": "小明 7:00 起床，刷牙洗脸用了 15 分钟，吃早饭又用了 15 分钟。他几点能吃好早饭？",
    "text_en": "Ming gets up at 7:00. He spends 15 minutes washing up and another 15 minutes on breakfast. What time does he finish breakfast?",
    "choices": [
      { "zh": "7:15", "en": "7:15" },
      { "zh": "7:45", "en": "7:45" },
      { "zh": "7:30", "en": "7:30" }
    ],
    "correct_index": 2,
    "explanation_zh": "一共用了 15 + 15 = 30 分钟，7:00 过 30 分钟是 7:30。",
    "explanation_en": "15 + 15 = 30 minutes; 30 minutes after 7:00 is 7:30."
  },
  {
    "difficulty": 5,
    "topic": "time",
    "text_zh": "一本书打开后，左边一页是第 8 页。右边一页是第几页？",
    "text_en": "An open book shows page 8 on the left. What page number is on the right?",
    "choices": [
      { "zh": "第 9 页", "en": "page 9" },
      { "zh": "第 7 页", "en": "page 7" },
      { "zh": "第 10 页", "en": "page 10" }
    ],
    "correct_index": 0,
    "explanation_zh": "书翻开后左右两页是连着的页码，左边 8 页，右边就是 9 页。",
    "explanation_en": "Facing pages have consecutive numbers: left is 8, so right is 9."
  },
  {
    "difficulty": 5,
    "topic": "time",
    "text_zh": "从 1 数到 20，一共会说到几个带数字“5”的数？（比如 15 就带 5）",
    "text_en": "Counting from 1 to 20, how many numbers contain the digit 5? (For example, 15 contains 5.)",
    "choices": [
      { "zh": "2 个", "en": "2" },
      { "zh": "1 个", "en": "1" },
      { "zh": "3 个", "en": "3" }
    ],
    "correct_index": 0,
    "explanation_zh": "1 到 20 里带 5 的数只有 5 和 15，一共 2 个。",
    "explanation_en": "Between 1 and 20, only 5 and 15 contain the digit 5 — that is 2 numbers."
  }
]
```

- [ ] **Step 4: 更新 tests/seed.test.ts 断言完整题库**

把 `tests/seed.test.ts` 的第一个测试替换为：

```ts
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { runSeed } from "@/scripts/seed";

describe("runSeed", () => {
  it("seeds 54 questions: 18 per difficulty, 9 per topic", () => {
    const db = openDb(":memory:");
    const n = runSeed(db);
    expect(n).toBe(54);

    const perDifficulty = db
      .prepare("SELECT difficulty, COUNT(*) AS n FROM questions GROUP BY difficulty ORDER BY difficulty")
      .all() as { difficulty: number; n: number }[];
    expect(perDifficulty).toEqual([
      { difficulty: 3, n: 18 },
      { difficulty: 4, n: 18 },
      { difficulty: 5, n: 18 },
    ]);

    const perTopic = db
      .prepare("SELECT topic, COUNT(*) AS n FROM questions GROUP BY topic ORDER BY topic")
      .all() as { topic: string; n: number }[];
    expect(perTopic).toEqual([
      { topic: "arithmetic", n: 9 },
      { topic: "counting", n: 9 },
      { topic: "logic", n: 9 },
      { topic: "patterns", n: 9 },
      { topic: "shapes", n: 9 },
      { topic: "time", n: 9 },
    ]);
  });

  it("stores choices as JSON with exactly 3 items", () => {
    const db = openDb(":memory:");
    runSeed(db);
    const row = db.prepare("SELECT choices FROM questions LIMIT 1").get() as { choices: string };
    const choices = JSON.parse(row.choices) as { zh: string; en: string }[];
    expect(choices).toHaveLength(3);
    expect(typeof choices[0].zh).toBe("string");
    expect(typeof choices[0].en).toBe("string");
  });

  it("every correct_index points at a real choice", () => {
    const db = openDb(":memory:");
    runSeed(db);
    const rows = db.prepare("SELECT choices, correct_index FROM questions").all() as {
      choices: string;
      correct_index: number;
    }[];
    for (const r of rows) {
      const choices = JSON.parse(r.choices) as unknown[];
      expect(r.correct_index).toBeGreaterThanOrEqual(0);
      expect(r.correct_index).toBeLessThan(choices.length);
    }
  });
});
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/seed.test.ts`
预期：PASS，3 个测试通过。

- [ ] **Step 6: 重新 seed 开发数据库**

Run: `npm run seed`
预期：输出 `已导入 54 道题目`。

- [ ] **Step 7: 提交**

```bash
git add questions/logic.json questions/arithmetic.json questions/time.json tests/seed.test.ts
git commit -m "feat: 补齐 logic/arithmetic/time 共 27 道双语题，题库达到 54 道"
```

---

### Task 6: 取题查询层 + GET /api/questions

**Files:**
- Create: `src/lib/questions.ts`, `src/app/api/questions/route.ts`
- Test: `tests/questions.test.ts`

**Interfaces:**
- Produces:
  - `interface QuestionRow`（DB 原始行，choices 为 JSON 字符串）
  - `rowToQuestion(r: QuestionRow): Question`
  - `getQuestionsByIds(db, ids: number[]): Question[]`（保持传入顺序）
  - `getPracticeQuestions(db, topic: Topic | "random", limit: number): Question[]`
  - `getLastExamSessionId(db): number | null`（最近一次**已完成**的考试会话）
  - `getExamQuestions(db, perDifficulty = 8): Question[]`（按 3/4/5 分各抽 perDifficulty 道；排除上次考试用题，不足则回退全量）
- Consumes: `openDb`、`Question`/`Topic` 类型

- [ ] **Step 1: 写失败测试**

创建 `tests/questions.test.ts`：

```ts
import type { Database } from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { getExamQuestions, getPracticeQuestions } from "@/lib/questions";

const CHOICES = JSON.stringify([
  { zh: "A", en: "A" },
  { zh: "B", en: "B" },
  { zh: "C", en: "C" },
]);

function seedFixture(db: Database, perDifficulty: number) {
  const insert = db.prepare(
    `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en)
     VALUES (?, 'counting', '题', 'q', ?, 0, '解', 'a')`
  );
  for (const d of [3, 4, 5]) {
    for (let i = 0; i < perDifficulty; i++) insert.run(d, CHOICES);
  }
}

describe("getPracticeQuestions", () => {
  it("respects the limit", () => {
    const db = openDb(":memory:");
    seedFixture(db, 5);
    expect(getPracticeQuestions(db, "random", 4)).toHaveLength(4);
  });

  it("filters by topic", () => {
    const db = openDb(":memory:");
    seedFixture(db, 3);
    db.prepare(
      `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en)
       VALUES (3, 'logic', '题', 'q', ?, 0, '解', 'a')`
    ).run(CHOICES);
    const rows = getPracticeQuestions(db, "logic", 10);
    expect(rows).toHaveLength(1);
    expect(rows[0].topic).toBe("logic");
  });

  it("parses choices JSON into objects", () => {
    const db = openDb(":memory:");
    seedFixture(db, 1);
    const [q] = getPracticeQuestions(db, "random", 1);
    expect(q.choices).toHaveLength(3);
    expect(q.choices[0]).toEqual({ zh: "A", en: "A" });
  });
});

describe("getExamQuestions", () => {
  it("draws perDifficulty from each difficulty band without duplicates", () => {
    const db = openDb(":memory:");
    seedFixture(db, 4);
    const rows = getExamQuestions(db, 2);
    expect(rows).toHaveLength(6);
    const counts: Record<number, number> = { 3: 0, 4: 0, 5: 0 };
    for (const r of rows) counts[r.difficulty] += 1;
    expect(counts).toEqual({ 3: 2, 4: 2, 5: 2 });
    expect(new Set(rows.map((r) => r.id)).size).toBe(6);
  });

  it("excludes questions used in the last finished exam", () => {
    const db = openDb(":memory:");
    seedFixture(db, 3); // difficulty-3 ids are 1,2,3
    const sid = Number(
      db.prepare("INSERT INTO sessions (mode, started_at, finished_at) VALUES ('exam', 1, 2)").run()
        .lastInsertRowid
    );
    db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, 1, 1)").run(sid);
    db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, 2, 1)").run(sid);

    const d3 = getExamQuestions(db, 2)
      .filter((r) => r.difficulty === 3)
      .map((r) => r.id);
    expect(d3).toHaveLength(2);
    expect(d3).not.toContain(1);
    expect(d3).not.toContain(2);
  });

  it("ignores unfinished exam sessions when excluding", () => {
    const db = openDb(":memory:");
    seedFixture(db, 3);
    const sid = Number(
      db.prepare("INSERT INTO sessions (mode, started_at) VALUES ('exam', 1)").run().lastInsertRowid
    );
    db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, 1, 1)").run(sid);
    db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, 2, 1)").run(sid);
    db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, 3, 1)").run(sid);
    const d3 = getExamQuestions(db, 3).filter((r) => r.difficulty === 3);
    expect(d3).toHaveLength(3);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/questions.test.ts`
预期：FAIL，找不到模块 `@/lib/questions`。

- [ ] **Step 3: 实现 src/lib/questions.ts**

```ts
import type { Database } from "better-sqlite3";
import type { Question, Topic } from "./types";

export interface QuestionRow {
  id: number;
  difficulty: number;
  topic: string;
  text_zh: string;
  text_en: string;
  illustration: string | null;
  choices: string;
  correct_index: number;
  explanation_zh: string;
  explanation_en: string;
}

export function rowToQuestion(r: QuestionRow): Question {
  return {
    id: r.id,
    difficulty: r.difficulty as Question["difficulty"],
    topic: r.topic as Topic,
    text_zh: r.text_zh,
    text_en: r.text_en,
    illustration: r.illustration,
    choices: JSON.parse(r.choices) as Question["choices"],
    correct_index: r.correct_index,
    explanation_zh: r.explanation_zh,
    explanation_en: r.explanation_en,
  };
}

export function getQuestionsByIds(db: Database, ids: number[]): Question[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`)
    .all(...ids) as QuestionRow[];
  const byId = new Map(rows.map((r) => [r.id, rowToQuestion(r)]));
  return ids.map((id) => byId.get(id)).filter((q): q is Question => q !== undefined);
}

export function getPracticeQuestions(
  db: Database,
  topic: Topic | "random",
  limit: number
): Question[] {
  const rows =
    topic === "random"
      ? (db.prepare("SELECT * FROM questions ORDER BY RANDOM() LIMIT ?").all(limit) as QuestionRow[])
      : (db
          .prepare("SELECT * FROM questions WHERE topic = ? ORDER BY RANDOM() LIMIT ?")
          .all(topic, limit) as QuestionRow[]);
  return rows.map(rowToQuestion);
}

function pickExcluding(
  db: Database,
  difficulty: number,
  excludeIds: number[],
  limit: number
): QuestionRow[] {
  if (limit <= 0) return [];
  if (excludeIds.length === 0) {
    return db
      .prepare("SELECT * FROM questions WHERE difficulty = ? ORDER BY RANDOM() LIMIT ?")
      .all(difficulty, limit) as QuestionRow[];
  }
  const ph = excludeIds.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT * FROM questions WHERE difficulty = ? AND id NOT IN (${ph}) ORDER BY RANDOM() LIMIT ?`
    )
    .all(difficulty, ...excludeIds, limit) as QuestionRow[];
}

export function getLastExamSessionId(db: Database): number | null {
  const row = db
    .prepare(
      "SELECT id FROM sessions WHERE mode = 'exam' AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1"
    )
    .get() as { id: number } | undefined;
  return row?.id ?? null;
}

export function getExamQuestions(db: Database, perDifficulty = 8): Question[] {
  const lastId = getLastExamSessionId(db);
  const excluded =
    lastId === null
      ? []
      : (
          db
            .prepare("SELECT DISTINCT question_id AS id FROM answers WHERE session_id = ?")
            .all(lastId) as { id: number }[]
        ).map((r) => r.id);

  const out: QuestionRow[] = [];
  for (const difficulty of [3, 4, 5]) {
    let rows = pickExcluding(db, difficulty, excluded, perDifficulty);
    if (rows.length < perDifficulty) {
      const have = rows.map((r) => r.id);
      rows = [...rows, ...pickExcluding(db, difficulty, have, perDifficulty - rows.length)];
    }
    out.push(...rows);
  }
  return out.map(rowToQuestion);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/questions.test.ts`
预期：PASS，6 个测试通过。

- [ ] **Step 5: 创建 src/app/api/questions/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPracticeQuestions } from "@/lib/questions";
import { TOPICS, type Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topicParam = url.searchParams.get("topic") ?? "random";
  const topic: Topic | "random" =
    topicParam === "random" || (TOPICS as readonly string[]).includes(topicParam)
      ? (topicParam as Topic | "random")
      : "random";
  const rawLimit = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.floor(rawLimit)), 54) : 10;
  const questions = getPracticeQuestions(getDb(), topic, limit);
  return NextResponse.json({ questions });
}
```

- [ ] **Step 6: 构建验证**

Run: `npm run build`
预期：构建成功，输出中出现 `/api/questions` 路由。

- [ ] **Step 7: 提交**

```bash
git add src/lib/questions.ts src/app/api/questions/route.ts tests/questions.test.ts
git commit -m "feat: 取题查询层（练习随机/考试 8-8-8 抽题与排除）及 /api/questions"
```

---

### Task 7: 会话与作答层 + 考试/作答 API

**Files:**
- Create: `src/lib/sessions.ts`, `src/lib/answers.ts`, `src/app/api/sessions/route.ts`, `src/app/api/answers/route.ts`, `src/app/api/exam/route.ts`, `src/app/api/sessions/[id]/route.ts`, `src/app/api/sessions/[id]/finish/route.ts`
- Test: `tests/answers.test.ts`

**Interfaces:**
- Produces:
  - `createSession(db, mode: "practice" | "exam", startedAt: number): number`
  - `getSession(db, id: number): SessionRow | null`
  - `getAnswersForSession(db, sessionId: number): AnswerRow[]`（按 id 升序）
  - `interface FinishStats { score; maxScore; correct; wrong; blank; durationSeconds: number | null }`
  - `finishSession(db, id: number, stats: FinishStats, finishedAt: number): void`
  - `getFinishedExamSessions(db): SessionRow[]`（按 id 升序）
  - `insertExamPlaceholders(db, sessionId: number, questionIds: number[], at: number): void`
  - `setExamAnswer(db, sessionId, questionId, chosenIndex, isCorrect: boolean, timeSpentSeconds): void`
  - `addPracticeAnswer(db, sessionId, questionId, chosenIndex, isCorrect: boolean, timeSpentSeconds, at: number): void`
  - `getCorrectIndex(db, questionId: number): number | null`
- API:
  - `POST /api/sessions` body `{ mode }` → `{ id }`
  - `POST /api/answers` body `{ sessionId, questionId, chosenIndex, timeSpentSeconds?, mode? }` → `{ ok, isCorrect }`（mode === "exam" 更新占位行，否则追加练习行）
  - `POST /api/exam` → `{ sessionId, minutes, questions }`（24 题 + 占位答案）
  - `GET /api/sessions/[id]` → `{ session, answers, questions }`
  - `POST /api/sessions/[id]/finish` body `{ durationSeconds? }` → 服务端重新计分并写库，返回 `{ sessionId, score, maxScore, correct, wrong, blank }`；仅允许未完成的 exam 会话

- [ ] **Step 1: 写失败测试**

创建 `tests/answers.test.ts`：

```ts
import type { Database } from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { addPracticeAnswer, insertExamPlaceholders, setExamAnswer } from "@/lib/answers";
import { createSession, finishSession, getAnswersForSession, getSession } from "@/lib/sessions";
import { scoreExam } from "@/lib/scoring";

function makeQuestions(db: Database, rows: [number, number][]): number[] {
  const insert = db.prepare(
    `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en)
     VALUES (?, 'counting', '题', 'q', '[{"zh":"A","en":"A"},{"zh":"B","en":"B"},{"zh":"C","en":"C"}]', ?, '解', 'a')`
  );
  return rows.map(([d, c]) => Number(insert.run(d, c).lastInsertRowid));
}

describe("exam flow", () => {
  it("placeholders → updates → finish with official scoring", () => {
    const db = openDb(":memory:");
    const [q3, q4, q5] = makeQuestions(db, [
      [3, 0],
      [4, 1],
      [5, 2],
    ]);
    const sid = createSession(db, "exam", 1000);
    insertExamPlaceholders(db, sid, [q3, q4, q5], 1000);

    const before = getAnswersForSession(db, sid);
    expect(before).toHaveLength(3);
    expect(before.every((a) => a.chosen_index === null)).toBe(true);

    setExamAnswer(db, sid, q3, 0, true, 30); // +3
    setExamAnswer(db, sid, q4, 0, false, 40); // -1
    // q5 stays blank

    const answers = getAnswersForSession(db, sid);
    const meta: Record<number, { difficulty: number; correctIndex: number }> = {
      [q3]: { difficulty: 3, correctIndex: 0 },
      [q4]: { difficulty: 4, correctIndex: 1 },
      [q5]: { difficulty: 5, correctIndex: 2 },
    };
    const result = scoreExam(
      answers.map((a) => ({
        difficulty: meta[a.question_id].difficulty,
        chosen: a.chosen_index,
        correctIndex: meta[a.question_id].correctIndex,
      }))
    );
    expect(result).toEqual({ score: 26, maxScore: 36, correct: 1, wrong: 1, blank: 1 });

    finishSession(
      db,
      sid,
      {
        score: result.score,
        maxScore: result.maxScore,
        correct: result.correct,
        wrong: result.wrong,
        blank: result.blank,
        durationSeconds: 120,
      },
      2000
    );
    const session = getSession(db, sid);
    expect(session?.score).toBe(26);
    expect(session?.max_score).toBe(36);
    expect(session?.blank_count).toBe(1);
    expect(session?.finished_at).toBe(2000);
  });

  it("setExamAnswer does not add rows, only updates the placeholder", () => {
    const db = openDb(":memory:");
    const [q] = makeQuestions(db, [[3, 0]]);
    const sid = createSession(db, "exam", 1);
    insertExamPlaceholders(db, sid, [q], 1);
    setExamAnswer(db, sid, q, 0, true, 10);
    setExamAnswer(db, sid, q, 1, false, 15);
    expect(getAnswersForSession(db, sid)).toHaveLength(1);
  });
});

describe("practice flow", () => {
  it("appends one row per attempt, keeping order", () => {
    const db = openDb(":memory:");
    const [q] = makeQuestions(db, [[3, 1]]);
    const sid = createSession(db, "practice", 1000);
    addPracticeAnswer(db, sid, q, 0, false, 10, 1001);
    addPracticeAnswer(db, sid, q, 1, true, 12, 1002);
    const answers = getAnswersForSession(db, sid);
    expect(answers).toHaveLength(2);
    expect(answers.map((a) => a.is_correct)).toEqual([0, 1]);
    expect(answers.map((a) => a.chosen_index)).toEqual([0, 1]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/answers.test.ts`
预期：FAIL，找不到模块 `@/lib/answers`。

- [ ] **Step 3: 实现 src/lib/sessions.ts**

```ts
import type { Database } from "better-sqlite3";
import type { AnswerRow, SessionRow } from "./types";

export function createSession(db: Database, mode: "practice" | "exam", startedAt: number): number {
  const info = db.prepare("INSERT INTO sessions (mode, started_at) VALUES (?, ?)").run(mode, startedAt);
  return Number(info.lastInsertRowid);
}

export function getSession(db: Database, id: number): SessionRow | null {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
  return row ?? null;
}

export function getAnswersForSession(db: Database, sessionId: number): AnswerRow[] {
  return db
    .prepare("SELECT * FROM answers WHERE session_id = ? ORDER BY id")
    .all(sessionId) as AnswerRow[];
}

export interface FinishStats {
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  blank: number;
  durationSeconds: number | null;
}

export function finishSession(db: Database, id: number, stats: FinishStats, finishedAt: number): void {
  db.prepare(
    `UPDATE sessions
     SET finished_at = ?, score = ?, max_score = ?, correct_count = ?, wrong_count = ?, blank_count = ?, duration_seconds = ?
     WHERE id = ?`
  ).run(
    finishedAt,
    stats.score,
    stats.maxScore,
    stats.correct,
    stats.wrong,
    stats.blank,
    stats.durationSeconds,
    id
  );
}

export function getFinishedExamSessions(db: Database): SessionRow[] {
  return db
    .prepare("SELECT * FROM sessions WHERE mode = 'exam' AND finished_at IS NOT NULL ORDER BY id ASC")
    .all() as SessionRow[];
}
```

- [ ] **Step 4: 实现 src/lib/answers.ts**

```ts
import type { Database } from "better-sqlite3";

export function insertExamPlaceholders(
  db: Database,
  sessionId: number,
  questionIds: number[],
  at: number
): void {
  const insert = db.prepare(
    "INSERT INTO answers (session_id, question_id, created_at) VALUES (?, ?, ?)"
  );
  const tx = db.transaction((ids: number[]) => {
    for (const questionId of ids) insert.run(sessionId, questionId, at);
  });
  tx(questionIds);
}

export function setExamAnswer(
  db: Database,
  sessionId: number,
  questionId: number,
  chosenIndex: number,
  isCorrect: boolean,
  timeSpentSeconds: number
): void {
  db.prepare(
    "UPDATE answers SET chosen_index = ?, is_correct = ?, time_spent_seconds = ? WHERE session_id = ? AND question_id = ?"
  ).run(chosenIndex, isCorrect ? 1 : 0, timeSpentSeconds, sessionId, questionId);
}

export function addPracticeAnswer(
  db: Database,
  sessionId: number,
  questionId: number,
  chosenIndex: number,
  isCorrect: boolean,
  timeSpentSeconds: number,
  at: number
): void {
  db.prepare(
    "INSERT INTO answers (session_id, question_id, chosen_index, is_correct, time_spent_seconds, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(sessionId, questionId, chosenIndex, isCorrect ? 1 : 0, timeSpentSeconds, at);
}

export function getCorrectIndex(db: Database, questionId: number): number | null {
  const row = db
    .prepare("SELECT correct_index FROM questions WHERE id = ?")
    .get(questionId) as { correct_index: number } | undefined;
  return row?.correct_index ?? null;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/answers.test.ts`
预期：PASS，3 个测试通过。

- [ ] **Step 6: 创建 src/app/api/sessions/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { mode?: unknown };
  const mode = body.mode === "exam" ? "exam" : "practice";
  const id = createSession(getDb(), mode, Date.now());
  return NextResponse.json({ id });
}
```

- [ ] **Step 7: 创建 src/app/api/answers/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { addPracticeAnswer, getCorrectIndex, setExamAnswer } from "@/lib/answers";

export const dynamic = "force-dynamic";

interface Body {
  sessionId?: number;
  questionId?: number;
  chosenIndex?: number;
  timeSpentSeconds?: number;
  mode?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { sessionId, questionId, chosenIndex } = body;
  if (
    typeof sessionId !== "number" ||
    typeof questionId !== "number" ||
    typeof chosenIndex !== "number" ||
    chosenIndex < 0 ||
    chosenIndex > 2
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const db = getDb();
  const correctIndex = getCorrectIndex(db, questionId);
  if (correctIndex === null) {
    return NextResponse.json({ error: "question not found" }, { status: 404 });
  }
  const isCorrect = chosenIndex === correctIndex;
  const timeSpent = typeof body.timeSpentSeconds === "number" ? body.timeSpentSeconds : 0;
  if (body.mode === "exam") {
    setExamAnswer(db, sessionId, questionId, chosenIndex, isCorrect, timeSpent);
  } else {
    addPracticeAnswer(db, sessionId, questionId, chosenIndex, isCorrect, timeSpent, Date.now());
  }
  return NextResponse.json({ ok: true, isCorrect });
}
```

- [ ] **Step 8: 创建 src/app/api/exam/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getExamQuestions } from "@/lib/questions";
import { insertExamPlaceholders } from "@/lib/answers";
import { createSession } from "@/lib/sessions";
import { EXAM_MINUTES } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function POST() {
  const db = getDb();
  const questions = getExamQuestions(db);
  const startedAt = Date.now();
  const sessionId = createSession(db, "exam", startedAt);
  insertExamPlaceholders(db, sessionId, questions.map((q) => q.id), startedAt);
  return NextResponse.json({ sessionId, minutes: EXAM_MINUTES, questions });
}
```

- [ ] **Step 9: 创建 src/app/api/sessions/[id]/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getQuestionsByIds } from "@/lib/questions";
import { getAnswersForSession, getSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const session = getSession(db, Number(id));
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });
  const answers = getAnswersForSession(db, session.id);
  const questions = getQuestionsByIds(db, answers.map((a) => a.question_id));
  return NextResponse.json({ session, answers, questions });
}
```

- [ ] **Step 10: 创建 src/app/api/sessions/[id]/finish/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getQuestionsByIds } from "@/lib/questions";
import { scoreExam } from "@/lib/scoring";
import { finishSession, getAnswersForSession, getSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  const body = (await req.json().catch(() => ({}))) as { durationSeconds?: number };
  const db = getDb();
  const session = getSession(db, sessionId);
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });
  if (session.mode !== "exam") {
    return NextResponse.json({ error: "only exam sessions can be finished" }, { status: 400 });
  }
  if (session.finished_at !== null) {
    return NextResponse.json({ error: "session already finished" }, { status: 409 });
  }

  const answers = getAnswersForSession(db, sessionId);
  const questions = getQuestionsByIds(db, answers.map((a) => a.question_id));
  const byId = new Map(questions.map((q) => [q.id, q]));
  const result = scoreExam(
    answers.map((a) => {
      const q = byId.get(a.question_id);
      return { difficulty: q?.difficulty ?? 0, chosen: a.chosen_index, correctIndex: q?.correct_index ?? -1 };
    })
  );
  const duration = typeof body.durationSeconds === "number" ? body.durationSeconds : null;
  finishSession(
    db,
    sessionId,
    {
      score: result.score,
      maxScore: result.maxScore,
      correct: result.correct,
      wrong: result.wrong,
      blank: result.blank,
      durationSeconds: duration,
    },
    Date.now()
  );
  return NextResponse.json({ sessionId, ...result });
}
```

- [ ] **Step 11: 构建验证**

Run: `npm run build`
预期：构建成功，出现 `/api/answers`、`/api/exam`、`/api/sessions`、`/api/sessions/[id]`、`/api/sessions/[id]/finish` 路由。

- [ ] **Step 12: 提交**

```bash
git add src/lib/sessions.ts src/lib/answers.ts src/app/api/ tests/answers.test.ts
git commit -m "feat: 会话/作答数据层与考试全流程 API（开考、作答、交卷计分、报告数据）"
```

---

### Task 8: 设计系统（主题、背景、袋鼠吉祥物）

**Files:**
- Modify: `src/app/globals.css`（整体替换 scaffold 内容）, `src/app/layout.tsx`, `src/app/page.tsx`（临时占位首页）
- Create: `src/components/background/OutbackBackground.tsx`, `src/components/mascot/Kangaroo.tsx`

**Interfaces:**
- Produces:
  - Tailwind 主题工具类：`bg-sky-soft`、`bg-sunny`、`bg-grass`、`bg-gold`、`text-cocoa`、`bg-coral` 等；字体 `font-kids`（展示）、`font-body`（正文）；动画 `animate-drift`、`animate-idle-hop`、`animate-wiggle`、`animate-pop`、`animate-fall`
  - `<OutbackBackground />` — 固定全屏装饰层（`-z-10`）
  - `<Kangaroo mood?: "idle" | "happy" | "sad" className?: string />`

- [ ] **Step 1: 替换 src/app/globals.css**

```css
@import "tailwindcss";

@theme {
  --color-sky-soft: #7ec8e3;
  --color-sunny: #ff9f45;
  --color-grass: #7bc950;
  --color-gold: #ffd166;
  --color-cocoa: #5c4033;
  --color-coral: #ef6351;

  --font-kids: var(--font-kuaile), var(--font-baloo), "Noto Sans SC", ui-rounded, sans-serif;
  --font-body: var(--font-noto), "Noto Sans SC", system-ui, sans-serif;

  --animate-drift: drift 90s linear infinite;
  --animate-idle-hop: idle-hop 2.4s ease-in-out infinite;
  --animate-wiggle: wiggle 0.5s ease-in-out;
  --animate-pop: pop 0.35s ease-out both;
  --animate-fall: fall 2.8s linear forwards;

  @keyframes drift {
    from {
      transform: translateX(-20vw);
    }
    to {
      transform: translateX(120vw);
    }
  }
  @keyframes idle-hop {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }
  @keyframes wiggle {
    0%,
    100% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(-5deg);
    }
    75% {
      transform: rotate(5deg);
    }
  }
  @keyframes pop {
    0% {
      transform: scale(0.6);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  @keyframes fall {
    0% {
      transform: translateY(-10vh) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(110vh) rotate(720deg);
      opacity: 0;
    }
  }
}

body {
  font-family: var(--font-body);
}
```

- [ ] **Step 2: 替换 src/app/layout.tsx**

```tsx
import type { Metadata, Viewport } from "next";
import { Baloo_2, Noto_Sans_SC, ZCOOL_KuaiLe } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin"] });
const noto = Noto_Sans_SC({ variable: "--font-noto", subsets: ["latin"] });
const kuaile = ZCOOL_KuaiLe({ variable: "--font-kuaile", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "跳跳的数学冒险 · 袋鼠数学练习",
  description: "袋鼠数学竞赛 Level 1-2 双语练习：闯关练习、模拟考试、错题本、星星奖励。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${baloo.variable} ${noto.variable} ${kuaile.variable}`}>
      <body className="min-h-dvh bg-sky-soft text-cocoa antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: 创建 src/components/background/OutbackBackground.tsx**

```tsx
export function OutbackBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#aee0f2] via-sky-soft to-[#d3f0dd]" />
      <div className="absolute right-8 top-8 h-24 w-24 rounded-full bg-gold shadow-[0_0_80px_30px_rgba(255,209,102,0.55)]" />
      <Cloud className="top-[12%] animate-drift" style={{ animationDuration: "90s" }} />
      <Cloud className="top-[26%] animate-drift" style={{ animationDuration: "130s", animationDelay: "-40s" }} />
      <Cloud className="top-[6%] animate-drift" style={{ animationDuration: "110s", animationDelay: "-80s" }} />
      <svg
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        className="absolute bottom-0 h-40 w-full sm:h-56"
      >
        <path d="M0 120 Q360 20 720 100 T1440 80 V220 H0 Z" fill="#8fd45f" />
        <path d="M0 170 Q480 90 960 160 T1440 150 V220 H0 Z" fill="#7bc950" />
      </svg>
    </div>
  );
}

function Cloud({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 50" style={style} className={`absolute left-0 w-28 opacity-90 ${className}`}>
      <g fill="#ffffff">
        <circle cx="35" cy="30" r="18" />
        <circle cx="60" cy="22" r="22" />
        <circle cx="88" cy="32" r="16" />
        <rect x="30" y="30" width="65" height="16" rx="8" />
      </g>
    </svg>
  );
}
```

- [ ] **Step 4: 创建 src/components/mascot/Kangaroo.tsx**

```tsx
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
```

- [ ] **Step 5: 用占位首页验证视觉系统（src/app/page.tsx 整体替换）**

```tsx
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
```

- [ ] **Step 6: 构建验证**

Run: `npm run build`
预期：构建成功（Google Fonts 下载完成，无 CSS/TS 报错）。

- [ ] **Step 7: 提交**

```bash
git add src/app/globals.css src/app/layout.tsx src/app/page.tsx src/components/background/ src/components/mascot/
git commit -m "feat: 澳洲内陆主题设计系统 — 调色板、字体、背景与袋鼠吉祥物"
```

---

### Task 9: 题目渲染组件（插图、选项、题卡、读题、彩带、星星罐）

**Files:**
- Create: `src/components/quiz/Illustration.tsx`, `src/components/quiz/ChoiceButton.tsx`, `src/components/quiz/QuestionCard.tsx`, `src/components/quiz/ReadAloud.tsx`, `src/components/quiz/Confetti.tsx`, `src/components/quiz/StarJar.tsx`
- Test: `tests/illustration.test.ts`

**Interfaces:**
- Produces:
  - `type ParsedIllustration = { kind: "none" } | { kind: "emoji"; content: string } | { kind: "clock"; hour: number; minute: number } | { kind: "grid" } | { kind: "diagsquare" }`
  - `parseIllustration(desc: string | null | undefined): ParsedIllustration`
  - `<Illustration descriptor: string | null />`
  - `type ChoiceVariant = "idle" | "wrong" | "correct" | "dimmed" | "selected"`
  - `<ChoiceButton index zh en variant disabled onSelect: (i: number) => void />`
  - `<QuestionCard question: Question>{children}</QuestionCard>`（含题号区、双语题干、插图、🔊 按钮）
  - `<ReadAloud text: string />`（speechSynthesis zh-CN，不支持时不渲染）
  - `<Confetti pieces?: number />`（一次性彩带）
  - `<StarJar stars: number capacity?: number />`

- [ ] **Step 1: 写失败测试（插图描述符解析）**

创建 `tests/illustration.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { parseIllustration } from "@/components/quiz/Illustration";

describe("parseIllustration", () => {
  it("parses null/undefined to none", () => {
    expect(parseIllustration(null)).toEqual({ kind: "none" });
    expect(parseIllustration(undefined)).toEqual({ kind: "none" });
  });
  it("parses emoji descriptors", () => {
    expect(parseIllustration("emoji:🍎🍎")).toEqual({ kind: "emoji", content: "🍎🍎" });
  });
  it("parses clock descriptors", () => {
    expect(parseIllustration("svg:clock:6:30")).toEqual({ kind: "clock", hour: 6, minute: 30 });
    expect(parseIllustration("svg:clock:3:00")).toEqual({ kind: "clock", hour: 3, minute: 0 });
  });
  it("parses grid and diagsquare", () => {
    expect(parseIllustration("svg:grid")).toEqual({ kind: "grid" });
    expect(parseIllustration("svg:diagsquare")).toEqual({ kind: "diagsquare" });
  });
  it("falls back to none for unknown descriptors", () => {
    expect(parseIllustration("svg:rocket")).toEqual({ kind: "none" });
    expect(parseIllustration("svg:clock:x:y")).toEqual({ kind: "none" });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/illustration.test.ts`
预期：FAIL，找不到模块。

- [ ] **Step 3: 实现 src/components/quiz/Illustration.tsx**

```tsx
export type ParsedIllustration =
  | { kind: "none" }
  | { kind: "emoji"; content: string }
  | { kind: "clock"; hour: number; minute: number }
  | { kind: "grid" }
  | { kind: "diagsquare" };

export function parseIllustration(desc: string | null | undefined): ParsedIllustration {
  if (!desc) return { kind: "none" };
  if (desc.startsWith("emoji:")) return { kind: "emoji", content: desc.slice(6) };
  if (desc.startsWith("svg:clock:")) {
    const [h, m] = desc.slice(10).split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) return { kind: "clock", hour: h, minute: m };
    return { kind: "none" };
  }
  if (desc === "svg:grid") return { kind: "grid" };
  if (desc === "svg:diagsquare") return { kind: "diagsquare" };
  return { kind: "none" };
}

export function Illustration({ descriptor }: { descriptor: string | null }) {
  const parsed = parseIllustration(descriptor);
  switch (parsed.kind) {
    case "emoji":
      return (
        <div className="select-none text-center text-5xl leading-relaxed tracking-wide sm:text-6xl">
          {parsed.content}
        </div>
      );
    case "clock":
      return <ClockFace hour={parsed.hour} minute={parsed.minute} />;
    case "grid":
      return <GridSquare />;
    case "diagsquare":
      return <DiagSquare />;
    default:
      return null;
  }
}

function ClockFace({ hour, minute }: { hour: number; minute: number }) {
  const hand = (angleDeg: number, len: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: 60 + len * Math.cos(rad), y: 60 + len * Math.sin(rad) };
  };
  const h = hand((hour % 12) * 30 + minute * 0.5, 26);
  const m = hand(minute * 6, 38);
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-40 w-40">
      <circle cx="60" cy="60" r="54" fill="#fffdf5" stroke="#5c4033" strokeWidth="5" />
      {Array.from({ length: 12 }, (_, i) => {
        const rad = ((i * 30 - 90) * Math.PI) / 180;
        return (
          <circle
            key={i}
            cx={60 + 46 * Math.cos(rad)}
            cy={60 + 46 * Math.sin(rad)}
            r={i % 3 === 0 ? 3.2 : 1.8}
            fill="#5c4033"
          />
        );
      })}
      <line x1="60" y1="60" x2={h.x} y2={h.y} stroke="#5c4033" strokeWidth="6" strokeLinecap="round" />
      <line x1="60" y1="60" x2={m.x} y2={m.y} stroke="#ef6351" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="60" r="4" fill="#5c4033" />
    </svg>
  );
}

function GridSquare() {
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-40 w-40">
      <rect x="15" y="15" width="90" height="90" fill="#fffdf5" stroke="#5c4033" strokeWidth="5" />
      <line x1="60" y1="15" x2="60" y2="105" stroke="#5c4033" strokeWidth="4" />
      <line x1="15" y1="60" x2="105" y2="60" stroke="#5c4033" strokeWidth="4" />
    </svg>
  );
}

function DiagSquare() {
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-40 w-40">
      <rect x="15" y="15" width="90" height="90" fill="#fffdf5" stroke="#5c4033" strokeWidth="5" />
      <line x1="15" y1="15" x2="105" y2="105" stroke="#ef6351" strokeWidth="4" />
    </svg>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/illustration.test.ts`
预期：PASS，5 个测试通过。

- [ ] **Step 5: 创建 src/components/quiz/ChoiceButton.tsx**

```tsx
"use client";

const LETTERS = ["A", "B", "C"] as const;

export type ChoiceVariant = "idle" | "wrong" | "correct" | "dimmed" | "selected";

const VARIANT_CLASS: Record<ChoiceVariant, string> = {
  idle: "border-cocoa/10 bg-white hover:-rotate-1 hover:border-sunny hover:shadow-lg",
  wrong: "animate-wiggle border-coral bg-coral/15",
  correct: "border-grass bg-grass/20",
  dimmed: "border-cocoa/10 bg-white/60 opacity-60",
  selected: "border-sunny bg-sunny/15",
};

export function ChoiceButton({
  index,
  zh,
  en,
  variant,
  disabled,
  onSelect,
}: {
  index: number;
  zh: string;
  en: string;
  variant: ChoiceVariant;
  disabled: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(index)}
      className={`flex w-full items-center gap-4 rounded-3xl border-4 p-4 text-left transition active:translate-y-1 ${VARIANT_CLASS[variant]} ${disabled ? "cursor-default" : "cursor-pointer"}`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sunny font-kids text-2xl text-white shadow">
        {LETTERS[index]}
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-bold leading-tight">{zh}</span>
        <span className="block truncate text-sm text-cocoa/60">{en}</span>
      </span>
    </button>
  );
}
```

- [ ] **Step 6: 创建 src/components/quiz/ReadAloud.tsx**

```tsx
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
```

- [ ] **Step 7: 创建 src/components/quiz/QuestionCard.tsx**

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
        <ReadAloud text={question.text_zh} />
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

- [ ] **Step 8: 创建 src/components/quiz/Confetti.tsx**

```tsx
"use client";

import { useMemo } from "react";

const COLORS = ["#ff9f45", "#7bc950", "#ffd166", "#7ec8e3", "#ef6351", "#c78ff0"];

export function Confetti({ pieces = 40 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.4,
        color: COLORS[i % COLORS.length],
        size: 8 + Math.random() * 8,
        rounded: Math.random() > 0.5,
      })),
    [pieces]
  );
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute top-0 animate-fall"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size * 0.6,
            backgroundColor: b.color,
            borderRadius: b.rounded ? "9999px" : "2px",
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 9: 创建 src/components/quiz/StarJar.tsx**

```tsx
export function StarJar({ stars, capacity = 100 }: { stars: number; capacity?: number }) {
  const pct = Math.min(1, stars / capacity);
  const fillY = 70 - pct * 55;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 80 90" className="h-28 w-24">
        <defs>
          <clipPath id="jarclip">
            <path d="M18 22 H62 V70 Q62 80 52 80 H28 Q18 80 18 70 Z" />
          </clipPath>
        </defs>
        <g clipPath="url(#jarclip)">
          <rect x="18" y={fillY} width="44" height={80 - fillY} fill="#ffd166" />
        </g>
        {stars > 0 && (
          <text x="40" y={Math.max(fillY + 16, 34)} textAnchor="middle" fontSize="16">
            ⭐
          </text>
        )}
        <path d="M18 22 H62 V70 Q62 80 52 80 H28 Q18 80 18 70 Z" fill="none" stroke="#5c4033" strokeWidth="4" />
        <rect x="14" y="12" width="52" height="12" rx="5" fill="none" stroke="#5c4033" strokeWidth="4" />
      </svg>
      <span className="font-kids text-xl">⭐ {stars}</span>
    </div>
  );
}
```

- [ ] **Step 10: 构建验证**

Run: `npm run build`
预期：构建成功。

- [ ] **Step 11: 提交**

```bash
git add src/components/quiz/ tests/illustration.test.ts
git commit -m "feat: 题目渲染组件 — 插图(emoji/SVG钟面/方格)、选项按钮、题卡、读题、彩带、星星罐"
```

---

### Task 10: 闯关练习页

**Files:**
- Create: `src/app/practice/page.tsx`

**Interfaces:**
- Consumes: `POST /api/sessions`、`GET /api/questions`、`POST /api/answers`；`QuestionCard`、`ChoiceButton`、`Confetti`、`Kangaroo`、`OutbackBackground`
- 规则：首次答对 +3⭐ 并显示解析；首次答错给鼓励与第二次机会（不公布答案）；第二次答对 +1⭐；第二次仍错公布正确答案+解析（自动进入错题本，由 answers 派生）

- [ ] **Step 1: 创建 src/app/practice/page.tsx**

```tsx
"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { ChoiceButton, type ChoiceVariant } from "@/components/quiz/ChoiceButton";
import { Confetti } from "@/components/quiz/Confetti";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import type { Question, Topic } from "@/lib/types";

const TOPIC_OPTIONS: { key: Topic | "random"; zh: string; en: string; emoji: string }[] = [
  { key: "random", zh: "随机混合", en: "Mixed", emoji: "🎲" },
  { key: "counting", zh: "数数与观察", en: "Counting", emoji: "🔢" },
  { key: "shapes", zh: "图形与空间", en: "Shapes", emoji: "🔷" },
  { key: "patterns", zh: "规律与序列", en: "Patterns", emoji: "🎨" },
  { key: "logic", zh: "逻辑与推理", en: "Logic", emoji: "🧠" },
  { key: "arithmetic", zh: "计算与应用", en: "Arithmetic", emoji: "➕" },
  { key: "time", zh: "时间与生活", en: "Time", emoji: "⏰" },
];

const PRACTICE_SIZE = 10;

type Phase = "select" | "loading" | "playing" | "done";
type Feedback = { kind: "correct"; stars: number } | { kind: "encourage" } | { kind: "reveal" };

export default function PracticePage() {
  const [phase, setPhase] = useState<Phase>("select");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [earned, setEarned] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const shownAt = useRef(Date.now());

  const start = useCallback(async (topic: Topic | "random") => {
    setPhase("loading");
    const [sessRes, qsRes] = await Promise.all([
      fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "practice" }),
      }),
      fetch(`/api/questions?topic=${topic}&limit=${PRACTICE_SIZE}`),
    ]);
    const sess = (await sessRes.json()) as { id: number };
    const qs = (await qsRes.json()) as { questions: Question[] };
    setSessionId(sess.id);
    setQuestions(qs.questions);
    setIndex(0);
    setAttempt(0);
    setPicked(null);
    setFeedback(null);
    setEarned(0);
    shownAt.current = Date.now();
    setPhase(qs.questions.length > 0 ? "playing" : "done");
  }, []);

  const pick = useCallback(
    async (i: number) => {
      if (feedback !== null || sessionId === null) return;
      const q = questions[index];
      setPicked(i);
      const correct = i === q.correct_index;
      const timeSpentSeconds = Math.max(0, Math.round((Date.now() - shownAt.current) / 1000));
      await fetch("/api/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, questionId: q.id, chosenIndex: i, timeSpentSeconds }),
      });
      if (correct) {
        const stars = attempt === 0 ? 3 : 1;
        setEarned((e) => e + stars);
        setFeedback({ kind: "correct", stars });
      } else if (attempt === 0) {
        setAttempt(1);
        setFeedback({ kind: "encourage" });
        window.setTimeout(() => {
          setFeedback(null);
          setPicked(null);
        }, 1300);
      } else {
        setFeedback({ kind: "reveal" });
      }
    },
    [attempt, feedback, index, questions, sessionId]
  );

  const next = useCallback(() => {
    if (index + 1 >= questions.length) {
      setPhase("done");
      return;
    }
    setIndex((v) => v + 1);
    setAttempt(0);
    setPicked(null);
    setFeedback(null);
    shownAt.current = Date.now();
  }, [index, questions.length]);

  const q = questions[index];

  const variantFor = (i: number): ChoiceVariant => {
    if (feedback?.kind === "reveal") return i === q?.correct_index ? "correct" : "dimmed";
    if (feedback?.kind === "encourage" && i === picked) return "wrong";
    if (feedback?.kind === "correct" && i === picked) return "correct";
    return "idle";
  };

  const mood =
    feedback?.kind === "correct" ? "happy" : feedback?.kind === "encourage" ? "sad" : "idle";

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      {phase === "select" && (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <header className="flex items-center justify-between">
            <Link href="/" className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">← 回家 Home</Link>
            <h1 className="font-kids text-3xl">闯关练习</h1>
            <span className="w-24" aria-hidden="true" />
          </header>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Kangaroo mood="happy" className="h-36 animate-idle-hop" />
            <p className="max-w-xs rounded-3xl border-4 border-cocoa/10 bg-white/90 p-4 text-center font-kids text-xl shadow">
              选一个主题开始冒险吧！ Pick a topic!
            </p>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {TOPIC_OPTIONS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => void start(t.key)}
                className="rounded-[1.75rem] border-4 border-cocoa/10 bg-white/90 p-5 text-center shadow transition hover:-rotate-1 hover:border-sunny hover:shadow-lg active:translate-y-1"
              >
                <div className="text-4xl">{t.emoji}</div>
                <div className="mt-1 font-kids text-lg">{t.zh}</div>
                <div className="text-xs text-cocoa/60">{t.en}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "loading" && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
          <Kangaroo mood="idle" className="h-40 animate-idle-hop" />
          <p className="rounded-full bg-white/90 px-6 py-3 font-kids text-xl shadow">正在准备题目… Preparing…</p>
        </div>
      )}

      {phase === "playing" && q && (
        <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8">
          {feedback?.kind === "correct" && <Confetti />}
          <header className="flex items-center justify-between gap-2">
            <Link href="/" className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">← 回家</Link>
            <span className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">
              第 {index + 1} / {questions.length} 题
            </span>
            <span className="rounded-full bg-gold/90 px-4 py-2 font-kids shadow">⭐ {earned}</span>
          </header>

          <QuestionCard question={q}>
            <div className="space-y-3">
              {q.choices.map((c, i) => (
                <ChoiceButton
                  key={i}
                  index={i}
                  zh={c.zh}
                  en={c.en}
                  variant={variantFor(i)}
                  disabled={feedback !== null}
                  onSelect={(i2) => void pick(i2)}
                />
              ))}
            </div>

            {feedback?.kind === "encourage" && (
              <p className="mt-4 animate-pop rounded-2xl bg-gold/40 p-3 text-center font-kids text-lg">
                差一点点！再试一次吧～ So close! Try again!
              </p>
            )}

            {(feedback?.kind === "correct" || feedback?.kind === "reveal") && (
              <div className="mt-4 animate-pop space-y-3">
                {feedback.kind === "correct" ? (
                  <p className="rounded-2xl bg-grass/25 p-3 text-center font-kids text-xl">
                    太棒了！+{feedback.stars}⭐ Awesome!
                  </p>
                ) : (
                  <p className="rounded-2xl bg-coral/15 p-3 text-center font-kids text-lg">
                    没关系，看看答案吧！ Here is the answer!
                  </p>
                )}
                <div className="rounded-2xl border-4 border-cocoa/10 bg-[#fffdf5] p-4">
                  <p className="font-bold">💡 {q.explanation_zh}</p>
                  <p className="mt-1 text-sm text-cocoa/60">{q.explanation_en}</p>
                </div>
                <button
                  type="button"
                  onClick={next}
                  className="w-full rounded-full bg-sunny p-4 font-kids text-2xl text-white shadow-lg transition hover:brightness-105 active:translate-y-1"
                >
                  {index + 1 >= questions.length ? "完成！Finish!" : "下一题 Next →"}
                </button>
              </div>
            )}
          </QuestionCard>

          <div className="flex justify-center">
            <Kangaroo mood={mood} className="h-28" />
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="mx-auto max-w-xl space-y-6 px-4 py-16 text-center">
          <Confetti />
          <Kangaroo mood="happy" className="mx-auto h-44 animate-idle-hop" />
          <h1 className="font-kids text-4xl">闯关完成！Well done!</h1>
          <p className="font-kids text-2xl text-cocoa/80">这次一共得到 ⭐ {earned} 颗星星</p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setPhase("select")}
              className="rounded-full bg-sunny px-8 py-4 font-kids text-2xl text-white shadow-lg active:translate-y-1"
            >
              再来一轮 Again
            </button>
            <Link href="/" className="rounded-full bg-white px-8 py-4 font-kids text-2xl shadow">回家 Home</Link>
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
预期：构建成功，出现 `/practice` 路由。

- [ ] **Step 3: 提交**

```bash
git add src/app/practice/
git commit -m "feat: 闯关练习页 — 主题选择、两次作答机会、即时反馈与星星结算"
```

---

### Task 11: 模拟考试页与报告页

**Files:**
- Create: `src/app/exam/page.tsx`, `src/app/exam/report/[id]/page.tsx`

**Interfaces:**
- Consumes: `POST /api/exam`、`POST /api/answers`（mode: "exam"）、`POST /api/sessions/[id]/finish`、`GET /api/sessions/[id]` 的数据结构；`formatClock`、`encouragement`、`EXAM_MINUTES`
- 考试页：75 分钟倒计时（`EXAM_MINUTES * 60` 秒），24 题导航点、标记不确定、切题、交卷确认、到点自动交卷；作答在交卷时批量提交
- 报告页（服务端组件，`force-dynamic`）：总分、鼓励评语、按难度/题型正确率条形图、每题回顾

- [ ] **Step 1: 创建 src/app/exam/page.tsx**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { ChoiceButton, type ChoiceVariant } from "@/components/quiz/ChoiceButton";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { formatClock } from "@/lib/format";
import { EXAM_MINUTES } from "@/lib/scoring";
import type { Question } from "@/lib/types";

type Phase = "intro" | "loading" | "running" | "submitting";

export default function ExamPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [choices, setChoices] = useState<Record<number, number>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [remaining, setRemaining] = useState(EXAM_MINUTES * 60);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const begin = useCallback(async () => {
    setPhase("loading");
    const res = await fetch("/api/exam", { method: "POST" });
    const data = (await res.json()) as { sessionId: number; minutes: number; questions: Question[] };
    setSessionId(data.sessionId);
    setQuestions(data.questions);
    setRemaining(data.minutes * 60);
    setCurrent(0);
    setChoices({});
    setFlagged([]);
    setPhase("running");
  }, []);

  const submit = useCallback(async () => {
    if (sessionId === null || phase === "submitting") return;
    setPhase("submitting");
    for (const q of questions) {
      const chosen = choices[q.id];
      if (chosen === undefined) continue;
      await fetch("/api/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, questionId: q.id, chosenIndex: chosen, timeSpentSeconds: 0, mode: "exam" }),
      });
    }
    await fetch(`/api/sessions/${sessionId}/finish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ durationSeconds: EXAM_MINUTES * 60 - Math.max(0, remaining) }),
    });
    router.push(`/exam/report/${sessionId}`);
  }, [choices, phase, questions, remaining, router, sessionId]);

  useEffect(() => {
    if (phase !== "running") return;
    const t = window.setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "running" && remaining <= 0) void submit();
  }, [phase, remaining, submit]);

  const answeredCount = useMemo(() => Object.keys(choices).length, [choices]);
  const q = questions[current];

  const variantFor = (i: number): ChoiceVariant =>
    q && choices[q.id] === i ? "selected" : "idle";

  const toggleFlag = () => {
    if (!q) return;
    setFlagged((f) => (f.includes(q.id) ? f.filter((x) => x !== q.id) : [...f, q.id]));
  };

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />

      {phase === "intro" && (
        <div className="mx-auto max-w-xl px-4 py-14">
          <div className="rounded-[2rem] border-4 border-cocoa/10 bg-white/95 p-8 shadow-xl">
            <Kangaroo mood="idle" className="mx-auto h-32 animate-idle-hop" />
            <h1 className="mt-3 text-center font-kids text-4xl">模拟考试 Mock Exam</h1>
            <ul className="mt-5 space-y-2 text-lg">
              <li>📋 24 道选择题（A/B/C 三个选项）</li>
              <li>⏰ 限时 75 分钟</li>
              <li>🎁 起始分 24 分：答对加 3/4/5 分，答错扣 1 分，不答不扣分</li>
              <li>🏆 满分 120 分</li>
            </ul>
            <p className="mt-3 text-sm text-cocoa/60">
              24 questions · 75 minutes · +3/+4/+5 for correct, −1 for wrong, 0 for blank.
            </p>
            <button
              type="button"
              onClick={() => void begin()}
              className="mt-6 w-full rounded-full bg-sunny p-4 font-kids text-2xl text-white shadow-lg active:translate-y-1"
            >
              开始考试 Start!
            </button>
            <Link href="/" className="mt-3 block text-center text-sm text-cocoa/50 underline">← 回首页 Home</Link>
          </div>
        </div>
      )}

      {phase === "loading" && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
          <Kangaroo mood="idle" className="h-40 animate-idle-hop" />
          <p className="rounded-full bg-white/90 px-6 py-3 font-kids text-xl shadow">正在发卷… Handing out papers…</p>
        </div>
      )}

      {(phase === "running" || phase === "submitting") && q && (
        <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
          <header className="flex items-center justify-between gap-2 rounded-3xl border-4 border-cocoa/10 bg-white/90 px-4 py-3 shadow">
            <span className={`font-kids text-2xl ${remaining <= 300 ? "text-coral" : ""}`}>
              ⏰ {formatClock(remaining)}
            </span>
            <span className="font-kids text-lg text-cocoa/70">已答 {answeredCount}/{questions.length}</span>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="rounded-full bg-grass px-5 py-2 font-kids text-lg text-white shadow active:translate-y-1"
            >
              交卷 Submit
            </button>
          </header>

          <div className="flex flex-wrap justify-center gap-2">
            {questions.map((item, i) => {
              const answered = choices[item.id] !== undefined;
              const isCurrent = i === current;
              const isFlagged = flagged.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrent(i)}
                  className={`h-9 w-9 rounded-full border-2 font-kids text-sm transition ${isCurrent ? "scale-110 border-sunny" : "border-cocoa/20"} ${answered ? "bg-grass text-white" : "bg-white"} ${isFlagged ? "ring-2 ring-gold" : ""}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <QuestionCard question={q}>
            <div className="space-y-3">
              {q.choices.map((c, i) => (
                <ChoiceButton
                  key={i}
                  index={i}
                  zh={c.zh}
                  en={c.en}
                  variant={variantFor(i)}
                  disabled={phase === "submitting"}
                  onSelect={(i2) => setChoices((prev) => ({ ...prev, [q.id]: i2 }))}
                />
              ))}
            </div>
          </QuestionCard>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={current === 0}
              onClick={() => setCurrent((c) => c - 1)}
              className="rounded-full bg-white px-6 py-3 font-kids text-lg shadow disabled:opacity-40"
            >
              ← 上一题
            </button>
            <button
              type="button"
              onClick={toggleFlag}
              className={`rounded-full px-5 py-3 font-kids shadow ${flagged.includes(q.id) ? "bg-gold" : "bg-white"}`}
            >
              🔖 {flagged.includes(q.id) ? "已标记" : "标记"}
            </button>
            <button
              type="button"
              disabled={current === questions.length - 1}
              onClick={() => setCurrent((c) => c + 1)}
              className="rounded-full bg-white px-6 py-3 font-kids text-lg shadow disabled:opacity-40"
            >
              下一题 →
            </button>
          </div>

          {confirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-cocoa/40 p-4">
              <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
                <p className="font-kids text-2xl">确定交卷吗？</p>
                <p className="mt-2 text-cocoa/70">
                  还有 {questions.length - answeredCount} 题没有作答（不答不扣分）
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    className="flex-1 rounded-full border-4 border-cocoa/10 bg-white p-3 font-kids"
                  >
                    继续答题
                  </button>
                  <button
                    type="button"
                    onClick={() => void submit()}
                    className="flex-1 rounded-full bg-sunny p-3 font-kids text-white"
                  >
                    交卷 Submit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: 创建 src/app/exam/report/[id]/page.tsx**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { getDb } from "@/lib/db";
import { encouragement } from "@/lib/format";
import { getQuestionsByIds } from "@/lib/questions";
import { getAnswersForSession, getSession } from "@/lib/sessions";
import type { Question, Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

const TOPIC_ZH: Record<Topic, string> = {
  counting: "数数",
  shapes: "图形",
  patterns: "规律",
  logic: "逻辑",
  arithmetic: "计算",
  time: "时间",
};

function Bar({ label, correct, total }: { label: string; correct: number; total: number }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-cocoa/60">{correct}/{total}</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-cocoa/10">
        <div className="h-full rounded-full bg-grass" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const session = getSession(db, Number(id));
  if (!session || session.mode !== "exam" || session.finished_at === null) notFound();

  const answers = getAnswersForSession(db, session.id);
  const questions = getQuestionsByIds(db, answers.map((a) => a.question_id));
  const byId = new Map<number, Question>(questions.map((q) => [q.id, q]));

  const score = session.score ?? 0;
  const maxScore = session.max_score ?? 120;
  const praise = encouragement(score, maxScore);

  const perDifficulty = [3, 4, 5].map((d) => {
    const rows = answers.filter((a) => byId.get(a.question_id)?.difficulty === d);
    return { difficulty: d, correct: rows.filter((a) => a.is_correct === 1).length, total: rows.length };
  });
  const perTopic = (Object.keys(TOPIC_ZH) as Topic[]).map((t) => {
    const rows = answers.filter((a) => byId.get(a.question_id)?.topic === t);
    return { topic: t, correct: rows.filter((a) => a.is_correct === 1).length, total: rows.length };
  });

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <section className="rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-8 text-center shadow-xl">
          <Kangaroo mood={score / maxScore >= 0.5 ? "happy" : "sad"} className="mx-auto h-32" />
          <p className="mt-2 font-kids text-5xl text-sunny">
            {score} <span className="text-2xl text-cocoa/50">/ {maxScore}</span>
          </p>
          <p className="mt-2 font-kids text-xl">{praise.zh}</p>
          <p className="text-sm text-cocoa/60">{praise.en}</p>
          <p className="mt-3 text-cocoa/70">
            答对 {session.correct_count ?? 0} 题 · 答错 {session.wrong_count ?? 0} 题 · 未答 {session.blank_count ?? 0} 题
          </p>
        </section>

        <section className="space-y-3 rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl">
          <h2 className="font-kids text-2xl">按难度 By difficulty</h2>
          {perDifficulty.map((row) => (
            <Bar key={row.difficulty} label={`${row.difficulty} 分题`} correct={row.correct} total={row.total} />
          ))}
          <h2 className="pt-2 font-kids text-2xl">按题型 By topic</h2>
          {perTopic.map((row) => (
            <Bar key={row.topic} label={TOPIC_ZH[row.topic]} correct={row.correct} total={row.total} />
          ))}
        </section>

        <section className="space-y-2 rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl">
          <h2 className="font-kids text-2xl">每题回顾 Review</h2>
          <ol className="space-y-2">
            {answers.map((a, i) => {
              const q = byId.get(a.question_id);
              if (!q) return null;
              const icon = a.is_correct === 1 ? "✅" : a.is_correct === 0 ? "❌" : "⬜";
              const right = q.choices[q.correct_index];
              return (
                <li key={a.id} className="flex items-start gap-2 rounded-2xl bg-[#fffdf5] p-3">
                  <span aria-hidden="true">{icon}</span>
                  <div className="min-w-0 text-sm">
                    <p className="font-bold">{i + 1}. {q.text_zh}</p>
                    <p className="text-cocoa/60">
                      正确答案 Correct: {["A", "B", "C"][q.correct_index]} · {right.zh}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="flex justify-center gap-4 pb-8">
          <Link href="/exam" className="rounded-full bg-sunny px-8 py-4 font-kids text-xl text-white shadow-lg">再考一次 Again</Link>
          <Link href="/" className="rounded-full bg-white px-8 py-4 font-kids text-xl shadow">回家 Home</Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
预期：构建成功，出现 `/exam` 与 `/exam/report/[id]` 路由。

- [ ] **Step 4: 提交**

```bash
git add src/app/exam/
git commit -m "feat: 模拟考试页（75 分钟倒计时/题号导航/标记/交卷）与服务端报告页"
```

---

### Task 12: 错题本

**Files:**
- Modify: `src/lib/questions.ts`（追加 `getMistakeQuestions`）
- Create: `src/app/api/mistakes/route.ts`, `src/app/mistakes/page.tsx`
- Test: `tests/mistakes.test.ts`

**Interfaces:**
- Produces: `getMistakeQuestions(db): Question[]` — 每题**最近一次**作答为错的题目（按最近作答时间倒序）；`GET /api/mistakes` → `{ questions }`
- 错题本重做：答对写入新的 practice answer（最新记录变为正确 → 自动移出错题本）

- [ ] **Step 1: 写失败测试**

创建 `tests/mistakes.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { addPracticeAnswer } from "@/lib/answers";
import { openDb } from "@/lib/db";
import { getMistakeQuestions } from "@/lib/questions";
import { createSession } from "@/lib/sessions";

function setup() {
  const db = openDb(":memory:");
  const insert = db.prepare(
    `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en)
     VALUES (3, 'counting', '题', 'q', '[]', 1, '解', 'a')`
  );
  const q1 = Number(insert.run().lastInsertRowid);
  const q2 = Number(insert.run().lastInsertRowid);
  const q3 = Number(insert.run().lastInsertRowid);
  const sid = createSession(db, "practice", 1);
  return { db, sid, q1, q2, q3 };
}

describe("getMistakeQuestions", () => {
  it("includes questions whose latest attempt is wrong", () => {
    const { db, sid, q2 } = setup();
    addPracticeAnswer(db, sid, q2, 0, false, 5, 100);
    expect(getMistakeQuestions(db).map((m) => m.id)).toEqual([q2]);
  });

  it("removes a question after a later correct retry", () => {
    const { db, sid, q2 } = setup();
    addPracticeAnswer(db, sid, q2, 0, false, 5, 100);
    addPracticeAnswer(db, sid, q2, 1, true, 6, 200);
    expect(getMistakeQuestions(db)).toEqual([]);
  });

  it("never lists a question answered correctly first time", () => {
    const { db, sid, q1 } = setup();
    addPracticeAnswer(db, sid, q1, 1, true, 5, 100);
    expect(getMistakeQuestions(db)).toEqual([]);
  });

  it("lists a question again if a later attempt is wrong", () => {
    const { db, sid, q3 } = setup();
    addPracticeAnswer(db, sid, q3, 1, true, 5, 100);
    addPracticeAnswer(db, sid, q3, 0, false, 5, 200);
    expect(getMistakeQuestions(db).map((m) => m.id)).toEqual([q3]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/mistakes.test.ts`
预期：FAIL，`getMistakeQuestions` 未导出。

- [ ] **Step 3: 在 src/lib/questions.ts 末尾追加**

```ts
export function getMistakeQuestions(db: Database): Question[] {
  const rows = db
    .prepare(
      `SELECT q.*
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       WHERE a.id IN (SELECT MAX(id) FROM answers GROUP BY question_id)
         AND a.is_correct = 0
       ORDER BY a.id DESC`
    )
    .all() as QuestionRow[];
  return rows.map(rowToQuestion);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/mistakes.test.ts`
预期：PASS，4 个测试通过。

- [ ] **Step 5: 创建 src/app/api/mistakes/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getMistakeQuestions } from "@/lib/questions";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ questions: getMistakeQuestions(getDb()) });
}
```

- [ ] **Step 6: 创建 src/app/mistakes/page.tsx**

```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { ChoiceButton, type ChoiceVariant } from "@/components/quiz/ChoiceButton";
import { Confetti } from "@/components/quiz/Confetti";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import type { Question } from "@/lib/types";

type Result = "correct" | "wrong" | null;

export default function MistakesPage() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<Result>(null);

  useEffect(() => {
    void (async () => {
      const [mRes, sRes] = await Promise.all([
        fetch("/api/mistakes"),
        fetch("/api/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "practice" }),
        }),
      ]);
      const m = (await mRes.json()) as { questions: Question[] };
      const s = (await sRes.json()) as { id: number };
      setQuestions(m.questions);
      setSessionId(s.id);
    })();
  }, []);

  const pick = useCallback(
    async (i: number) => {
      if (result !== null || sessionId === null || questions === null) return;
      const q = questions[index];
      setPicked(i);
      const correct = i === q.correct_index;
      await fetch("/api/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, questionId: q.id, chosenIndex: i, timeSpentSeconds: 0 }),
      });
      setResult(correct ? "correct" : "wrong");
    },
    [index, questions, result, sessionId]
  );

  const next = useCallback(() => {
    setIndex((v) => v + 1);
    setPicked(null);
    setResult(null);
  }, []);

  const q = questions?.[index];

  const variantFor = (i: number): ChoiceVariant => {
    if (result === "wrong") return q && i === q.correct_index ? "correct" : i === picked ? "wrong" : "dimmed";
    if (result === "correct") return i === picked ? "correct" : "dimmed";
    return "idle";
  };

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <header className="mb-5 flex items-center justify-between">
          <Link href="/" className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">← 回家 Home</Link>
          <h1 className="font-kids text-3xl">错题本 Mistakes</h1>
          <span className="w-24" aria-hidden="true" />
        </header>

        {questions === null && (
          <div className="flex flex-col items-center gap-4 py-20">
            <Kangaroo mood="idle" className="h-36 animate-idle-hop" />
            <p className="rounded-full bg-white/90 px-6 py-3 font-kids shadow">加载中…</p>
          </div>
        )}

        {questions !== null && (index >= questions.length) && (
          <div className="space-y-6 py-16 text-center">
            <Confetti />
            <Kangaroo mood="happy" className="mx-auto h-44 animate-idle-hop" />
            <h2 className="font-kids text-3xl">
              {questions.length === 0 ? "错题本是空的，太棒啦！" : "今天的错题都消灭啦！"}
            </h2>
            <p className="text-cocoa/70">No mistakes left. Great job!</p>
            <Link href="/" className="inline-block rounded-full bg-sunny px-8 py-4 font-kids text-2xl text-white shadow-lg">回家 Home</Link>
          </div>
        )}

        {q && (
          <div className="space-y-5">
            {result === "correct" && <Confetti />}
            <p className="text-center font-kids text-lg text-cocoa/70">
              第 {index + 1} / {questions.length} 道错题
            </p>
            <QuestionCard question={q}>
              <div className="space-y-3">
                {q.choices.map((c, i) => (
                  <ChoiceButton
                    key={i}
                    index={i}
                    zh={c.zh}
                    en={c.en}
                    variant={variantFor(i)}
                    disabled={result !== null}
                    onSelect={(i2) => void pick(i2)}
                  />
                ))}
              </div>
              {result !== null && (
                <div className="mt-4 animate-pop space-y-3">
                  {result === "correct" ? (
                    <p className="rounded-2xl bg-grass/25 p-3 text-center font-kids text-xl">答对啦，移出错题本！+1⭐</p>
                  ) : (
                    <p className="rounded-2xl bg-coral/15 p-3 text-center font-kids text-lg">还是不对哦，看看解析吧！</p>
                  )}
                  <div className="rounded-2xl border-4 border-cocoa/10 bg-[#fffdf5] p-4">
                    <p className="font-bold">💡 {q.explanation_zh}</p>
                    <p className="mt-1 text-sm text-cocoa/60">{q.explanation_en}</p>
                  </div>
                  <button
                    type="button"
                    onClick={next}
                    className="w-full rounded-full bg-sunny p-4 font-kids text-2xl text-white shadow-lg active:translate-y-1"
                  >
                    下一题 Next →
                  </button>
                </div>
              )}
            </QuestionCard>
            <div className="flex justify-center">
              <Kangaroo mood={result === "correct" ? "happy" : result === "wrong" ? "sad" : "idle"} className="h-28" />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 7: 构建验证**

Run: `npm run build`
预期：构建成功，出现 `/mistakes`、`/api/mistakes`。

- [ ] **Step 8: 提交**

```bash
git add src/lib/questions.ts src/app/api/mistakes/ src/app/mistakes/ tests/mistakes.test.ts
git commit -m "feat: 错题本 — 按最近作答派生错题、重做答对即移出"
```

---

### Task 13: 星星派生、家长统计与图表

**Files:**
- Create: `src/lib/stats.ts`, `src/app/api/stats/route.ts`, `src/app/stars/page.tsx`, `src/app/parents/page.tsx`, `src/components/quiz/RadarChart.tsx`, `src/components/quiz/ScoreCurve.tsx`
- Test: `tests/stats.test.ts`

**Interfaces:**
- Produces:
  - `TOPIC_LABELS: Record<Topic, string>`
  - `computeStars(db): { stars: number; firstCorrect: number; totalCorrect: number }`（首次答对 +3，之后答对 +1）
  - `computeStreak(db, now?: Date): number`（允许今天尚未打卡时从昨天续接）
  - `interface Stats { stars; totalCorrect; perTopic: { topic; label; correct; total }[]; examScores: { id; score; maxScore; finishedAt }[]; streakDays; activeDays; lastExam: SessionRow | null }`
  - `getStats(db, now?: Date): Stats`
  - `<RadarChart data: { label: string; value: number }[] />`（value 0..1，纯 SVG 六轴）
  - `<ScoreCurve points: { label: string; score: number; max: number }[] />`（纯 SVG 折线，满分 120 刻度）

- [ ] **Step 1: 写失败测试**

创建 `tests/stats.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { addPracticeAnswer } from "@/lib/answers";
import { openDb } from "@/lib/db";
import { createSession } from "@/lib/sessions";
import { computeStars, computeStreak } from "@/lib/stats";

function insertQ(db: ReturnType<typeof openDb>): number {
  return Number(
    db
      .prepare(
        `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en)
         VALUES (3, 'counting', '题', 'q', '[]', 1, '解', 'a')`
      )
      .run().lastInsertRowid
  );
}

function dayMs(daysAgo: number, now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12, 0, 0).getTime();
}

describe("computeStars", () => {
  it("first correct = 3 stars, each later correct = 1 star", () => {
    const db = openDb(":memory:");
    const q1 = insertQ(db);
    const q2 = insertQ(db);
    const sid = createSession(db, "practice", 1);
    addPracticeAnswer(db, sid, q1, 0, false, 5, 100);
    addPracticeAnswer(db, sid, q1, 1, true, 5, 110); // first correct q1 → +3
    addPracticeAnswer(db, sid, q2, 1, true, 5, 120); // first correct q2 → +3
    addPracticeAnswer(db, sid, q1, 1, true, 5, 130); // repeat q1 → +1
    expect(computeStars(db).stars).toBe(7);
  });

  it("no answers means zero stars", () => {
    const db = openDb(":memory:");
    expect(computeStars(db).stars).toBe(0);
  });
});

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    const db = openDb(":memory:");
    const now = new Date(2026, 6, 28, 15, 0, 0);
    const q = insertQ(db);
    const sid = createSession(db, "practice", 1);
    addPracticeAnswer(db, sid, q, 1, true, 5, dayMs(0, now));
    addPracticeAnswer(db, sid, q, 1, true, 5, dayMs(1, now));
    addPracticeAnswer(db, sid, q, 1, true, 5, dayMs(2, now));
    expect(computeStreak(db, now)).toBe(3);
  });

  it("keeps the streak alive via yesterday when today is quiet", () => {
    const db = openDb(":memory:");
    const now = new Date(2026, 6, 28, 9, 0, 0);
    const q = insertQ(db);
    const sid = createSession(db, "practice", 1);
    addPracticeAnswer(db, sid, q, 1, true, 5, dayMs(1, now));
    addPracticeAnswer(db, sid, q, 1, true, 5, dayMs(2, now));
    expect(computeStreak(db, now)).toBe(2);
  });

  it("returns 0 when the streak is broken", () => {
    const db = openDb(":memory:");
    const now = new Date(2026, 6, 28, 9, 0, 0);
    const q = insertQ(db);
    const sid = createSession(db, "practice", 1);
    addPracticeAnswer(db, sid, q, 1, true, 5, dayMs(3, now));
    expect(computeStreak(db, now)).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/stats.test.ts`
预期：FAIL，找不到模块 `@/lib/stats`。

- [ ] **Step 3: 实现 src/lib/stats.ts**

```ts
import type { Database } from "better-sqlite3";
import { getFinishedExamSessions, type SessionRow } from "./sessions";
import type { Topic } from "./types";

export const TOPIC_LABELS: Record<Topic, string> = {
  counting: "数数",
  shapes: "图形",
  patterns: "规律",
  logic: "逻辑",
  arithmetic: "计算",
  time: "时间",
};

export interface Stats {
  stars: number;
  totalCorrect: number;
  perTopic: { topic: Topic; label: string; correct: number; total: number }[];
  examScores: { id: number; score: number; maxScore: number; finishedAt: number }[];
  streakDays: number;
  activeDays: number;
  lastExam: SessionRow | null;
}

export function computeStars(db: Database): {
  stars: number;
  firstCorrect: number;
  totalCorrect: number;
} {
  const first = db
    .prepare(
      `SELECT COUNT(*) AS n FROM answers a
       WHERE a.is_correct = 1
         AND a.id = (SELECT MIN(b.id) FROM answers b WHERE b.question_id = a.question_id AND b.is_correct = 1)`
    )
    .get() as { n: number };
  const total = db
    .prepare("SELECT COUNT(*) AS n FROM answers WHERE is_correct = 1")
    .get() as { n: number };
  const firstCorrect = first.n;
  return { stars: firstCorrect * 3 + (total.n - firstCorrect), firstCorrect, totalCorrect: total.n };
}

export function computeStreak(db: Database, now: Date = new Date()): number {
  const rows = db
    .prepare("SELECT DISTINCT date(created_at / 1000, 'unixepoch', 'localtime') AS d FROM answers")
    .all() as { d: string }[];
  const days = new Set(rows.map((r) => r.d));
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(fmt(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getStats(db: Database, now: Date = new Date()): Stats {
  const { stars, totalCorrect } = computeStars(db);
  const perTopic = (Object.keys(TOPIC_LABELS) as Topic[]).map((topic) => {
    const row = db
      .prepare(
        `SELECT SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) AS correct, COUNT(*) AS total
         FROM answers a JOIN questions q ON q.id = a.question_id
         WHERE q.topic = ? AND a.chosen_index IS NOT NULL`
      )
      .get(topic) as { correct: number | null; total: number };
    return { topic, label: TOPIC_LABELS[topic], correct: row.correct ?? 0, total: row.total };
  });
  const finished = getFinishedExamSessions(db);
  const examScores = finished.map((s) => ({
    id: s.id,
    score: s.score ?? 0,
    maxScore: s.max_score ?? 120,
    finishedAt: s.finished_at ?? 0,
  }));
  const activeDays = (
    db
      .prepare("SELECT COUNT(DISTINCT date(created_at / 1000, 'unixepoch', 'localtime')) AS n FROM answers")
      .get() as { n: number }
  ).n;
  return {
    stars,
    totalCorrect,
    perTopic,
    examScores,
    streakDays: computeStreak(db, now),
    activeDays,
    lastExam: finished.length > 0 ? finished[finished.length - 1] : null,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/stats.test.ts`
预期：PASS，5 个测试通过。

- [ ] **Step 5: 创建 src/app/api/stats/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getStats(getDb()));
}
```

- [ ] **Step 6: 创建 src/components/quiz/RadarChart.tsx**

```tsx
export function RadarChart({ data }: { data: { label: string; value: number }[] }) {
  const n = data.length;
  const cx = 110;
  const cy = 110;
  const R = 80;
  const point = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  return (
    <svg viewBox="0 0 220 220" className="mx-auto w-72">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={data.map((_, i) => point(i, R * f).join(",")).join(" ")}
          fill="none"
          stroke="#5c4033"
          strokeOpacity={0.15}
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#5c4033" strokeOpacity={0.15} />;
      })}
      <polygon
        points={data.map((d, i) => point(i, R * Math.max(0.04, d.value)).join(",")).join(" ")}
        fill="#ff9f45"
        fillOpacity={0.35}
        stroke="#ff9f45"
        strokeWidth={2.5}
      />
      {data.map((d, i) => {
        const [x, y] = point(i, R + 18);
        return (
          <text key={d.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#5c4033">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 7: 创建 src/components/quiz/ScoreCurve.tsx**

```tsx
export function ScoreCurve({
  points,
}: {
  points: { label: string; score: number; max: number }[];
}) {
  if (points.length === 0) {
    return <p className="py-8 text-center text-cocoa/60">还没有考试记录 No exam records yet</p>;
  }
  const W = 320;
  const H = 160;
  const pad = 30;
  const x = (i: number) =>
    pad + (points.length === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (points.length - 1));
  const y = (s: number) => H - pad - (s / 120) * (H - 2 * pad);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.score)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#5c4033" strokeOpacity={0.3} />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#5c4033" strokeOpacity={0.3} />
      <text x={pad - 4} y={y(120) + 4} textAnchor="end" fontSize="10" fill="#5c4033">120</text>
      <text x={pad - 4} y={y(60) + 4} textAnchor="end" fontSize="10" fill="#5c4033">60</text>
      <path d={line} fill="none" stroke="#ef6351" strokeWidth={3} strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.score)} r={4} fill="#ff9f45" stroke="#ffffff" strokeWidth={1.5} />
          <text x={x(i)} y={H - pad + 14} textAnchor="middle" fontSize="9" fill="#5c4033">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
```

- [ ] **Step 8: 创建 src/app/stars/page.tsx**

```tsx
import Link from "next/link";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { StarJar } from "@/components/quiz/StarJar";
import { getDb } from "@/lib/db";
import { computeStars, computeStreak } from "@/lib/stats";

export const dynamic = "force-dynamic";

const BADGES = [
  { at: 30, emoji: "🥉", zh: "铜牌探险家", en: "Bronze Explorer" },
  { at: 100, emoji: "🥈", zh: "银牌探险家", en: "Silver Explorer" },
  { at: 300, emoji: "🥇", zh: "金牌探险家", en: "Gold Explorer" },
  { at: 600, emoji: "🏆", zh: "传奇袋鼠", en: "Legend Kangaroo" },
];

export default function StarsPage() {
  const db = getDb();
  const { stars } = computeStars(db);
  const streak = computeStreak(db);
  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 text-center">
        <header className="flex items-center justify-between">
          <Link href="/" className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">← 回家 Home</Link>
          <h1 className="font-kids text-3xl">我的星星 My Stars</h1>
          <span className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">🔥 {streak} 天</span>
        </header>
        <div className="flex items-center justify-center gap-8">
          <StarJar stars={stars} />
          <Kangaroo mood={stars > 0 ? "happy" : "idle"} className="h-36 animate-idle-hop" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {BADGES.map((b) => {
            const lit = stars >= b.at;
            return (
              <div
                key={b.at}
                className={`rounded-3xl border-4 p-4 ${lit ? "border-gold bg-gold/30" : "border-cocoa/10 bg-white/50 opacity-60 grayscale"}`}
              >
                <div className="text-4xl">{b.emoji}</div>
                <div className="font-kids">{b.zh}</div>
                <div className="text-xs text-cocoa/60">{lit ? b.en : `还差 ${b.at - stars} ⭐`}</div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 9: 创建 src/app/parents/page.tsx**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { RadarChart } from "@/components/quiz/RadarChart";
import { ScoreCurve } from "@/components/quiz/ScoreCurve";

interface StatsPayload {
  stars: number;
  totalCorrect: number;
  perTopic: { topic: string; label: string; correct: number; total: number }[];
  examScores: { id: number; score: number; maxScore: number; finishedAt: number }[];
  streakDays: number;
  activeDays: number;
}

function makeGate() {
  const a = 12 + Math.floor(Math.random() * 20);
  const b = 7 + Math.floor(Math.random() * 20);
  return { a, b, answer: a + b };
}

function StatTile({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <div className="rounded-3xl border-4 border-cocoa/10 bg-white/90 p-4 text-center shadow">
      <div className="text-3xl">{emoji}</div>
      <div className="font-kids text-3xl">{value}</div>
      <div className="text-xs text-cocoa/60">{label}</div>
    </div>
  );
}

export default function ParentsPage() {
  const [gate, setGate] = useState(makeGate);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [stats, setStats] = useState<StatsPayload | null>(null);

  useEffect(() => {
    if (!unlocked) return;
    void fetch("/api/stats")
      .then((r) => r.json())
      .then((s: StatsPayload) => setStats(s));
  }, [unlocked]);

  const radarData = useMemo(() => {
    if (!stats) return [];
    return stats.perTopic.map((t) => ({
      label: t.label,
      value: t.total === 0 ? 0 : t.correct / t.total,
    }));
  }, [stats]);

  const curveData = useMemo(() => {
    if (!stats) return [];
    return stats.examScores.slice(-10).map((e) => ({ label: `#${e.id}`, score: e.score, max: e.maxScore }));
  }, [stats]);

  if (!unlocked) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <OutbackBackground />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (Number(input) === gate.answer) {
              setUnlocked(true);
            } else {
              setError(true);
              setGate(makeGate());
              setInput("");
            }
          }}
          className="w-full max-w-sm rounded-[2rem] border-4 border-cocoa/10 bg-white/95 p-8 text-center shadow-xl"
        >
          <div className="text-4xl">🔒</div>
          <h1 className="mt-2 font-kids text-2xl">家长入口 Parents Gate</h1>
          <p className="mt-1 text-sm text-cocoa/60">算一算才能进来（防止小朋友误触）</p>
          <p className="mt-4 font-kids text-3xl">
            {gate.a} + {gate.b} = ？
          </p>
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            inputMode="numeric"
            aria-label="密码答案"
            className="mt-4 w-32 rounded-2xl border-4 border-cocoa/15 p-3 text-center font-kids text-2xl focus:border-sunny focus:outline-none"
          />
          {error && <p className="mt-2 text-sm text-coral">不对哦，换一题再试！</p>}
          <button type="submit" className="mt-4 w-full rounded-full bg-sunny p-3 font-kids text-xl text-white shadow">
            进入 Enter
          </button>
          <Link href="/" className="mt-3 block text-sm text-cocoa/50 underline">← 回首页 Home</Link>
        </form>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <OutbackBackground />
        <p className="rounded-full bg-white/90 px-6 py-3 font-kids shadow">加载中…</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <header className="flex items-center justify-between">
          <h1 className="font-kids text-3xl">家长面板 Dashboard</h1>
          <Link href="/" className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">← 回首页 Home</Link>
        </header>
        <section className="grid grid-cols-3 gap-3">
          <StatTile emoji="⭐" value={stats.stars} label="星星 Stars" />
          <StatTile emoji="🔥" value={stats.streakDays} label="连续天数 Streak" />
          <StatTile emoji="🗓️" value={stats.activeDays} label="活跃天数 Active" />
        </section>
        <section className="rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl">
          <h2 className="font-kids text-2xl">题型正确率 Accuracy by topic</h2>
          <RadarChart data={radarData} />
        </section>
        <section className="rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl">
          <h2 className="font-kids text-2xl">考试分数曲线 Exam scores</h2>
          <ScoreCurve points={curveData} />
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 10: 构建验证**

Run: `npm run build`
预期：构建成功，出现 `/stars`、`/parents`、`/api/stats`。

- [ ] **Step 11: 提交**

```bash
git add src/lib/stats.ts src/app/api/stats/ src/app/stars/ src/app/parents/ src/components/quiz/RadarChart.tsx src/components/quiz/ScoreCurve.tsx tests/stats.test.ts
git commit -m "feat: 星星/连续天数派生、家长统计面板（算术门+雷达图+分数曲线）与星星页"
```

---

### Task 14: 首页冒险地图 + README + 最终验证

**Files:**
- Modify: `src/app/page.tsx`（替换 Task 8 的占位首页）
- Create: `README.md`

**Interfaces:**
- Consumes: `computeStars`、`computeStreak`、`Kangaroo`、`OutbackBackground`
- 首页：顶部连续天数 + 星星总数；袋鼠 + 对话框；四个站点卡片（练习/考试/错题本/星星）；底部家长入口链接

- [ ] **Step 1: 替换 src/app/page.tsx**

```tsx
import Link from "next/link";
import { Kangaroo } from "@/components/mascot/Kangaroo";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { getDb } from "@/lib/db";
import { computeStars, computeStreak } from "@/lib/stats";

export const dynamic = "force-dynamic";

const STATIONS = [
  { href: "/practice", emoji: "🏃", zh: "闯关练习", en: "Practice", tint: "border-sunny bg-sunny/20" },
  { href: "/exam", emoji: "📝", zh: "模拟考试", en: "Mock Exam", tint: "border-coral bg-coral/15" },
  { href: "/mistakes", emoji: "📒", zh: "错题本", en: "Mistakes", tint: "border-grass bg-grass/20" },
  { href: "/stars", emoji: "⭐", zh: "我的星星", en: "My Stars", tint: "border-gold bg-gold/30" },
];

export default function Home() {
  const db = getDb();
  const { stars } = computeStars(db);
  const streak = computeStreak(db);
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <OutbackBackground />
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-8">
        <header className="flex items-center justify-between gap-2">
          <h1 className="font-kids text-3xl sm:text-4xl">跳跳的数学冒险</h1>
          <div className="flex gap-2">
            <span className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">🔥 {streak} 天</span>
            <span className="rounded-full bg-gold/90 px-4 py-2 font-kids shadow">⭐ {stars}</span>
          </div>
        </header>

        <section className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-center">
          <Kangaroo mood="happy" className="h-48 animate-idle-hop" />
          <div className="relative max-w-sm rounded-3xl border-4 border-cocoa/10 bg-white/90 p-5 shadow-xl">
            <p className="font-kids text-xl leading-relaxed">
              你好呀！我是跳跳 🦘<br />
              今天想去哪里冒险？
            </p>
            <p className="mt-1 text-sm text-cocoa/60">Hi! I am Tiao Tiao. Where to today?</p>
          </div>
        </section>

        <nav className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {STATIONS.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className={`rounded-[2rem] border-4 p-6 shadow-lg backdrop-blur transition hover:-translate-y-1 hover:shadow-xl active:translate-y-0 ${s.tint} ${i % 2 === 0 ? "sm:-rotate-1" : "sm:rotate-1"}`}
            >
              <div className="text-5xl">{s.emoji}</div>
              <div className="mt-2 font-kids text-2xl">{s.zh}</div>
              <div className="text-sm text-cocoa/60">{s.en}</div>
            </Link>
          ))}
        </nav>

        <footer className="mt-12 text-center">
          <Link href="/parents" className="text-sm text-cocoa/50 underline">
            家长入口 · Parents
          </Link>
        </footer>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 创建 README.md**

```markdown
# 跳跳的数学冒险 🦘 — 袋鼠数学竞赛练习网站

为 6-8 岁（1-2 年级）孩子准备的袋鼠数学竞赛（Math Kangaroo Level 1-2）双语练习网站。

## 功能

- 🏃 **闯关练习**：6 大题型 + 随机混合，每题两次作答机会，即时动画反馈与双语解析，🔊 中文读题
- 📝 **模拟考试**：还原官方赛制（24 题 / 75 分钟 / 起始 24 分 / 答对 +3·+4·+5 / 答错 −1 / 不答 0 / 满分 120）
- 📒 **错题本**：自动收录错题，重做答对即移出
- ⭐ **星星与徽章**：首次答对 +3⭐，再次答对 +1⭐，里程碑徽章
- 📊 **家长面板**：算术密码门，题型正确率雷达图、考试分数曲线、连续打卡天数

## 快速开始

    npm install
    npm run seed     # 导入题库（54 道双语题）→ data/quiz.db
    npm run dev      # 打开 http://localhost:3000

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build && npm start` | 生产模式 |
| `npm test` | 运行 Vitest 测试 |
| `npm run seed` | 重新导入题库 |

## 添加/修改题目

编辑 `questions/` 目录下的 JSON 文件（每主题一个文件），然后运行 `npm run seed`。
每题必须包含：`difficulty`（3/4/5）、`topic`、双语题干（`text_zh`/`text_en`）、
恰好 3 个双语选项（`choices`）、`correct_index`（0/1/2）、双语解析。
`illustration` 可选：`emoji:🍎🍎`、`svg:clock:6:30`、`svg:grid`、`svg:diagsquare`。

> ⚠️ 重新 seed 会清空作答历史（题目 ID 会变化），星星与错题本随之重置。

## 技术栈

Next.js 15（App Router）· TypeScript · Tailwind CSS v4 · better-sqlite3（SQLite）· Vitest。
无图表库/动画库，全部手写 CSS + SVG。数据仅保存在本地 `data/quiz.db`，备份该文件即可。

## 部署到平板

- 局域网：`npm run dev -- -H 0.0.0.0`，平板访问 `http://<电脑IP>:3000`
- 公网：部署到 Vercel 免费方案；注意 Vercel 函数环境对 better-sqlite3 的写入限制，
  家庭长期使用建议跑在家里电脑或一台小服务器上

## 说明

题目为按袋鼠数学竞赛题型风格原创编写（官方真题受 Kangourou Sans Frontières 版权保护）。
官方样题与规则参考：<https://mathkangaroo.org/mks/faqs/about-the-test/> · <https://en.math-kangaroo.org.cn/>
```

- [ ] **Step 3: 运行全部单元测试**

Run: `npm test`
预期：全部 PASS（db / scoring / format / validate / seed / questions / answers / mistakes / stats / illustration / smoke，共 11 个文件）。

- [ ] **Step 4: 重新 seed 并构建**

Run: `npm run seed && npm run build`
预期：`已导入 54 道题目`；构建成功，所有页面与 API 路由出现在输出中。

- [ ] **Step 5: 启动开发服务器做接口冒烟**

```bash
npm run dev > /tmp/quiz-dev.log 2>&1 &
sleep 8
```

依次验证（每条都检查返回 JSON 结构）：

```bash
curl -s "http://localhost:3000/api/questions?topic=counting&limit=3"
```
预期：`questions` 数组长度 3，每题含双语题干与 3 个选项。

```bash
curl -s -X POST http://localhost:3000/api/exam
```
预期：`sessionId` + `minutes: 75` + `questions` 长度 24（难度分布 8/8/8）。记下 `sessionId` 与前几题的 `id`/`correct_index`。

用上一步的 `sessionId` 与一道题的 `id` 作答一题（`chosenIndex` 任选）：

```bash
curl -s -X POST http://localhost:3000/api/answers -H "content-type: application/json" \
  -d '{"sessionId": <SID>, "questionId": <QID>, "chosenIndex": 0, "mode": "exam", "timeSpentSeconds": 12}'
```
预期：`{"ok":true,"isCorrect":...}`。

```bash
curl -s -X POST http://localhost:3000/api/sessions/<SID>/finish -H "content-type: application/json" -d '{"durationSeconds": 60}'
```
预期：`score` = 24 +（答对题分值或 0）−（答错数），其余 23 题为 blank。

```bash
curl -s http://localhost:3000/api/mistakes
curl -s http://localhost:3000/api/stats
```
预期：均返回合法 JSON（stats 含 stars/streakDays/perTopic/examScores）。

结束后停止开发服务器：

```bash
pkill -f "next dev" || true
```

- [ ] **Step 6: 手动测试清单（浏览器过一遍）**

启动 `npm run dev`，在浏览器（最好再用平板尺寸的设备模拟）逐项确认：

- [ ] 首页：云朵漂移、袋鼠蹦跳、四个站点卡片可点，顶部显示星星/连续天数
- [ ] 练习：选题 → 故意答错一次 → 出现鼓励且**不**公布答案 → 第二次可再答；答对出现彩带 + 星星 +「下一题」；第二次答错公布正确答案与双语解析
- [ ] 🔊 按钮朗读中文题干（Chrome/Edge 生效）
- [ ] 考试：倒计时走动、题号点导航、标记按钮、交卷确认弹层；答几题后交卷 → 报告页总分/难度条/题型条/每题回顾正常
- [ ] 错题本：刚才答错的题出现；答对后「下一题」，全部清完显示空状态
- [ ] 星星页：星星数与罐子填充正确，徽章未达成显示灰色与差额
- [ ] 家长页：算术门答错会换题、答对进入；雷达图与分数曲线渲染（至少有一次考试记录）
- [ ] 触屏尺寸下选项按钮足够大（≥48px 高）、无横向滚动

- [ ] **Step 7: 提交**

```bash
git add src/app/page.tsx README.md
git commit -m "feat: 首页冒险地图与 README，完成全站功能"
```

---

## Self-Review 备注

- **规格覆盖**：首页/练习/考试/报告/错题本/星星/家长面板/题库/校验/计分/读题/动画/手动清单均有对应任务 ✓
- **类型一致性**：`ChoiceVariant`（Task 9 定义含 `"selected"`，Task 11 使用）、`FinishStats`/`finishSession`（Task 7 定义并使用）、`rowToQuestion`/`QuestionRow`（Task 6 定义，Task 12 复用）、`computeStars`/`computeStreak`（Task 13 定义，Task 14 使用）均一致 ✓
- **已知取舍**：报告页与家长页各有一份主题中文标签映射（报告页为服务端组件独立内联，属有意为之的小重复）；重新 seed 会清空历史（README 已警示）
