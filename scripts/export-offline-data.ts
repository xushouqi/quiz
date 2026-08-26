/**
 * 导出离线数据:读取 data/quiz.db 的全部题目,生成 src/lib/offline/data-embedded.ts。
 * 用法: npx tsx scripts/export-offline-data.ts
 *
 * 该文件由安卓离线构建使用:Capacitor WebView 中运行时 fetch 本地 JSON 不可靠,
 * 因此把题目数据内嵌为 TS 常量,随 bundle 一起打包。
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "quiz.db");
const OUT_PATH = path.join(ROOT, "src", "lib", "offline", "data-embedded.ts");

interface Row {
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
  source: string;
  attribution: string | null;
}

const db = new Database(DB_PATH, { readonly: true });
const rows = db.prepare(
  `SELECT id, difficulty, topic, text_zh, text_en, illustration, choices,
          correct_index, explanation_zh, explanation_en, source, attribution
   FROM questions ORDER BY id`
).all() as Row[];
db.close();

const questions = rows.map((r) => ({
  id: r.id,
  difficulty: r.difficulty,
  topic: r.topic,
  text_zh: r.text_zh,
  text_en: r.text_en,
  illustration: r.illustration,
  choices: JSON.parse(r.choices) as { zh: string; en: string; img?: string }[],
  correct_index: r.correct_index,
  explanation_zh: r.explanation_zh,
  explanation_en: r.explanation_en,
  source: r.source,
  attribution: r.attribution,
}));

const body = JSON.stringify({ questions });
const ts = `// 自动生成:由 scripts/export-offline-data.ts 生成,请勿手改。
// 重新生成: npx tsx scripts/export-offline-data.ts
export const OFFLINE_DATA = ${body} as const;
`;

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, ts);
console.log(
  `OK: ${questions.length} questions → ${OUT_PATH} (${(Buffer.byteLength(body) / 1024).toFixed(0)} KB)`
);
