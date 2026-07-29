# 多用户支持 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持多个用户（双胞胎女儿），分别记录各自的学习成绩，完全数据隔离

**Architecture:** 
- 数据库：新增 `users` 表，`sessions` 表添加 `user_id` 外键
- API：所有数据接口支持 `userId` 参数过滤
- 前端：首页改为用户选择界面，用户会话存入 localStorage

**Tech Stack:** Next.js 15 + TypeScript + SQLite (better-sqlite3) + Tailwind CSS v4

## Global Constraints

- 数据库使用 better-sqlite3
- 用户 ID 存储在 localStorage key: `kangaroo-current-user`
- 所有 API 调用必须带 userId 参数
- 删除用户时级联删除其所有 sessions 和 answers
- 首次启动时数据库为空，需要创建第一个用户

---

### Task 1: 数据库架构升级

**Files:**
- Modify: `src/lib/db.ts`
- Create: `scripts/migrate-to-multi-user.ts`

**Interfaces:**
- Consumes: 现有数据库（quiz.db）
- Produces: 新增 users 表，sessions 表添加 user_id 列

- [ ] **Step 1: 更新 SCHEMA 常量**

在 `src/lib/db.ts` 中更新 SCHEMA：

```typescript
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🐨',
  created_at INTEGER NOT NULL
);

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
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  chosen_index INTEGER CHECK (chosen_index IS NULL OR chosen_index IN (0, 1, 2)),
  is_correct INTEGER CHECK (is_correct IS NULL OR is_correct IN (0, 1)),
  time_spent_seconds INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
`;
```

- [ ] **Step 2: 创建迁移脚本**

创建 `scripts/migrate-to-multi-user.ts`：

```typescript
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dbPath = path.join(process.cwd(), "data", "quiz.db");

if (!fs.existsSync(dbPath)) {
  console.log("数据库不存在，跳过迁移");
  process.exit(0);
}

console.log("开始迁移到多用户模式...");

const db = new Database(dbPath);

// 检查是否已经迁移
const tableExists = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
).get();

if (tableExists) {
  console.log("已经完成迁移，跳过");
  process.exit(0);
}

// 清空现有数据
console.log("清空现有数据...");
db.exec("DELETE FROM answers");
db.exec("DELETE FROM sessions");

// 创建 users 表
console.log("创建 users 表...");
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🐨',
    created_at INTEGER NOT NULL
  )
`);

// 给 sessions 表添加 user_id 列
console.log("修改 sessions 表...");
db.exec("ALTER TABLE sessions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
db.exec("CREATE INDEX idx_sessions_user ON sessions(user_id)");

// 更新外键约束（SQLite 不支持 ALTER，需要重建表）
console.log("更新外键约束...");
db.exec(`
  CREATE TABLE answers_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id),
    chosen_index INTEGER CHECK (chosen_index IS NULL OR chosen_index IN (0, 1, 2)),
    is_correct INTEGER CHECK (is_correct IS NULL OR is_correct IN (0, 1)),
    time_spent_seconds INTEGER,
    created_at INTEGER NOT NULL
  )
`);
db.exec("INSERT INTO answers_new SELECT * FROM answers");
db.exec("DROP TABLE answers");
db.exec("ALTER TABLE answers_new RENAME TO answers");
db.exec("CREATE INDEX idx_answers_session ON answers(session_id)");
db.exec("CREATE INDEX idx_answers_question ON answers(question_id)");

console.log("迁移完成！");
db.close();
```

- [ ] **Step 3: 运行迁移脚本**

```bash
npm tsx scripts/migrate-to-multi-user.ts
```

- [ ] **Step 4: 提交**

```bash
git add src/lib/db.ts scripts/migrate-to-multi-user.ts
git commit -m "feat: upgrade database schema for multi-user support

- Add users table (id, name, emoji, created_at)
- Add user_id column to sessions table with CASCADE delete
- Update answers table with CASCADE delete
- Create migration script to clear existing data"
```

---

### Task 2: 用户管理 API

**Files:**
- Create: `src/app/api/users/route.ts`
- Create: `src/app/api/users/[id]/route.ts`

**Interfaces:**
- Consumes: `users` 表
- Produces: RESTful API for user CRUD

- [ ] **Step 1: 创建 GET/POST 端点**

创建 `src/app/api/users/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const users = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, emoji } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const db = getDb();
  const result = db
    .prepare("INSERT INTO users (name, emoji, created_at) VALUES (?, ?, ?)")
    .run(name, emoji || "🐨", Date.now());

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
```

- [ ] **Step 2: 创建 PATCH/DELETE 端点**

创建 `src/app/api/users/[id]/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, emoji } = body;

  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push("name = ?");
    values.push(name);
  }
  if (emoji !== undefined) {
    updates.push("emoji = ?");
    values.push(emoji);
  }

  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 级联删除由数据库外键约束自动处理
  db.prepare("DELETE FROM users WHERE id = ?").run(id);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 测试 API**

```bash
# 创建用户
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"大宝","emoji":"🐰"}'

# 获取用户列表
curl http://localhost:3000/api/users

# 更新用户
curl -X PATCH http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"大宝儿"}'

# 删除用户
curl -X DELETE http://localhost:3000/api/users/1
```

- [ ] **Step 4: 提交**

```bash
git add src/app/api/users/
git commit -m "feat: add user management API

- GET /api/users: list all users
- POST /api/users: create user
- PATCH /api/users/[id]: update user
- DELETE /api/users/[id]: delete user with cascade"
```

---

### Task 3: 修改现有 API 支持 userId

**Files:**
- Modify: `src/app/api/sessions/route.ts`
- Modify: `src/app/api/answers/route.ts`
- Modify: `src/app/api/stats/route.ts`
- Modify: `src/app/api/mistakes/route.ts`
- Modify: `src/app/api/exam/route.ts`

**Interfaces:**
- Consumes: `userId` query parameter or request body
- Produces: filtered data by user

- [ ] **Step 1: 修改 sessions API**

更新 `src/app/api/sessions/route.ts`：

```typescript
// POST: 添加 userId 到请求体
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { mode, userId } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO sessions (user_id, mode, started_at) VALUES (?, ?, ?)"
    )
    .run(userId, mode, Date.now());

  return NextResponse.json({ id: result.lastInsertRowid });
}
```

- [ ] **Step 2: 修改 answers API**

更新 `src/app/api/answers/route.ts`：

```typescript
// answers 通过 session 关联 user，无需改动
// 但需要确保 session 创建时带了 userId
```

- [ ] **Step 3: 修改 stats API**

更新 `src/app/api/stats/route.ts`：

```typescript
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();

  // 所有查询添加 WHERE user_id = ?
  const stars = db
    .prepare(
      `SELECT SUM(correct_count * 3) as total
       FROM sessions
       WHERE user_id = ? AND finished_at IS NOT NULL`
    )
    .get(userId) as { total: number };

  // ... 其他查询类似
}
```

- [ ] **Step 4: 修改 mistakes API**

更新 `src/app/api/mistakes/route.ts`：

```typescript
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();

  // 查询该用户的错题
  const mistakes = db
    .prepare(
      `SELECT DISTINCT q.*
       FROM questions q
       JOIN answers a ON a.question_id = q.id
       JOIN sessions s ON s.id = a.session_id
       WHERE s.user_id = ? AND a.is_correct = 0`
    )
    .all(userId);

  return NextResponse.json({ questions: mistakes });
}
```

- [ ] **Step 5: 修改 exam API**

更新 `src/app/api/exam/route.ts`：

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();

  // 创建 session 时带 userId
  const session = db
    .prepare(
      "INSERT INTO sessions (user_id, mode, started_at) VALUES (?, 'exam', ?)"
    )
    .run(userId, Date.now());

  // ... 其他逻辑
}
```

- [ ] **Step 6: 提交**

```bash
git add src/app/api/
git commit -m "feat: update all APIs to support userId parameter

- sessions: require userId in POST
- stats: filter by userId query param
- mistakes: filter by userId query param
- exam: require userId in POST
- answers: no change (linked via session)"
```

---

### Task 4: 首页改为用户选择界面

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `/api/users` GET
- Produces: 用户选择卡片网格

- [ ] **Step 1: 改造首页**

重写 `src/app/page.tsx`：

```typescript
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { Kangaroo } from "@/components/mascot/Kangaroo";

interface User {
  id: number;
  name: string;
  emoji: string;
}

export default function HomePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users);
        setLoading(false);
      });
  }, []);

  const selectUser = (userId: number) => {
    localStorage.setItem("kangaroo-current-user", String(userId));
    window.location.href = "/dashboard";
  };

  if (loading) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <OutbackBackground />
        <Kangaroo mood="idle" className="h-40 animate-idle-hop" />
      </main>
    );
  }

  if (users.length === 0) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <OutbackBackground />
        <div className="mx-auto max-w-md rounded-[2rem] border-4 border-cocoa/10 bg-white/95 p-8 text-center shadow-xl">
          <Kangaroo mood="happy" className="mx-auto h-32 animate-idle-hop" />
          <h1 className="mt-4 font-kids text-3xl">欢迎来到袋鼠数学！</h1>
          <p className="mt-2 text-cocoa/70">先创建第一个用户吧</p>
          <Link
            href="/parents"
            className="mt-6 inline-block rounded-full bg-sunny px-8 py-4 font-kids text-2xl text-white shadow-lg active:translate-y-1"
          >
            去家长面板 ➡️
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8 text-center">
          <h1 className="font-kids text-4xl">选择你的账号</h1>
          <p className="mt-2 text-cocoa/60">Pick your account</p>
        </header>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user.id)}
              className="group rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 text-center shadow-xl transition hover:-rotate-2 hover:border-sunny hover:shadow-2xl active:translate-y-1"
            >
              <div className="text-6xl transition group-hover:scale-110">
                {user.emoji}
              </div>
              <div className="mt-3 font-kids text-2xl">{user.name}</div>
            </button>
          ))}

          <Link
            href="/parents"
            className="flex items-center justify-center rounded-[2rem] border-4 border-dashed border-cocoa/20 bg-white/50 p-6 text-center transition hover:border-sunny hover:bg-white/80"
          >
            <div>
              <div className="text-6xl">➕</div>
              <div className="mt-3 font-kids text-xl text-cocoa/60">
                添加新用户
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/page.tsx
git commit -m "feat: redesign homepage as user selection interface

- Show user cards with emoji and name
- Click to select user and store in localStorage
- Redirect to /parents if no users exist
- Add 'add new user' card linking to parents panel"
```

---

### Task 5: 添加顶部用户栏

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/layout/UserBar.tsx`

**Interfaces:**
- Consumes: `kangaroo-current-user` from localStorage
- Produces: 顶部用户栏（emoji + 名字 + 切换按钮）

- [ ] **Step 1: 创建 UserBar 组件**

创建 `src/components/layout/UserBar.tsx`：

```typescript
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface User {
  id: number;
  name: string;
  emoji: string;
}

export function UserBar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem("kangaroo-current-user");
    if (userId) {
      fetch("/api/users")
        .then((r) => r.json())
        .then((data) => {
          const found = data.users.find((u: User) => u.id === Number(userId));
          if (found) setUser(found);
        });
    }
  }, []);

  if (!user) return null;

  const switchUser = () => {
    localStorage.removeItem("kangaroo-current-user");
    window.location.href = "/";
  };

  return (
    <div className="sticky top-0 z-40 border-b-4 border-cocoa/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{user.emoji}</span>
          <span className="font-kids text-xl">{user.name}</span>
        </div>
        <button
          type="button"
          onClick={switchUser}
          className="rounded-full bg-cocoa/10 px-4 py-1 font-kids text-sm transition hover:bg-cocoa/20"
        >
          切换账号
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 layout 中添加 UserBar**

修改 `src/app/layout.tsx`，在 `<body>` 内添加：

```typescript
<body className={cn(font.className, "min-h-dvh bg-sky-soft text-cocoa antialiased")}>
  <UserBar />
  {children}
</body>
```

- [ ] **Step 3: 提交**

```bash
git add src/components/layout/UserBar.tsx src/app/layout.tsx
git commit -m "feat: add user bar to top of all pages

- Display current user emoji and name
- Add 'switch user' button to clear localStorage
- Show on all pages except homepage"
```

---

### Task 6: 更新练习/考试/错题页面支持多用户

**Files:**
- Modify: `src/app/practice/page.tsx`
- Modify: `src/app/exam/page.tsx`
- Modify: `src/app/mistakes/page.tsx`

**Interfaces:**
- Consumes: `kangaroo-current-user` from localStorage
- Produces: API calls with userId parameter

- [ ] **Step 1: 更新 practice 页面**

在 `src/app/practice/page.tsx` 中：

```typescript
// 在 start() 函数中
const userId = localStorage.getItem("kangaroo-current-user");
if (!userId) {
  window.location.href = "/";
  return;
}

const [sessRes, qsRes] = await Promise.all([
  fetchWithTimeout("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "practice", userId: Number(userId) }),
  }),
  fetchWithTimeout(`/api/questions?topic=${topic}&limit=${PRACTICE_SIZE}`),
]);
```

- [ ] **Step 2: 更新 exam 页面**

在 `src/app/exam/page.tsx` 中：

```typescript
// 在 begin() 函数中
const userId = localStorage.getItem("kangaroo-current-user");
if (!userId) {
  window.location.href = "/";
  return;
}

const res = await fetchWithTimeout("/api/exam", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ userId: Number(userId) }),
});
```

- [ ] **Step 3: 更新 mistakes 页面**

在 `src/app/mistakes/page.tsx` 中：

```typescript
// 在 useEffect 中
const userId = localStorage.getItem("kangaroo-current-user");
if (!userId) {
  window.location.href = "/";
  return;
}

const [mRes, sRes] = await Promise.all([
  fetchWithTimeout(`/api/mistakes?userId=${userId}`),
  fetchWithTimeout("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "practice", userId: Number(userId) }),
  }),
]);
```

- [ ] **Step 4: 提交**

```bash
git add src/app/practice/page.tsx src/app/exam/page.tsx src/app/mistakes/page.tsx
git commit -m "feat: update practice/exam/mistakes pages for multi-user

- Read userId from localStorage
- Pass userId to all API calls
- Redirect to homepage if no user selected"
```

---

### Task 7: 家长面板添加用户管理

**Files:**
- Modify: `src/app/parents/page.tsx`

**Interfaces:**
- Consumes: `/api/users` endpoints
- Produces: 用户管理 UI（列表、添加、编辑、删除）

- [ ] **Step 1: 添加用户管理区块**

在 `src/app/parents/page.tsx` 中添加用户管理状态和 UI：

```typescript
interface User {
  id: number;
  name: string;
  emoji: string;
}

const [users, setUsers] = useState<User[]>([]);
const [editingUser, setEditingUser] = useState<User | null>(null);
const [newUserName, setNewUserName] = useState("");
const [newUserEmoji, setNewUserEmoji] = useState("🐨");

// 加载用户列表
useEffect(() => {
  if (unlocked) {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users));
  }
}, [unlocked]);

// 添加用户
const addUser = async () => {
  if (!newUserName.trim()) return;
  await fetch("/api/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: newUserName, emoji: newUserEmoji }),
  });
  setNewUserName("");
  setNewUserEmoji("🐨");
  const res = await fetch("/api/users");
  const data = await res.json();
  setUsers(data.users);
};

// 删除用户
const deleteUser = async (id: number) => {
  if (!confirm("确定删除这个用户吗？所有学习数据都会被删除！")) return;
  await fetch(`/api/users/${id}`, { method: "DELETE" });
  const res = await fetch("/api/users");
  const data = await res.json();
  setUsers(data.users);
};

// 更新用户
const updateUser = async () => {
  if (!editingUser) return;
  await fetch(`/api/users/${editingUser.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: editingUser.name,
      emoji: editingUser.emoji,
    }),
  });
  setEditingUser(null);
  const res = await fetch("/api/users");
  const data = await res.json();
  setUsers(data.users);
};
```

- [ ] **Step 2: 添加用户管理 UI**

在家长面板中添加用户管理区块：

```typescript
<section className="rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl">
  <h2 className="font-kids text-2xl">用户管理</h2>

  {/* 用户列表 */}
  <div className="mt-4 space-y-3">
    {users.map((user) => (
      <div
        key={user.id}
        className="flex items-center justify-between rounded-2xl border-2 border-cocoa/10 bg-white p-4"
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl">{user.emoji}</span>
          <span className="font-kids text-xl">{user.name}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditingUser(user)}
            className="rounded-full bg-sunny px-4 py-1 font-kids text-white"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={() => deleteUser(user.id)}
            className="rounded-full bg-coral px-4 py-1 font-kids text-white"
          >
            删除
          </button>
        </div>
      </div>
    ))}
  </div>

  {/* 添加新用户 */}
  <div className="mt-6 rounded-2xl border-2 border-dashed border-cocoa/20 p-4">
    <h3 className="font-kids text-lg">添加新用户</h3>
    <div className="mt-3 flex gap-3">
      <input
        type="text"
        value={newUserEmoji}
        onChange={(e) => setNewUserEmoji(e.target.value)}
        className="w-16 rounded-2xl border-2 border-cocoa/15 p-2 text-center text-2xl"
        maxLength={2}
      />
      <input
        type="text"
        value={newUserName}
        onChange={(e) => setNewUserName(e.target.value)}
        placeholder="名字"
        className="flex-1 rounded-2xl border-2 border-cocoa/15 p-2 font-kids"
      />
      <button
        type="button"
        onClick={addUser}
        className="rounded-full bg-grass px-6 py-2 font-kids text-white"
      >
        添加
      </button>
    </div>
  </div>
</section>

{/* 编辑用户弹窗 */}
{editingUser && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-cocoa/40 p-4">
    <div className="w-full max-w-sm rounded-3xl bg-white p-6">
      <h3 className="font-kids text-2xl">编辑用户</h3>
      <div className="mt-4 space-y-3">
        <div>
          <label className="font-kids">头像</label>
          <input
            type="text"
            value={editingUser.emoji}
            onChange={(e) =>
              setEditingUser({ ...editingUser, emoji: e.target.value })
            }
            className="mt-1 w-full rounded-2xl border-2 border-cocoa/15 p-2 text-center text-3xl"
            maxLength={2}
          />
        </div>
        <div>
          <label className="font-kids">名字</label>
          <input
            type="text"
            value={editingUser.name}
            onChange={(e) =>
              setEditingUser({ ...editingUser, name: e.target.value })
            }
            className="mt-1 w-full rounded-2xl border-2 border-cocoa/15 p-2 font-kids"
          />
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => setEditingUser(null)}
          className="flex-1 rounded-full border-2 border-cocoa/10 bg-white p-3 font-kids"
        >
          取消
        </button>
        <button
          type="button"
          onClick={updateUser}
          className="flex-1 rounded-full bg-sunny p-3 font-kids text-white"
        >
          保存
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: 提交**

```bash
git add src/app/parents/page.tsx
git commit -m "feat: add user management to parents panel

- List all users with emoji and name
- Add new user form
- Edit user modal (change name and emoji)
- Delete user with confirmation dialog
- Cascade delete all user data"
```

---

### Task 8: 测试和验证

**Files:**
- Test all pages manually

- [ ] **Step 1: 测试用户创建流程**

1. 访问首页，显示"创建第一个用户"引导
2. 点击"去家长面板"
3. 通过算术门验证
4. 添加第一个用户（名字：大宝，emoji：🐰）
5. 返回首页，看到用户卡片

- [ ] **Step 2: 测试多用户切换**

1. 添加第二个用户（名字：小宝，emoji：🐱）
2. 点击大宝卡片，进入 dashboard
3. 做几道练习题
4. 点击"切换账号"，返回首页
5. 点击小宝卡片，做几道题
6. 进入家长面板，查看两个用户的统计数据是否独立

- [ ] **Step 3: 测试用户管理**

1. 在家长面板编辑大宝的名字
2. 删除小宝用户
3. 确认删除后，小宝的数据全部清除
4. 重新添加小宝

- [ ] **Step 4: 提交**

```bash
git commit --allow-empty -m "test: verify multi-user functionality

- User creation flow works
- User switching works
- Data isolation verified
- User management (edit/delete) works"
```

---

## 实施顺序

1. Task 1: 数据库架构升级
2. Task 2: 用户管理 API
3. Task 3: 修改现有 API 支持 userId
4. Task 4: 首页改为用户选择界面
5. Task 5: 添加顶部用户栏
6. Task 6: 更新练习/考试/错题页面
7. Task 7: 家长面板添加用户管理
8. Task 8: 测试和验证
