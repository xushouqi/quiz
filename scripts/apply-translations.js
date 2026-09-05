#!/usr/bin/env node
/**
 * 批量应用翻译到 JSON 文件
 *
 * 用法: node apply-translations.js <translations-file>
 *
 * translations-file 格式:
 * {
 *   "counting.json": [
 *     { "index": 0, "text_en": "...", "explanation_en": "...", "choices_en": [...] },
 *     ...
 *   ],
 *   "time.json": [...],
 *   ...
 * }
 */

const fs = require('fs');
const path = require('path');

const translationsFile = process.argv[2];
if (!translationsFile) {
  console.error('用法: node apply-translations.js <translations-file>');
  process.exit(1);
}

const translations = JSON.parse(fs.readFileSync(translationsFile, 'utf8'));

let totalApplied = 0;
const stats = {};

for (const [filename, items] of Object.entries(translations)) {
  const filepath = path.join('questions/olympiad', filename);
  if (!fs.existsSync(filepath)) {
    console.error(`❌ 文件不存在: ${filepath}`);
    continue;
  }

  const questions = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  let applied = 0;

  for (const item of items) {
    const q = questions[item.index];
    if (!q) {
      console.error(`❌ ${filename}[${item.index}] 不存在`);
      continue;
    }

    if (item.text_en !== undefined) q.text_en = item.text_en;
    if (item.explanation_en !== undefined) q.explanation_en = item.explanation_en;

    if (item.choices_en && Array.isArray(item.choices_en)) {
      item.choices_en.forEach((en, i) => {
        if (q.choices[i]) {
          q.choices[i].en = en;
        }
      });
    }

    applied++;
  }

  fs.writeFileSync(filepath, JSON.stringify(questions, null, 2));
  stats[filename] = applied;
  totalApplied += applied;
  console.log(`✅ ${filename}: 应用了 ${applied} 条翻译`);
}

console.log(`\n📊 总计应用: ${totalApplied} 条翻译`);

// 显示当前进度
console.log('\n当前翻译进度:');
const files = fs.readdirSync('questions/olympiad').filter(f => f.endsWith('.json'));
for (const file of files.sort()) {
  const questions = JSON.parse(fs.readFileSync(path.join('questions/olympiad', file), 'utf8'));
  const translated = questions.filter(q => q.text_en && q.text_en !== q.text_zh).length;
  const percent = ((translated / questions.length) * 100).toFixed(1);
  console.log(`  ${file}: ${translated}/${questions.length} (${percent}%)`);
}
