# 模拟考试官方样题库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把模拟考试与闯关练习的题库彻底分开——考试用官方公开样题（`source='official'`）为主、原创仿真题（`source='simulation'`）按难度补齐；练习仍用现有原创题（`source='practice'`）。

**Architecture:** 单张 `questions` 表新增 `source`/`attribution` 两列；题目按 `questions/{practice,official,simulation}/` 三个子目录组织，seed 按目录写入 source；考试选题「官方优先→仿真补齐→放宽去重兜底」；来源仅在考试报告与家长面板可见。

**Tech Stack:** Next.js 15 (App Router) · TypeScript · better-sqlite3 (SQLite) · Vitest · Tailwind CSS v4。无新增依赖。

## Global Constraints

- **来源仅限官方**：官方题只取自 Math Kangaroo 官方公开发布材料（mathkangaroo.org 历年样卷、mathkangaroo.in 的 G1-2 卷），**不**抓取第三方题库。
- **版权署名**：官方题须写 `attribution`；README 与家长面板须有署名行，注明 Kangourou Sans Frontières 版权、仅供个人练习。
- **题库零重叠**：练习只取 `source='practice'`；考试只取 `source IN ('official','simulation')`。错题本（`getMistakeQuestions`）**保持现状**——它按作答记录回放任意模式的错题，不属于「练习/考试题库分离」范畴，**不要**给它加 source 过滤。
- **考试不变量**：仿真库每难度（3/4/5）≥ 8 题，保证每卷满 24 题。兜底分支**不在同一卷内重复同一题**，仅在去重导致不足时放宽「上次考试排除」。
- **schema 兼容**：`source` 带 `DEFAULT 'practice'`，旧库与既有测试中不带 source 的 INSERT 仍可用；`openDb` 迁移幂等。
- **内容格式**：每题恰好 3 个双语选项、`correct_index ∈ {0,1,2}`、`difficulty ∈ {3,4,5}`、`topic ∈ {counting,shapes,patterns,logic,arithmetic,time}`、双语题干与解析（沿用 `src/lib/validate.ts` 校验）。
- **提交纪律**：工作区存在与本特性无关的未提交改动；每个任务的 `git add` **只加该任务列出的文件**，绝不 `git add -A`。

---

## File Structure

| 文件 | 责任 | 操作 |
|------|------|------|
| `src/lib/db.ts` | `questions` 表加 `source`/`attribution`；`openDb` 幂等迁移 | Modify |
| `src/lib/types.ts` | `Source` 类型；`Question`/`RawQuestion` 增字段 | Modify |
| `src/lib/questions.ts` | `rowToQuestion` 映射新字段；练习加 source 过滤；考试官方优先/仿真补齐；`examComposition` 统计 | Modify |
| `src/lib/validate.ts` | 允许可选 `attribution` | Modify |
| `src/scripts/seed.ts` | 遍历三子目录、按目录写 source、透传 attribution、容忍空/缺失可选目录、按难度预警 | Modify |
| `src/components/quiz/Illustration.tsx` | 新增 `svg:dice` / `svg:bars` 原语 | Modify |
| `src/app/exam/report/[id]/page.tsx` | 显示本卷官方/仿真构成 + 署名脚注 | Modify |
| `src/app/parents/page.tsx` | 署名脚注 | Modify |
| `README.md` | 子目录说明 + 署名 | Modify |
| `questions/*.json` → `questions/practice/*.json` | 现有 6 个原创题文件迁入 practice 子目录 | Move |
| `questions/official/*.json` | 官方样题（转录） | Create |
| `questions/simulation/*.json` | 原创仿真题 | Create |
| `tests/db.test.ts` / `tests/validate.test.ts` / `tests/seed.test.ts` / `tests/questions.test.ts` / `tests/illustration.test.ts` | 对应测试 | Modify |

---

## Task 1: Schema、迁移与类型

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/questions.ts`（`QuestionRow` 与 `rowToQuestion`）
- Test: `tests/db.test.ts`

**Interfaces:**
- Produces: `questions` 表含 `source TEXT NOT NULL DEFAULT 'practice' CHECK(...)` 与 `attribution TEXT`；`openDb(path)` 对旧库幂等补列；类型 `Source = "practice" | "official" | "simulation"`；`Question.source: Source`、`Question.attribution: string | null`；`QuestionRow.source: string`、`QuestionRow.attribution: string | null`；`rowToQuestion` 映射二者。

- [ ] **Step 1: 写失败测试（列存在 + CHECK + 迁移）**

在 `tests/db.test.ts` 顶部补充 import 并追加测试：

```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
```

```ts
  it("questions table has source and attribution columns", () => {
    const db = openDb(":memory:");
    const cols = db.prepare("PRAGMA table_info(questions)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["source", "attribution"]));
  });

  it("enforces the source CHECK constraint", () => {
    const db = openDb(":memory:");
    expect(() =>
      db
        .prepare(
          "INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en, source) VALUES (3, 'counting', 'z', 'e', '[]', 0, 'z', 'e', 'bogus')"
        )
        .run()
    ).toThrow();
  });

  it("defaults source to 'practice' when omitted", () => {
    const db = openDb(":memory:");
    const info = db
      .prepare(
        "INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en) VALUES (3, 'counting', 'z', 'e', '[]', 0, 'z', 'e')"
      )
      .run();
    const row = db
      .prepare("SELECT source, attribution FROM questions WHERE id = ?")
      .get(Number(info.lastInsertRowid)) as { source: string; attribution: string | null };
    expect(row.source).toBe("practice");
    expect(row.attribution).toBeNull();
  });

  it("migrates a legacy database by adding the new columns (idempotently)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiz-legacy-"));
    const file = path.join(dir, "legacy.db");
    // 用旧 schema（无 source/attribution）建库
    const legacy = new Database(file);
    legacy.exec(`
      CREATE TABLE questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        difficulty INTEGER NOT NULL,
        topic TEXT NOT NULL,
        text_zh TEXT NOT NULL,
        text_en TEXT NOT NULL,
        illustration TEXT,
        choices TEXT NOT NULL,
        correct_index INTEGER NOT NULL,
        explanation_zh TEXT NOT NULL,
        explanation_en TEXT NOT NULL
      );
      CREATE TABLE sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT, started_at INTEGER);
      CREATE TABLE answers (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER, question_id INTEGER);
    `);
    legacy.close();

    // openDb 应补上两列
    const db = openDb(file);
    let cols = (db.prepare("PRAGMA table_info(questions)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["source", "attribution"]));
    db.close();

    // 再开一次不报错（幂等）
    const db2 = openDb(file);
    cols = (db2.prepare("PRAGMA table_info(questions)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["source", "attribution"]));
    db2.close();
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/db.test.ts`
Expected: 新增 4 个用例 FAIL（列不存在 / 无迁移）。

- [ ] **Step 3: 实现 schema 与迁移（`src/lib/db.ts`）**

在 `SCHEMA` 的 `questions` 表定义中、`explanation_en TEXT NOT NULL` 之后加两列：

```sql
  source TEXT NOT NULL DEFAULT 'practice' CHECK (source IN ('practice', 'official', 'simulation')),
  attribution TEXT
```

在 `openDb` 内、`db.exec(SCHEMA)` 之后调用迁移：

```ts
export function openDb(dbPath: string): Database.Database {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  const cols = db.prepare("PRAGMA table_info(questions)").all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("source")) {
    db.exec(
      "ALTER TABLE questions ADD COLUMN source TEXT NOT NULL DEFAULT 'practice' CHECK (source IN ('practice', 'official', 'simulation'))"
    );
  }
  if (!names.has("attribution")) {
    db.exec("ALTER TABLE questions ADD COLUMN attribution TEXT");
  }
}
```

- [ ] **Step 4: 更新类型（`src/lib/types.ts`）**

```ts
export type Source = "practice" | "official" | "simulation";
export const SOURCES: Source[] = ["practice", "official", "simulation"];
```

`Question` 接口末尾新增两个字段：

```ts
  source: Source;
  attribution: string | null;
```

`RawQuestion` 改为（JSON 不含 source；attribution 可选）：

```ts
export type RawQuestion = Omit<Question, "id" | "source" | "attribution"> & {
  attribution?: string | null;
};
```

- [ ] **Step 5: 更新 `QuestionRow` 与 `rowToQuestion`（`src/lib/questions.ts`）**

`QuestionRow` 末尾加：

```ts
  source: string;
  attribution: string | null;
```

`rowToQuestion` 返回对象末尾加：

```ts
    source: r.source as Question["source"],
    attribution: r.attribution,
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run tests/db.test.ts`
Expected: 全部 PASS。再跑 `npx vitest run` 确认整体仍绿（既有 questions/seed 测试中不带 source 的 INSERT 走默认值，应不受影响）。

- [ ] **Step 7: 提交**

```bash
git add src/lib/db.ts src/lib/types.ts src/lib/questions.ts tests/db.test.ts
git commit -m "feat(db): questions 表增加 source/attribution 列与幂等迁移"
```

---

## Task 2: 子目录题库 + seed 按目录写 source + validate 支持 attribution

**Files:**
- Move: `questions/*.json` → `questions/practice/*.json`
- Modify: `src/scripts/seed.ts`
- Modify: `src/lib/validate.ts`
- Test: `tests/seed.test.ts`
- Test: `tests/validate.test.ts`

**Interfaces:**
- Consumes: `Source`、`RawQuestion.attribution?`（Task 1）。
- Produces: `runSeed(db, baseDir?)` 遍历 `practice/official/simulation` 三子目录，按目录写 `source`、透传 `attribution`；`practice` 缺失/为空报错，`official`/`simulation` 缺失或为空则跳过；`validateQuestion` 接受可选 `attribution`（非空字符串），`validateBank` 把缺省 `attribution` 归一为 `null`。

- [ ] **Step 1: 迁移现有题目到 practice 子目录**

```bash
mkdir -p questions/practice
git mv questions/arithmetic.json questions/practice/arithmetic.json
git mv questions/counting.json questions/practice/counting.json
git mv questions/logic.json questions/practice/logic.json
git mv questions/patterns.json questions/practice/patterns.json
git mv questions/shapes.json questions/practice/shapes.json
git mv questions/time.json questions/practice/time.json
```

- [ ] **Step 2: 写失败测试（validate 的 attribution）**

在 `tests/validate.test.ts` 追加：

```ts
  it("accepts an optional attribution string", () => {
    expect(validateQuestion({ ...good, attribution: "MK-USA 2024 G1-2 Q3" }, "q")).toEqual([]);
  });
  it("rejects a non-string attribution", () => {
    const errors = validateQuestion({ ...good, attribution: 5 }, "q");
    expect(errors.some((e) => e.includes("attribution"))).toBe(true);
  });
  it("rejects an empty attribution string", () => {
    const errors = validateQuestion({ ...good, attribution: "  " }, "q");
    expect(errors.some((e) => e.includes("attribution"))).toBe(true);
  });
```

在 `validateBank` 的 describe 中追加：

```ts
  it("normalizes a missing attribution to null", () => {
    const [q] = validateBank([good]);
    expect(q.attribution).toBeNull();
  });
  it("preserves a provided attribution", () => {
    const [q] = validateBank([{ ...good, attribution: "MK-IN G1-2 Q1" }]);
    expect(q.attribution).toBe("MK-IN G1-2 Q1");
  });
```

- [ ] **Step 3: 实现 validate 的 attribution（`src/lib/validate.ts`）**

在 `validateQuestion` 的 `illustration` 校验之后加：

```ts
  if (obj.attribution !== undefined && obj.attribution !== null) {
    if (typeof obj.attribution !== "string" || (obj.attribution as string).trim() === "") {
      errors.push(`${label}: attribution 必须是非空字符串（或省略）`);
    }
  }
```

`validateBank` 的归一化改为：

```ts
  return raw.map((q) => {
    const obj = q as Omit<RawQuestion, "illustration" | "attribution"> & {
      illustration?: string | null;
      attribution?: string | null;
    };
    return { ...obj, illustration: obj.illustration ?? null, attribution: obj.attribution ?? null };
  });
```

- [ ] **Step 4: 运行 validate 测试确认通过**

Run: `npx vitest run tests/validate.test.ts`
Expected: 全部 PASS。

- [ ] **Step 5: 写失败测试（seed 按目录 + 容错）**

把 `tests/seed.test.ts` 整体替换为（用受控 fixture 目录，避免被后续真实内容影响计数）：

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { runSeed } from "@/scripts/seed";

const Q = {
  difficulty: 3,
  topic: "counting",
  text_zh: "1 + 1 = ？",
  text_en: "1 + 1 = ?",
  illustration: null,
  choices: [
    { zh: "1", en: "1" },
    { zh: "2", en: "2" },
    { zh: "3", en: "3" },
  ],
  correct_index: 1,
  explanation_zh: "1 再加 1 是 2。",
  explanation_en: "One more than 1 is 2.",
};

function makeBank(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "qbank-"));
}
function writeJson(base: string, sub: string, file: string, data: unknown): void {
  fs.mkdirSync(path.join(base, sub), { recursive: true });
  fs.writeFileSync(path.join(base, sub, file), JSON.stringify(data));
}
function sources(db: ReturnType<typeof openDb>) {
  return db.prepare("SELECT source, COUNT(*) AS n FROM questions GROUP BY source ORDER BY source").all() as {
    source: string;
    n: number;
  }[];
}

describe("runSeed (fixture banks)", () => {
  it("derives source from the subdirectory", () => {
    const base = makeBank();
    writeJson(base, "practice", "p.json", [Q]);
    writeJson(base, "official", "o.json", [{ ...Q, text_zh: "官方题", attribution: "MK-USA 2024 G1-2 Q1" }]);
    writeJson(base, "simulation", "s.json", [{ ...Q, text_zh: "仿真题" }]);
    const db = openDb(":memory:");
    const n = runSeed(db, base);
    expect(n).toBe(3);
    expect(sources(db)).toEqual([
      { source: "official", n: 1 },
      { source: "practice", n: 1 },
      { source: "simulation", n: 1 },
    ]);
  });

  it("passes attribution through for official questions", () => {
    const base = makeBank();
    writeJson(base, "practice", "p.json", [Q]);
    writeJson(base, "official", "o.json", [{ ...Q, attribution: "MK-IN G1-2 Q5" }]);
    const db = openDb(":memory:");
    runSeed(db, base);
    const row = db.prepare("SELECT attribution FROM questions WHERE source = 'official'").get() as {
      attribution: string | null;
    };
    expect(row.attribution).toBe("MK-IN G1-2 Q5");
  });

  it("tolerates missing official/simulation directories", () => {
    const base = makeBank();
    writeJson(base, "practice", "p.json", [Q, { ...Q, difficulty: 4 }]);
    const db = openDb(":memory:");
    const n = runSeed(db, base);
    expect(n).toBe(2);
    expect(sources(db)).toEqual([{ source: "practice", n: 2 }]);
  });

  it("tolerates an empty optional directory (no JSON files)", () => {
    const base = makeBank();
    writeJson(base, "practice", "p.json", [Q]);
    fs.mkdirSync(path.join(base, "official"), { recursive: true }); // 空目录
    const db = openDb(":memory:");
    expect(() => runSeed(db, base)).not.toThrow();
    expect(sources(db)).toEqual([{ source: "practice", n: 1 }]);
  });

  it("throws when the required practice bank is missing", () => {
    const base = makeBank();
    writeJson(base, "official", "o.json", [Q]);
    const db = openDb(":memory:");
    expect(() => runSeed(db, base)).toThrow(/practice/);
  });
});

describe("runSeed (real questions/ directory)", () => {
  it("seeds the practice bank: 126 questions, 42 per difficulty, 21 per topic, all source=practice", () => {
    const db = openDb(":memory:");
    runSeed(db);

    const practice = db.prepare("SELECT COUNT(*) AS n FROM questions WHERE source = 'practice'").get() as { n: number };
    expect(practice.n).toBe(126);

    const perDifficulty = db
      .prepare(
        "SELECT difficulty, COUNT(*) AS n FROM questions WHERE source = 'practice' GROUP BY difficulty ORDER BY difficulty"
      )
      .all() as { difficulty: number; n: number }[];
    expect(perDifficulty).toEqual([
      { difficulty: 3, n: 42 },
      { difficulty: 4, n: 42 },
      { difficulty: 5, n: 42 },
    ]);

    const perTopic = db
      .prepare(
        "SELECT topic, COUNT(*) AS n FROM questions WHERE source = 'practice' GROUP BY topic ORDER BY topic"
      )
      .all() as { topic: string; n: number }[];
    expect(perTopic).toEqual([
      { topic: "arithmetic", n: 21 },
      { topic: "counting", n: 21 },
      { topic: "logic", n: 21 },
      { topic: "patterns", n: 21 },
      { topic: "shapes", n: 21 },
      { topic: "time", n: 21 },
    ]);
  });
});
```

- [ ] **Step 6: 运行 seed 测试确认失败**

Run: `npx vitest run tests/seed.test.ts`
Expected: FAIL（`runSeed` 尚不接受 baseDir、未写 source）。

- [ ] **Step 7: 重写 `src/scripts/seed.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Database } from "better-sqlite3";
import { openDb } from "../lib/db";
import { validateBank } from "../lib/validate";
import type { RawQuestion, Source } from "../lib/types";

export const QUESTIONS_DIR = path.join(process.cwd(), "questions");

const BANKS: { source: Source; dir: string; required: boolean }[] = [
  { source: "practice", dir: "practice", required: true },
  { source: "official", dir: "official", required: false },
  { source: "simulation", dir: "simulation", required: false },
];

export function loadBankFiles(baseDir: string, sub: string, required: boolean): unknown[] {
  const dir = path.join(baseDir, sub);
  if (!fs.existsSync(dir)) {
    if (required) throw new Error(`缺少题库目录: ${dir}`);
    return [];
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) {
    if (required) throw new Error(`题库目录中没有 JSON 文件: ${dir}`);
    return [];
  }
  return files.flatMap((f) => {
    const data: unknown = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
    if (!Array.isArray(data)) throw new Error(`${f} 的顶层必须是数组`);
    return data;
  });
}

interface SeedItem {
  source: Source;
  q: RawQuestion;
}

export function seedDb(db: Database, items: SeedItem[]): number {
  const insert = db.prepare(`
    INSERT INTO questions (difficulty, topic, text_zh, text_en, illustration, choices, correct_index, explanation_zh, explanation_en, source, attribution)
    VALUES (@difficulty, @topic, @text_zh, @text_en, @illustration, @choices, @correct_index, @explanation_zh, @explanation_en, @source, @attribution)
  `);
  const tx = db.transaction((rows: SeedItem[]) => {
    db.prepare("DELETE FROM answers").run();
    db.prepare("DELETE FROM sessions").run();
    db.prepare("DELETE FROM questions").run();
    for (const { source, q } of rows) {
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
        source,
        attribution: q.attribution ?? null,
      });
    }
  });
  tx(items);
  return items.length;
}

export function runSeed(db: Database, baseDir: string = QUESTIONS_DIR): number {
  const items: SeedItem[] = [];
  for (const bank of BANKS) {
    const raw = loadBankFiles(baseDir, bank.dir, bank.required);
    const valid = validateBank(raw);
    for (const q of valid) items.push({ source: bank.source, q });
  }
  const count = seedDb(db, items);
  warnIfExamBankShort(db);
  return count;
}

function warnIfExamBankShort(db: Database): void {
  for (const difficulty of [3, 4, 5]) {
    const row = db
      .prepare(
        "SELECT COUNT(*) AS n FROM questions WHERE source IN ('official', 'simulation') AND difficulty = ?"
      )
      .get(difficulty) as { n: number };
    if (row.n < 8) {
      console.warn(`⚠️  难度 ${difficulty} 的考试库（官方+仿真）只有 ${row.n} 题（< 8），建议补充仿真题`);
    }
  }
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  const dbPath = process.env.QUIZ_DB_PATH ?? path.join(process.cwd(), "data", "quiz.db");
  const db = openDb(dbPath);
  const count = runSeed(db);
  console.log(`⚠️  重新 seed 会清空历史作答记录。已导入 ${count} 道题目 → ${dbPath}`);
}
```

- [ ] **Step 8: 运行 seed 测试确认通过**

Run: `npx vitest run tests/seed.test.ts`
Expected: 全部 PASS。（此时 official/simulation 目录尚不存在，控制台会打印三条「考试库 < 8」警告——符合预期，Task 6/7 补内容后消失。）

- [ ] **Step 9: 提交**

```bash
git add questions/practice src/scripts/seed.ts src/lib/validate.ts tests/seed.test.ts tests/validate.test.ts
git commit -m "feat(seed): 题库拆分为 practice/official/simulation 三目录，按目录写 source"
```

---

## Task 3: 选题逻辑（练习过滤 + 考试官方优先/仿真补齐 + 构成统计）

**Files:**
- Modify: `src/lib/questions.ts`
- Test: `tests/questions.test.ts`

**Interfaces:**
- Consumes: `Question.source`（Task 1）。
- Produces: `getPracticeQuestions` 仅返回 `source='practice'`；`getExamQuestions` 每难度「官方优先→仿真补齐→放宽去重兜底」（同卷不重复同一题）；`examComposition(questions: Question[]): { official: number; simulation: number }`。

- [ ] **Step 1: 更新 fixture 并写失败测试**

把 `tests/questions.test.ts` 的 `seedFixture` 改为接受 `source`，并新增/调整测试：

```ts
function seedFixture(db: Database, perDifficulty: number, source: "practice" | "official" | "simulation" = "practice") {
  const insert = db.prepare(
    `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en, source)
     VALUES (?, 'counting', '题', 'q', ?, 0, '解', 'a', ?)`
  );
  for (const d of [3, 4, 5]) {
    for (let i = 0; i < perDifficulty; i++) insert.run(d, CHOICES, source);
  }
}

function insertAt(db: Database, difficulty: number, source: "official" | "simulation"): number {
  const info = db
    .prepare(
      `INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en, source)
       VALUES (?, 'counting', '题', 'q', ?, 0, '解', 'a', ?)`
    )
    .run(difficulty, CHOICES, source);
  return Number(info.lastInsertRowid);
}
```

更新 import：`import { examComposition, getExamQuestions, getPracticeQuestions } from "@/lib/questions";`

在 `getPracticeQuestions` describe 末尾追加：

```ts
  it("returns only practice questions (excludes official/simulation)", () => {
    const db = openDb(":memory:");
    seedFixture(db, 2, "practice");
    insertAt(db, 3, "official");
    insertAt(db, 3, "simulation");
    const rows = getPracticeQuestions(db, "random", 50);
    expect(rows).toHaveLength(6); // 2 per difficulty × 3
    expect(rows.every((r) => r.source === "practice")).toBe(true);
  });
```

把 `getExamQuestions` describe 内三处 `seedFixture(db, N)` 改为 `seedFixture(db, N, "official")`（其余断言不变），并在该 describe 末尾追加：

```ts
  it("prefers official over simulation within a difficulty", () => {
    const db = openDb(":memory:");
    const officialIds = [insertAt(db, 3, "official"), insertAt(db, 3, "official"), insertAt(db, 3, "official")];
    for (let i = 0; i < 5; i++) insertAt(db, 3, "simulation");
    const d3 = getExamQuestions(db, 8).filter((r) => r.difficulty === 3);
    expect(d3).toHaveLength(8);
    for (const id of officialIds) expect(d3.map((r) => r.id)).toContain(id);
  });

  it("backfills with simulation when official < perDifficulty", () => {
    const db = openDb(":memory:");
    const officialIds = [insertAt(db, 4, "official"), insertAt(db, 4, "official")];
    for (let i = 0; i < 10; i++) insertAt(db, 4, "simulation");
    const d4 = getExamQuestions(db, 8).filter((r) => r.difficulty === 4);
    expect(d4).toHaveLength(8);
    for (const id of officialIds) expect(d4.map((r) => r.id)).toContain(id);
  });

  it("never draws practice questions into an exam", () => {
    const db = openDb(":memory:");
    seedFixture(db, 3, "practice");
    insertAt(db, 3, "official");
    insertAt(db, 4, "simulation");
    insertAt(db, 5, "simulation");
    const rows = getExamQuestions(db, 8);
    expect(rows.every((r) => r.source !== "practice")).toBe(true);
  });

  it("returns the available count when a difficulty has fewer than perDifficulty (no within-exam dup)", () => {
    const db = openDb(":memory:");
    const ids = [insertAt(db, 3, "simulation"), insertAt(db, 3, "simulation"), insertAt(db, 3, "simulation")];
    const d3 = getExamQuestions(db, 8).filter((r) => r.difficulty === 3);
    expect(d3).toHaveLength(3);
    expect(new Set(d3.map((r) => r.id)).size).toBe(3);
    for (const id of ids) expect(d3.map((r) => r.id)).toContain(id);
  });

  it("fallback re-includes last-exam questions when dedup leaves fewer than perDifficulty", () => {
    const db = openDb(":memory:");
    const ids = [insertAt(db, 3, "simulation"), insertAt(db, 3, "simulation"), insertAt(db, 3, "simulation")];
    const sid = Number(
      db.prepare("INSERT INTO sessions (mode, started_at, finished_at) VALUES ('exam', 1, 2)").run().lastInsertRowid
    );
    for (const id of ids) {
      db.prepare("INSERT INTO answers (session_id, question_id, created_at) VALUES (?, ?, 1)").run(sid, id);
    }
    const d3 = getExamQuestions(db, 8).filter((r) => r.difficulty === 3);
    expect(d3).toHaveLength(3); // 放宽去重后重新纳入这 3 题
    for (const id of ids) expect(d3.map((r) => r.id)).toContain(id);
  });
```

新增 describe：

```ts
describe("examComposition", () => {
  it("counts official vs simulation questions", () => {
    const db = openDb(":memory:");
    seedFixture(db, 2, "official"); // 6 official
    seedFixture(db, 1, "simulation"); // 3 simulation
    const official = getExamQuestions(db, 6); // 取一批混合
    const comp = examComposition(official);
    expect(comp.official + comp.simulation).toBe(official.length);
    expect(comp.official).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/questions.test.ts`
Expected: 新增用例 FAIL（练习未过滤 source、考试未区分官方/仿真、`examComposition` 不存在）。

- [ ] **Step 3: 实现（`src/lib/questions.ts`）**

`getPracticeQuestions` 两条 SQL 加 `source = 'practice'`：

```ts
  const rows =
    topic === "random"
      ? (db.prepare("SELECT * FROM questions WHERE source = 'practice' ORDER BY RANDOM() LIMIT ?").all(limit) as QuestionRow[])
      : (db
          .prepare("SELECT * FROM questions WHERE source = 'practice' AND topic = ? ORDER BY RANDOM() LIMIT ?")
          .all(topic, limit) as QuestionRow[]);
```

`pickExcluding` 增加 `sources` 参数：

```ts
function pickExcluding(
  db: Database,
  difficulty: number,
  excludeIds: number[],
  sources: Source[],
  limit: number
): QuestionRow[] {
  if (limit <= 0) return [];
  const srcPh = sources.map(() => "?").join(",");
  if (excludeIds.length === 0) {
    return db
      .prepare(`SELECT * FROM questions WHERE difficulty = ? AND source IN (${srcPh}) ORDER BY RANDOM() LIMIT ?`)
      .all(difficulty, ...sources, limit) as QuestionRow[];
  }
  const ph = excludeIds.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT * FROM questions WHERE difficulty = ? AND source IN (${srcPh}) AND id NOT IN (${ph}) ORDER BY RANDOM() LIMIT ?`
    )
    .all(difficulty, ...sources, ...excludeIds, limit) as QuestionRow[];
}
```

`getExamQuestions` 重写为官方优先/仿真补齐：

```ts
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
    const officials = pickExcluding(db, difficulty, excluded, ["official"], perDifficulty);
    const officialIds = officials.map((r) => r.id);
    const sims = pickExcluding(
      db,
      difficulty,
      [...excluded, ...officialIds],
      ["simulation"],
      perDifficulty - officials.length
    );
    let rows = [...officials, ...sims];
    if (rows.length < perDifficulty) {
      const have = rows.map((r) => r.id);
      rows = [...rows, ...pickExcluding(db, difficulty, have, ["official", "simulation"], perDifficulty - rows.length)];
    }
    out.push(...rows);
  }
  return out.map(rowToQuestion);
}
```

新增 `examComposition`：

```ts
export function examComposition(questions: Question[]): { official: number; simulation: number } {
  let official = 0;
  let simulation = 0;
  for (const q of questions) {
    if (q.source === "official") official += 1;
    else if (q.source === "simulation") simulation += 1;
  }
  return { official, simulation };
}
```

`questions.ts` 顶部 import 增加 `Source`：`import type { Question, Source, Topic } from "./types";`

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/questions.test.ts`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/lib/questions.ts tests/questions.test.ts
git commit -m "feat(exam): 考试官方优先/仿真补齐选题，练习仅用 practice 题库"
```

---

## Task 4: 配图新原语（svg:dice / svg:bars）

**Files:**
- Modify: `src/components/quiz/Illustration.tsx`
- Test: `tests/illustration.test.ts`

**Interfaces:**
- Produces: `parseIllustration` 支持 `svg:dice:<1-6>` → `{ kind: "dice"; pips: number }`，`svg:bars:<csv 高度>` → `{ kind: "bars"; heights: number[] }`；`Illustration` 渲染二者。后续转录官方题若还需其它图形，按同样模式追加。

- [ ] **Step 1: 写失败测试**

在 `tests/illustration.test.ts` 追加：

```ts
  it("parses dice descriptors", () => {
    expect(parseIllustration("svg:dice:5")).toEqual({ kind: "dice", pips: 5 });
    expect(parseIllustration("svg:dice:1")).toEqual({ kind: "dice", pips: 1 });
  });
  it("rejects out-of-range or malformed dice", () => {
    expect(parseIllustration("svg:dice:0")).toEqual({ kind: "none" });
    expect(parseIllustration("svg:dice:7")).toEqual({ kind: "none" });
    expect(parseIllustration("svg:dice:x")).toEqual({ kind: "none" });
  });
  it("parses bars descriptors", () => {
    expect(parseIllustration("svg:bars:3,5,2")).toEqual({ kind: "bars", heights: [3, 5, 2] });
  });
  it("rejects malformed bars", () => {
    expect(parseIllustration("svg:bars:")).toEqual({ kind: "none" });
    expect(parseIllustration("svg:bars:a,b")).toEqual({ kind: "none" });
    expect(parseIllustration("svg:bars:3,-1")).toEqual({ kind: "none" });
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/illustration.test.ts`
Expected: 新增用例 FAIL（未知描述符回退 none）。

- [ ] **Step 3: 实现（`src/components/quiz/Illustration.tsx`）**

`ParsedIllustration` 联合类型追加：

```ts
  | { kind: "dice"; pips: number }
  | { kind: "bars"; heights: number[] };
```

`parseIllustration` 在 `svg:diagsquare` 判断之前插入：

```ts
  if (desc.startsWith("svg:dice:")) {
    const n = Number(desc.slice(9));
    if (Number.isInteger(n) && n >= 1 && n <= 6) return { kind: "dice", pips: n };
    return { kind: "none" };
  }
  if (desc.startsWith("svg:bars:")) {
    const parts = desc.slice(9).split(",").filter((s) => s.length > 0);
    const heights = parts.map(Number);
    if (heights.length > 0 && heights.every((h) => Number.isFinite(h) && h >= 0)) {
      return { kind: "bars", heights };
    }
    return { kind: "none" };
  }
```

`Illustration` 的 switch 增加两个 case：

```tsx
    case "dice":
      return <Dice pips={parsed.pips} />;
    case "bars":
      return <Bars heights={parsed.heights} />;
```

文件末尾新增两个组件：

```tsx
// 3×3 网格上各点数的 pip 位置（坐标 0/1/2）
const DICE_PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function Dice({ pips }: { pips: number }) {
  const cell = 30; // 每格像素
  const pos = (i: number) => 15 + i * cell; // 中心坐标
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-24 w-24 md:h-32 md:w-32">
      <rect x="8" y="8" width="104" height="104" rx="18" fill="#fffdf5" stroke="#5c4033" strokeWidth="5" />
      {(DICE_PIPS[pips] ?? []).map(([r, c], i) => (
        <circle key={i} cx={pos(c)} cy={pos(r)} r="8" fill="#5c4033" />
      ))}
    </svg>
  );
}

function Bars({ heights }: { heights: number[] }) {
  const max = Math.max(...heights, 1);
  const n = heights.length;
  const gap = 8;
  const w = (100 - gap * (n - 1)) / n;
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-24 w-24 md:h-32 md:w-32">
      <line x1="10" y1="108" x2="110" y2="108" stroke="#5c4033" strokeWidth="4" />
      {heights.map((h, i) => {
        const barH = (h / max) * 88;
        const x = 10 + i * (w + gap);
        return (
          <rect key={i} x={x} y={108 - barH} width={w} height={barH} rx="4" fill="#ef6351" stroke="#5c4033" strokeWidth="2" />
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/illustration.test.ts`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/components/quiz/Illustration.tsx tests/illustration.test.ts
git commit -m "feat(illustration): 新增 svg:dice / svg:bars 配图原语"
```

---

## Task 5: 家长端/报告端来源显示 + README 署名

**Files:**
- Modify: `src/app/exam/report/[id]/page.tsx`
- Modify: `src/app/parents/page.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `examComposition`（Task 3）、`Question.source`（Task 1）。
- Produces: 考试报告页显示本卷「官方样题 X · 仿真模拟 Y」+ 署名脚注；家长面板显示署名脚注；README 更新子目录说明与署名。孩子考试界面（`exam/page.tsx`）不动。

- [ ] **Step 1: 报告页显示构成与署名（`src/app/exam/report/[id]/page.tsx`）**

import 增加 `examComposition`：

```ts
import { examComposition, getQuestionsByIds } from "@/lib/questions";
```

在 `const byId = ...` 之后加：

```ts
  const composition = examComposition(questions);
```

在顶部分数 section 内、`<p className="mt-3 text-cocoa/70">…答对…</p>` 之后加：

```tsx
          <p className="mt-2 text-sm text-cocoa/60">
            官方样题 {composition.official} 题 · 仿真模拟 {composition.simulation} 题
          </p>
```

在「再考一次/回家」按钮 `<div>` 之前加署名脚注：

```tsx
        <p className="px-4 text-center text-xs text-cocoa/50">
          官方样题来源：Math Kangaroo（Kangourou Sans Frontières）公开发布的样题/历年样卷，仅供个人练习，版权归原作者/机构所有。
        </p>
```

- [ ] **Step 2: 家长面板署名（`src/app/parents/page.tsx`）**

在「用户管理」section 之后、最外层 `</div>` 闭合之前加：

```tsx
        <section className="rounded-[2rem] border-4 border-cocoa/10 bg-white/70 p-4 text-center text-xs text-cocoa/60 shadow">
          官方样题来源：Math Kangaroo（Kangourou Sans Frontières）公开发布的样题/历年样卷，仅供个人练习，版权归原作者/机构所有。
          参考：mathkangaroo.org · mathkangaroo.in
        </section>
```

- [ ] **Step 3: 更新 README（`README.md`）**

把「## 添加/修改题目」一节替换为：

```markdown
## 添加/修改题目

题库按来源分三个子目录，`npm run seed` 按目录写入 `source`：

- `questions/practice/`：闯关练习用的原创题（`source='practice'`）
- `questions/official/`：官方公开样题（`source='official'`），每条建议带 `attribution` 记录出处
- `questions/simulation/`：原创仿真题（`source='simulation'`），用于模拟考试按难度补齐

编辑各目录下 JSON（每主题/每卷一个文件）。每题必须包含：`difficulty`（3/4/5）、`topic`、
双语题干（`text_zh`/`text_en`）、恰好 3 个双语选项（`choices`）、`correct_index`（0/1/2）、双语解析。
`illustration` 可选：`emoji:🍎🍎`、`svg:clock:6:30`、`svg:grid`、`svg:diagsquare`、`svg:dice:5`、`svg:bars:3,5,2`。
官方题可加可选字段 `attribution`（字符串，如 `"MK-USA 2024 G1-2 Q3"`）。

> ⚠️ 重新 seed 会清空作答历史（题目 ID 会变化），星星与错题本随之重置。
> 模拟考试只从 `official` + `simulation` 抽题（官方优先、仿真补齐）；闯关练习只用 `practice`，两库零重叠。
```

把文末「## 说明」一节替换为：

```markdown
## 说明

- 闯关练习题目为按袋鼠数学竞赛题型风格原创编写。
- 模拟考试含官方公开发布的样题/历年样卷（来源：Math Kangaroo / Kangourou Sans Frontières），
  仅供个人练习，版权归原作者/机构所有；不足部分由原创仿真题按难度补齐。
- 官方样题与规则参考：<https://mathkangaroo.org/mks/practice/free-question-samples/> · <https://www.mathkangaroo.in/>
```

- [ ] **Step 4: 类型检查与构建确认**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 无类型错误，测试全绿。（构成统计逻辑已在 Task 3 单测覆盖；报告/面板为纯 JSX。）

- [ ] **Step 5: 提交**

```bash
git add src/app/exam/report/[id]/page.tsx src/app/parents/page.tsx README.md
git commit -m "feat(ui): 考试报告/家长面板显示官方/仿真构成与署名，更新 README"
```

---

## Task 6: 转录官方样题到 questions/official/

**Files:**
- Create: `questions/official/g12-<年份>-<来源>.json`（例如 `g12-2024-mkin.json`）
- Modify: `tests/seed.test.ts`（real-dir 段加官方结构断言）

**Interfaces:**
- Consumes: seed 三目录 + `attribution`（Task 2）、`svg:dice`/`svg:bars`（Task 4）。
- Produces: `questions/official/` 至少一套完整官方 G1-2 卷（24 题，难度按题位 8/8/8），每条带 `attribution`、双语、3 选项。

> **内容来源（仅官方）**：Math Kangaroo India 官方 G1-2 卷 PDF
> `https://www.mathkangaroo.in/media/pdf/1222718203_152124028_1_PreEcolier-G-1__2_Test_Paper.pdf`，
> 以及 mathkangaroo.org 的历年样卷页 `https://mathkangaroo.org/mks/practice/free-question-samples/`。
> **不要**使用第三方盗版题库。

**转录规则（逐题执行）：**
1. `difficulty`：Q1–8 → `3`，Q9–16 → `4`，Q17–24 → `5`。
2. `topic`：从 `counting/shapes/patterns/logic/arithmetic/time` 选最贴切者。
3. `text_en`：照录原题英文；`text_zh`：译为适合 6-8 岁的中文。
4. `choices`：官方 G1-2 即 3 选项，逐项双语；`correct_index` 指向正确项（0/1/2）。
5. `explanation_zh`/`explanation_en`：写简短双语解析。
6. `illustration`：能用 `emoji:`/`svg:clock`/`svg:grid`/`svg:diagsquare`/`svg:dice:N`/`svg:bars:...` 表达则用；无法表达的题，优先改编为文字描述，仍无法处理的**跳过**（缺口留给仿真补齐）。
7. `attribution`：如 `"MK-IN G1-2 Q3"` 或 `"MK-USA 2024 G1-2 Q17"`。

**格式模板（展示目标 JSON 形态；实际题目须来自上述官方来源）：**

```json
[
  {
    "difficulty": 3,
    "topic": "time",
    "text_zh": "钟表现在显示 6:30。再过 1 小时是几点？",
    "text_en": "The clock shows 6:30. What time will it be in 1 hour?",
    "illustration": "svg:clock:6:30",
    "choices": [
      { "zh": "7:30", "en": "7:30" },
      { "zh": "6:30", "en": "6:30" },
      { "zh": "7:00", "en": "7:00" }
    ],
    "correct_index": 0,
    "explanation_zh": "6:30 再过 1 小时是 7:30。",
    "explanation_en": "One hour after 6:30 is 7:30.",
    "attribution": "MK-IN G1-2 Q1"
  }
]
```

- [ ] **Step 1: 写失败测试（real-dir 官方结构断言）**

在 `tests/seed.test.ts` 的 `runSeed (real questions/ directory)` describe 内追加：

```ts
  it("official bank is non-empty and structurally valid (source=official, attribution set, 3 choices)", () => {
    const db = openDb(":memory:");
    runSeed(db);
    const officials = db.prepare("SELECT * FROM questions WHERE source = 'official'").all() as {
      attribution: string | null;
      choices: string;
      correct_index: number;
      difficulty: number;
      topic: string;
    }[];
    expect(officials.length).toBeGreaterThan(0);
    for (const o of officials) {
      expect(o.attribution && o.attribution.trim().length > 0).toBe(true);
      const choices = JSON.parse(o.choices) as unknown[];
      expect(choices).toHaveLength(3);
      expect(o.correct_index).toBeGreaterThanOrEqual(0);
      expect(o.correct_index).toBeLessThan(3);
      expect([3, 4, 5]).toContain(o.difficulty);
      expect(["counting", "shapes", "patterns", "logic", "arithmetic", "time"]).toContain(o.topic);
    }
  });
```

> 说明：目标是转录一套完整卷（难度 8/8/8），但允许因配图无法表达而跳过个别题——缺口由 Task 7 的仿真题补齐，
> 「满 24 题」由仿真不变量保证，而非官方数。因此这里**只**断言官方题非空且结构合法，不强求每难度 ≥ 8。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/seed.test.ts`
Expected: 该条 FAIL（official 为空）。

- [ ] **Step 3: 转录官方题**

从上面的官方来源转录一套（或更多）完整 G1-2 卷，按「转录规则」写入 `questions/official/g12-<年份>-<来源>.json`。
力争每套 24 题、难度 8/8/8，每条带 `attribution`；无法用现有 illustration 表达的题按规则跳过或改编（不必强凑）。

- [ ] **Step 4: 校验 + 运行测试确认通过**

Run: `npx vitest run tests/seed.test.ts`
Expected: 全部 PASS（official 非空、结构合法）。
若 seed 控制台仍有「考试库 < 8」警告，说明某难度官方+仿真合计不足——Task 7 补齐仿真后消除。

- [ ] **Step 5: 提交**

```bash
git add questions/official tests/seed.test.ts
git commit -m "content: 转录官方 G1-2 样题入 questions/official（含 attribution）"
```

---

## Task 7: 原创仿真题到 questions/simulation/（每难度 ≥ 8）

**Files:**
- Create: `questions/simulation/arithmetic.json`、`counting.json`、`shapes.json`、`patterns.json`、`logic.json`、`time.json`（按主题分文件，或合并为少量文件均可）
- Modify: `tests/seed.test.ts`（real-dir 段加仿真不变量断言）

**Interfaces:**
- Consumes: seed 三目录（Task 2）。
- Produces: `questions/simulation/` 满足「每难度（3/4/5）≥ 8 题」不变量；全部 `source='simulation'`、双语、3 选项、无 `attribution`。**原创**，不得复制官方题。

**编写要求：**
- 模仿 G1-2 风格与知识点分布（六主题均衡），难度 3/4/5 各至少 8 题（建议各 ~10 题以增加多次考试的变化）。
- 双语题干/选项/解析；`illustration` 可用 Task 4 新原语。
- 这是原创内容，无任何版权问题；可放手按风格创作。

**完整示例（每题按此格式，均为原创）：**

```json
[
  {
    "difficulty": 3,
    "topic": "counting",
    "text_zh": "桌上有 4 个苹果和 3 个梨，一共有几个水果？",
    "text_en": "There are 4 apples and 3 pears on the table. How many fruits in total?",
    "illustration": "emoji:🍎🍎🍎🍎🍐🍐🍐",
    "choices": [
      { "zh": "6 个", "en": "6" },
      { "zh": "7 个", "en": "7" },
      { "zh": "8 个", "en": "8" }
    ],
    "correct_index": 1,
    "explanation_zh": "4 + 3 = 7 个。",
    "explanation_en": "4 + 3 = 7 fruits."
  },
  {
    "difficulty": 4,
    "topic": "logic",
    "text_zh": "小红比小明高，小明比小刚高。谁最矮？",
    "text_en": "Xiaohong is taller than Xiaoming. Xiaoming is taller than Xiaogang. Who is the shortest?",
    "choices": [
      { "zh": "小红", "en": "Xiaohong" },
      { "zh": "小明", "en": "Xiaoming" },
      { "zh": "小刚", "en": "Xiaogang" }
    ],
    "correct_index": 2,
    "explanation_zh": "小红 > 小明 > 小刚，所以小刚最矮。",
    "explanation_en": "Xiaohong > Xiaoming > Xiaogang, so Xiaogang is the shortest."
  },
  {
    "difficulty": 5,
    "topic": "patterns",
    "text_zh": "按规律填数：2, 4, 8, 16, ？",
    "text_en": "Continue the pattern: 2, 4, 8, 16, ?",
    "choices": [
      { "zh": "18", "en": "18" },
      { "zh": "24", "en": "24" },
      { "zh": "32", "en": "32" }
    ],
    "correct_index": 2,
    "explanation_zh": "每次乘以 2：16 × 2 = 32。",
    "explanation_en": "Each term doubles: 16 × 2 = 32."
  }
]
```

- [ ] **Step 1: 写失败测试（仿真不变量）**

在 `tests/seed.test.ts` 的 `runSeed (real questions/ directory)` describe 内追加：

```ts
  it("simulation bank satisfies the >=8 per difficulty invariant", () => {
    const db = openDb(":memory:");
    runSeed(db);
    const perDifficulty = db
      .prepare(
        "SELECT difficulty, COUNT(*) AS n FROM questions WHERE source = 'simulation' GROUP BY difficulty ORDER BY difficulty"
      )
      .all() as { difficulty: number; n: number }[];
    const map = Object.fromEntries(perDifficulty.map((r) => [r.difficulty, r.n]));
    expect(map[3] ?? 0).toBeGreaterThanOrEqual(8);
    expect(map[4] ?? 0).toBeGreaterThanOrEqual(8);
    expect(map[5] ?? 0).toBeGreaterThanOrEqual(8);
  });

  it("simulation questions carry no attribution and are structurally valid", () => {
    const db = openDb(":memory:");
    runSeed(db);
    const sims = db.prepare("SELECT * FROM questions WHERE source = 'simulation'").all() as {
      attribution: string | null;
      choices: string;
      correct_index: number;
    }[];
    expect(sims.length).toBeGreaterThan(0);
    for (const s of sims) {
      expect(s.attribution).toBeNull();
      expect(JSON.parse(s.choices)).toHaveLength(3);
      expect(s.correct_index).toBeGreaterThanOrEqual(0);
      expect(s.correct_index).toBeLessThan(3);
    }
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/seed.test.ts`
Expected: 上述两条 FAIL（simulation 为空）。

- [ ] **Step 3: 编写仿真题**

按「编写要求」与示例格式，在 `questions/simulation/` 创建文件，确保每难度 ≥ 8 题、六主题尽量均衡。

- [ ] **Step 4: 校验 + 运行测试确认通过**

Run: `npx vitest run tests/seed.test.ts`
Expected: 全部 PASS；`npm run seed` 控制台不再出现「考试库 < 8」警告。

- [ ] **Step 5: 提交**

```bash
git add questions/simulation tests/seed.test.ts
git commit -m "content: 原创仿真题入 questions/simulation（每难度 >=8）"
```

---

## Task 8: 集成验收（重新 seed 真实库 + 全量测试 + 手动冒烟）

**Files:**
- 无新增源码；验证既有改动并重建 `data/quiz.db`。

- [ ] **Step 1: 全量测试与类型检查**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 全绿、无类型错误。

- [ ] **Step 2: 重新 seed 真实数据库**

Run: `npm run seed`
Expected: 打印导入题数（practice 126 + official + simulation），**无**「考试库 < 8」警告。
（⚠️ 这会清空 `data/quiz.db` 的作答历史——符合 README 既有约定。）

- [ ] **Step 3: 构建**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 4: 手动冒烟**

Run: `npm run dev`（打开 http://localhost:3000），逐项确认：
- 闯关练习：随机/按主题练习出现的仍是原创新题；不出现官方/仿真题。
- 模拟考试：开始考试，抽到 24 题；题目中能看到官方样题（含其配图）。
- 交卷后报告页：显示「官方样题 X 题 · 仿真模拟 Y 题」与署名脚注；X+Y=24。
- 家长面板（算术门进入）：底部出现署名脚注。
- 多次「再考一次」：题目有变化（去重 + 仿真池）。

- [ ] **Step 5: 收尾提交（如有冒烟期微调）**

若冒烟中产生文案/样式微调，仅提交相关文件：

```bash
git add <具体文件>
git commit -m "chore: 集成验收微调"
```

（如无改动则跳过本步。）

---

## Self-Review 结论

- **Spec 覆盖**：数据模型/迁移→Task1；目录/seed/attribution→Task2；选题逻辑/examComposition→Task3；配图原语→Task4；家长端显示/README→Task5；官方转录→Task6；仿真题不变量→Task7；集成验收→Task8。spec 各节均有对应任务。
- **占位符扫描**：无 TBD/TODO；内容任务（6/7）给出来源 URL、转录/编写规则、完整 JSON 模板与结构化测试，工程部分均为可执行代码。
- **类型一致性**：`Source`、`Question.source/attribution`、`pickExcluding(db, difficulty, excludeIds, sources, limit)`、`examComposition` 在各任务中签名一致；`runSeed(db, baseDir?)` 兼容既有用法。
- **已知行为校准**：兜底分支「不在同卷内重复同一题」，满 24 依赖「仿真每难度 ≥ 8」不变量（已在 spec 与 Task3 测试中明确）。
