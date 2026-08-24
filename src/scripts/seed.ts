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
  { source: "shangshi", dir: "shangshi", required: false },
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
