import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
});
