#!/usr/bin/env node
/**
 * 检查奥数题库中所有题目是否都有语音
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// 加载音频映射
const audioMapPath = path.join(root, 'src/lib/offline/audio-map.ts');
const audioMapContent = fs.readFileSync(audioMapPath, 'utf-8');

// 解析音频映射（提取键值对）
const audioMap = {};
const regex = /"([^"]+)":"\/tts\/[^"]+"/g;
let match;
while ((match = regex.exec(audioMapContent)) !== null) {
  audioMap[match[1]] = true;
}

console.log(`已加载 ${Object.keys(audioMap).length} 个音频条目\n`);

// 加载所有奥数题目
const olympiadDir = path.join(root, 'questions/olympiad');
const files = fs.readdirSync(olympiadDir).filter(f => f.endsWith('.json'));

let totalQuestions = 0;
let withAudio = 0;
let withoutAudio = 0;
const missingAudio = [];

for (const file of files) {
  const filePath = path.join(olympiadDir, file);
  const questions = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  for (const q of questions) {
    totalQuestions++;
    const text = q.text_zh;

    if (audioMap[text]) {
      withAudio++;
    } else {
      withoutAudio++;
      missingAudio.push({
        file: file.replace('.json', ''),
        difficulty: q.difficulty,
        text: text.substring(0, 60) + (text.length > 60 ? '...' : ''),
        fullText: text
      });
    }
  }
}

console.log('=== 奥数题库语音检查报告 ===\n');
console.log(`总题数: ${totalQuestions}`);
console.log(`有语音: ${withAudio}`);
console.log(`无语音: ${withoutAudio}`);
console.log(`覆盖率: ${((withAudio / totalQuestions) * 100).toFixed(1)}%\n`);

if (missingAudio.length > 0) {
  console.log('=== 缺少语音的题目 ===\n');

  // 按文件分组显示
  const byFile = {};
  for (const item of missingAudio) {
    if (!byFile[item.file]) byFile[item.file] = [];
    byFile[item.file].push(item);
  }

  for (const [file, items] of Object.entries(byFile)) {
    console.log(`【${file}】(${items.length} 题)`);
    for (const item of items) {
      console.log(`  [难度${item.difficulty}] ${item.text}`);
    }
    console.log();
  }
} else {
  console.log('✅ 所有题目都有语音！');
}
