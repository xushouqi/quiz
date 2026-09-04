#!/usr/bin/env node
/**
 * 奥数题综合修复脚本
 *
 * 1. 文件内去重：同文件内 text_zh 完全相同的题，保留解析最长版本
 * 2. 答案分布均衡化：对恰好 4 选项的题，基于题面 hash 确定性打乱
 * 3. 文本清理：修复句中 awkward ____ 和标点异常
 */
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "questions/olympiad");
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();

// ---------- utils ----------
function hashStr(s) {
  // simple 32-bit hash for deterministic shuffle
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededPermutation(arr, seed) {
  // Fisher-Yates with seed-based RNG
  const a = arr.slice();
  let s = seed;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Phase 1: 文件内去重 ----------
let totalRemovedDups = 0;
const crossFileConflicts = []; // 记录跨文件冲突

const fileData = {}; // file -> array
for (const f of FILES) {
  const data = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  fileData[f] = data;
}

// 先收集所有题目（跨文件），用于冲突检测
const allTextMap = new Map(); // text_zh -> [{file, idx, q}]
for (const f of FILES) {
  for (let i = 0; i < fileData[f].length; i++) {
    const q = fileData[f][i];
    const key = q.text_zh.trim();
    if (!allTextMap.has(key)) allTextMap.set(key, []);
    allTextMap.get(key).push({ file: f, idx: i, q });
  }
}

// 文件内去重
for (const f of FILES) {
  const seen = new Map(); // text -> {bestIdx, bestQ}
  const toRemove = new Set();
  for (let i = 0; i < fileData[f].length; i++) {
    const q = fileData[f][i];
    const key = q.text_zh.trim();
    if (seen.has(key)) {
      const prev = seen.get(key);
      // 保留解析更长的；同长保留先出现的
      const prevLen = prev.q.explanation_zh?.length || 0;
      const curLen = q.explanation_zh?.length || 0;
      if (curLen > prevLen) {
        toRemove.add(prev.idx);
        seen.set(key, { idx: i, q });
      } else {
        toRemove.add(i);
      }
    } else {
      seen.set(key, { idx: i, q });
    }
  }
  if (toRemove.size > 0) {
    const before = fileData[f].length;
    fileData[f] = fileData[f].filter((_, i) => !toRemove.has(i));
    const removed = before - fileData[f].length;
    totalRemovedDups += removed;
    console.log(`  ${f}: 去重 ${removed} 题 (${before} → ${fileData[f].length})`);
  }
}

// 跨文件冲突报告
for (const [text, entries] of allTextMap) {
  if (entries.length < 2) continue;
  // 去重后，检查是否仍有同文本但不同答案
  const answers = new Set(
    entries.map((e) => {
      const curFile = fileData[e.file];
      // 找到当前文件中对应的题
      const match = curFile.find((q) => q.text_zh.trim() === text);
      return match ? match.choices?.[match.correct_index]?.zh : null;
    }).filter(Boolean),
  );
  if (answers.size > 1) {
    crossFileConflicts.push({
      text: text.slice(0, 80),
      count: entries.length,
      answers: [...answers],
      files: entries.map((e) => e.file),
    });
  }
}

console.log(`\n文件内去重: 共移除 ${totalRemovedDups} 题`);
console.log(`跨文件答案冲突: ${crossFileConflicts.length} 组`);
if (crossFileConflicts.length > 0) {
  console.log("  冲突列表:");
  for (const c of crossFileConflicts.slice(0, 20)) {
    console.log(`    「${c.text}...」`);
    console.log(`      答案: ${c.answers.join(" | ")}`);
    console.log(`      文件: ${[...new Set(c.files)].join(", ")}`);
  }
}

// ---------- Phase 2: 答案分布均衡化 ----------
// 对恰好 4 选项的题，基于题面 hash 做确定性打乱
let shuffled = 0;
let dist = { 0: 0, 1: 0, 2: 0, 3: 0 };

for (const f of FILES) {
  for (const q of fileData[f]) {
    if (q.choices?.length !== 4) {
      if (q.choices?.length === 4) {
        // 不会到这里
      }
      // 非 4 选项：只统计当前答案位置
      if (typeof q.correct_index === "number") {
        dist[q.correct_index] = (dist[q.correct_index] || 0) + 1;
      }
      continue;
    }
    const seed = hashStr(q.text_zh);
    const perm = seededPermutation([0, 1, 2, 3], seed);
    // perm[i] = 新位置 i 对应的原位置
    // 我们需要：新选项[newPos] = 旧选项[perm[newPos]]
    // 新 correct_index = perm 中 oldCorrect 的位置
    const oldCorrect = q.correct_index;
    const newCorrect = perm.indexOf(oldCorrect);
    if (newCorrect === oldCorrect) {
      // 没变化，只统计
      dist[oldCorrect]++;
      continue;
    }
    const newChoices = perm.map((i) => q.choices[i]);
    q.choices = newChoices;
    q.correct_index = newCorrect;
    dist[newCorrect]++;
    shuffled++;
  }
}

console.log(`\n答案打乱: ${shuffled} 题 4 选项被打乱`);
console.log("打乱后答案位置分布:", dist);

// ---------- Phase 3: 文本清理 ----------
let cleanedBlanks = 0;
let cleanedPunct = 0;

for (const f of FILES) {
  for (const q of fileData[f]) {
    let t = q.text_zh;
    const orig = t;

    // 修复 "两____人" → "两人"（中间无意义的填空）
    // 模式: 量词/代词 + ____ + 量词/名词（无空格）
    t = t.replace(/两____人/g, "两人");
    t = t.replace(/这____次/g, "这次");
    t = t.replace(/这____个/g, "这个");
    t = t.replace(/那____个/g, "那个");
    t = t.replace(/共____有/g, "共有");

    // 修复单位前的 ____： "10____秒" → "10秒"
    // 注意：如果____后面紧跟单位（秒/元/个/岁/天/米/厘米/千克/分/时/场/种/棵/只/条/位/名/朵/粒/顶/张/本/块/排），直接去掉____
    t = t.replace(/____(秒|元|个|岁|天|米|厘米|千克|分|时|场|种|棵|只|条|位|名|朵|粒|顶|张|本|块|排|次|人)/g, "$1");

    // 修复末尾多余标点： "...____．" → "...____．" 保持不变（正常的填空格式）
    // 修复 "...____。" 中文句号前____保留

    // 修复 "3...10" → "3…10"
    t = t.replace(/(\d)\.\.\.(\d)/g, "$1…$2");

    // 修复 "． ．" 等连续标点
    t = t.replace(/．\s*．/g, "．");

    // 修复末尾多余空格
    t = t.replace(/\s+．$/g, "．");

    if (t !== orig) {
      q.text_zh = t;
      if (orig.replace(/____/g, "") !== t.replace(/____/g, "")) {
        cleanedBlanks++;
      } else {
        cleanedPunct++;
      }
    }
  }
}

console.log(`\n文本清理: ${cleanedBlanks} 处占位符修复, ${cleanedPunct} 处标点修复`);

// ---------- 写回 ----------
for (const f of FILES) {
  fs.writeFileSync(
    path.join(DIR, f),
    JSON.stringify(fileData[f], null, 2) + "\n",
    "utf8",
  );
}

// 最终统计
let finalCount = 0;
let finalDist = {};
let finalChoiceDist = {};
for (const f of FILES) {
  finalCount += fileData[f].length;
  for (const q of fileData[f]) {
    finalDist[q.difficulty] = (finalDist[q.difficulty] || 0) + 1;
    const n = q.choices?.length || 0;
    finalChoiceDist[n] = (finalChoiceDist[n] || 0) + 1;
  }
}
console.log(`\n最终统计:`);
console.log(`  总题数: ${finalCount}`);
console.log(`  难度分布:`, finalDist);
console.log(`  选项数分布:`, finalChoiceDist);

// 最终答案位置分布（4 选项题）
let final4Dist = { 0: 0, 1: 0, 2: 0, 3: 0 };
for (const f of FILES) {
  for (const q of fileData[f]) {
    if (q.choices?.length === 4) {
      final4Dist[q.correct_index]++;
    }
  }
}
console.log(`  4选项题答案分布:`, final4Dist);
