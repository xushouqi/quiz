import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🐨',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  difficulty INTEGER NOT NULL CHECK (difficulty IN (1, 2, 3, 4, 5, 6)),
  topic TEXT NOT NULL CHECK (topic IN ('counting', 'shapes', 'patterns', 'logic', 'arithmetic', 'time', 'number_theory', 'word_problems', 'combinatorics', 'travel')),
  text_zh TEXT NOT NULL,
  text_en TEXT NOT NULL,
  illustration TEXT,
  choices TEXT NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index IN (0, 1, 2, 3, 4)),
  explanation_zh TEXT NOT NULL,
  explanation_en TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'practice' CHECK (source IN ('practice', 'official', 'simulation', 'shangshi', 'olympiad')),
  attribution TEXT
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
  chosen_index INTEGER CHECK (chosen_index IS NULL OR chosen_index IN (0, 1, 2, 3, 4)),
  is_correct INTEGER CHECK (is_correct IS NULL OR is_correct IN (0, 1)),
  time_spent_seconds INTEGER,
  created_at INTEGER NOT NULL
);

-- idx_sessions_user 在 migrate() 中创建：multi-user 之前的旧库 sessions 无 user_id 列
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
  // multi-user 之前的旧库 sessions 无 user_id，SCHEMA 里的索引改在此处按列存在与否补建
  const sessionCols = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
  if (sessionCols.some((c) => c.name === "user_id")) {
    db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)");
  }
  // 选项数从固定 3 放宽到 3–5：旧库的 CHECK 只允许 correct_index/chosen_index ∈ {0,1,2}，
  // SQLite 不能 ALTER 掉 CHECK，故在约束仍为旧值时整表重建（数据原样复制）。
  widenChoiceIndexConstraints(db);
  // 新增 shangshi source：旧库 CHECK 只允许 practice/official/simulation，需要重建表
  widenSourceConstraint(db);
  // 选项数从 5 放宽到 8（上实机考 Q23-28 为 A–H 八选项）：旧库 CHECK 只允许 correct_index/chosen_index ∈ {0..4}
  widenChoiceIndexConstraints8(db);
  // 扩展 topic（+4 奥数分类）和 difficulty（3-5 → 1-6）
  widenTopicAndDifficulty(db);
  // 新增 olympiad source（小学奥数题库）：旧库 CHECK 不含它，需要重建表
  widenSourceOlympiad(db);
}

function widenSourceOlympiad(db: Database.Database): void {
  const qSql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='questions'")
    .get() as { sql: string } | undefined;
  if (!qSql?.sql) return;
  if (qSql.sql.includes("'olympiad'")) return;
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("DROP TABLE IF EXISTS questions_new;");
  db.exec(`
    CREATE TABLE questions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      difficulty INTEGER NOT NULL CHECK (difficulty IN (1, 2, 3, 4, 5, 6)),
      topic TEXT NOT NULL CHECK (topic IN ('counting', 'shapes', 'patterns', 'logic', 'arithmetic', 'time', 'number_theory', 'word_problems', 'combinatorics', 'travel')),
      text_zh TEXT NOT NULL,
      text_en TEXT NOT NULL,
      illustration TEXT,
      choices TEXT NOT NULL,
      correct_index INTEGER NOT NULL CHECK (correct_index IN (0, 1, 2, 3, 4, 5, 6, 7)),
      explanation_zh TEXT NOT NULL,
      explanation_en TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'practice' CHECK (source IN ('practice', 'official', 'simulation', 'shangshi', 'olympiad')),
      attribution TEXT
    );
    INSERT INTO questions_new SELECT id, difficulty, topic, text_zh, text_en, illustration, choices, correct_index, explanation_zh, explanation_en, source, attribution FROM questions;
    DROP TABLE questions;
    ALTER TABLE questions_new RENAME TO questions;
    CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
  `);
  db.exec("PRAGMA foreign_keys = ON");
}

function widenChoiceIndexConstraints(db: Database.Database): void {
  const qSql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='questions'")
    .get() as { sql: string } | undefined;
  const aSql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='answers'")
    .get() as { sql: string } | undefined;
  const needQ = Boolean(qSql?.sql && qSql.sql.includes("correct_index IN (0, 1, 2)"));
  const needA = Boolean(aSql?.sql && aSql.sql.includes("chosen_index IN (0, 1, 2)"));
  if (!needQ && !needA) return;
  // 重建表需 DROP 被外键引用的 questions，必须临时关闭外键检查
  db.exec("PRAGMA foreign_keys = OFF");
  // 上次迁移若中途失败可能留下临时表，先清掉以保证幂等
  db.exec("DROP TABLE IF EXISTS questions_new; DROP TABLE IF EXISTS answers_new;");
  if (needQ) {
    db.exec(`
      CREATE TABLE questions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        difficulty INTEGER NOT NULL CHECK (difficulty IN (3, 4, 5)),
        topic TEXT NOT NULL CHECK (topic IN ('counting', 'shapes', 'patterns', 'logic', 'arithmetic', 'time')),
        text_zh TEXT NOT NULL,
        text_en TEXT NOT NULL,
        illustration TEXT,
        choices TEXT NOT NULL,
        correct_index INTEGER NOT NULL CHECK (correct_index IN (0, 1, 2, 3, 4)),
        explanation_zh TEXT NOT NULL,
        explanation_en TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'practice' CHECK (source IN ('practice', 'official', 'simulation')),
        attribution TEXT
      );
      INSERT INTO questions_new SELECT id, difficulty, topic, text_zh, text_en, illustration, choices, correct_index, explanation_zh, explanation_en, source, attribution FROM questions;
      DROP TABLE questions;
      ALTER TABLE questions_new RENAME TO questions;
      CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
    `);
  }
  if (needA) {
    db.exec(`
      CREATE TABLE answers_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id),
        chosen_index INTEGER CHECK (chosen_index IS NULL OR chosen_index IN (0, 1, 2, 3, 4)),
        is_correct INTEGER CHECK (is_correct IS NULL OR is_correct IN (0, 1)),
        time_spent_seconds INTEGER,
        created_at INTEGER NOT NULL
      );
      INSERT INTO answers_new SELECT id, session_id, question_id, chosen_index, is_correct, time_spent_seconds, created_at FROM answers;
      DROP TABLE answers;
      ALTER TABLE answers_new RENAME TO answers;
      CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
      CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
    `);
  }
  db.exec("PRAGMA foreign_keys = ON");
}

function widenSourceConstraint(db: Database.Database): void {
  const qSql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='questions'")
    .get() as { sql: string } | undefined;
  if (!qSql?.sql) return;
  // 如果已经包含 shangshi，不需要重建
  if (qSql.sql.includes("'shangshi'")) return;
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("DROP TABLE IF EXISTS questions_new;");
  db.exec(`
    CREATE TABLE questions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      difficulty INTEGER NOT NULL CHECK (difficulty IN (3, 4, 5)),
      topic TEXT NOT NULL CHECK (topic IN ('counting', 'shapes', 'patterns', 'logic', 'arithmetic', 'time')),
      text_zh TEXT NOT NULL,
      text_en TEXT NOT NULL,
      illustration TEXT,
      choices TEXT NOT NULL,
      correct_index INTEGER NOT NULL CHECK (correct_index IN (0, 1, 2, 3, 4)),
      explanation_zh TEXT NOT NULL,
      explanation_en TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'practice' CHECK (source IN ('practice', 'official', 'simulation', 'shangshi')),
      attribution TEXT
    );
    INSERT INTO questions_new SELECT id, difficulty, topic, text_zh, text_en, illustration, choices, correct_index, explanation_zh, explanation_en, source, attribution FROM questions;
    DROP TABLE questions;
    ALTER TABLE questions_new RENAME TO questions;
    CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
  `);
  db.exec("PRAGMA foreign_keys = ON");
}

const globalForDb = globalThis as unknown as { quizDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.quizDb) {
    const dbPath = process.env.QUIZ_DB_PATH ?? path.join(process.cwd(), "data", "quiz.db");
    globalForDb.quizDb = openDb(dbPath);
  }
  return globalForDb.quizDb;
}


function widenChoiceIndexConstraints8(db: Database.Database): void {
  const qSql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='questions'")
    .get() as { sql: string } | undefined;
  const aSql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='answers'")
    .get() as { sql: string } | undefined;
  const needQ = Boolean(qSql?.sql && qSql.sql.includes("correct_index IN (0, 1, 2, 3, 4)"));
  const needA = Boolean(aSql?.sql && aSql.sql.includes("chosen_index IN (0, 1, 2, 3, 4)"));
  if (!needQ && !needA) return;
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("DROP TABLE IF EXISTS questions_new; DROP TABLE IF EXISTS answers_new;");
  if (needQ) {
    db.exec(`
      CREATE TABLE questions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        difficulty INTEGER NOT NULL CHECK (difficulty IN (3, 4, 5)),
        topic TEXT NOT NULL CHECK (topic IN ('counting', 'shapes', 'patterns', 'logic', 'arithmetic', 'time')),
        text_zh TEXT NOT NULL,
        text_en TEXT NOT NULL,
        illustration TEXT,
        choices TEXT NOT NULL,
        correct_index INTEGER NOT NULL CHECK (correct_index IN (0, 1, 2, 3, 4, 5, 6, 7)),
        explanation_zh TEXT NOT NULL,
        explanation_en TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'practice' CHECK (source IN ('practice', 'official', 'simulation', 'shangshi')),
        attribution TEXT
      );
      INSERT INTO questions_new SELECT id, difficulty, topic, text_zh, text_en, illustration, choices, correct_index, explanation_zh, explanation_en, source, attribution FROM questions;
      DROP TABLE questions;
      ALTER TABLE questions_new RENAME TO questions;
      CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
    `);
  }
  if (needA) {
    db.exec(`
      CREATE TABLE answers_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id),
        chosen_index INTEGER CHECK (chosen_index IS NULL OR chosen_index IN (0, 1, 2, 3, 4, 5, 6, 7)),
        is_correct INTEGER CHECK (is_correct IS NULL OR is_correct IN (0, 1)),
        time_spent_seconds INTEGER,
        created_at INTEGER NOT NULL
      );
      INSERT INTO answers_new SELECT id, session_id, question_id, chosen_index, is_correct, time_spent_seconds, created_at FROM answers;
      DROP TABLE answers;
      ALTER TABLE answers_new RENAME TO answers;
      CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
      CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
    `);
  }
  db.exec("PRAGMA foreign_keys = ON");
}

function widenTopicAndDifficulty(db: Database.Database): void {
  const qSql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='questions'")
    .get() as { sql: string } | undefined;
  if (!qSql?.sql) return;
  // 如果已包含新 topic 和新 difficulty，无需迁移
  if (qSql.sql.includes("'number_theory'") && qSql.sql.includes("1, 2, 3, 4, 5, 6")) return;
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("DROP TABLE IF EXISTS questions_new;");
  db.exec(`
    CREATE TABLE questions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      difficulty INTEGER NOT NULL CHECK (difficulty IN (1, 2, 3, 4, 5, 6)),
      topic TEXT NOT NULL CHECK (topic IN ('counting', 'shapes', 'patterns', 'logic', 'arithmetic', 'time', 'number_theory', 'word_problems', 'combinatorics', 'travel')),
      text_zh TEXT NOT NULL,
      text_en TEXT NOT NULL,
      illustration TEXT,
      choices TEXT NOT NULL,
      correct_index INTEGER NOT NULL CHECK (correct_index IN (0, 1, 2, 3, 4, 5, 6, 7)),
      explanation_zh TEXT NOT NULL,
      explanation_en TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'practice' CHECK (source IN ('practice', 'official', 'simulation', 'shangshi')),
      attribution TEXT
    );
    INSERT INTO questions_new SELECT id, difficulty, topic, text_zh, text_en, illustration, choices, correct_index, explanation_zh, explanation_en, source, attribution FROM questions;
    DROP TABLE questions;
    ALTER TABLE questions_new RENAME TO questions;
    CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
  `);
  db.exec("PRAGMA foreign_keys = ON");
}
