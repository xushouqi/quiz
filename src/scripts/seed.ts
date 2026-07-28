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
