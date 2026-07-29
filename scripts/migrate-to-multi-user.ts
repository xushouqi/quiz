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
const tableExists = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
  .get();

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
db.exec(
  "ALTER TABLE sessions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"
);
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
