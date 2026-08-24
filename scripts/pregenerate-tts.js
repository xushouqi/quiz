#!/usr/bin/env node
/**
 * 预生成所有题目的语音文件（Edge TTS）
 *
 * 遍历 questions/ 下所有 JSON，提取 text_zh，调用 edge-tts-wrapper.py 生成 MP3，
 * 存入 data/tts-cache/<sha256>.mp3（与 API route 相同的缓存格式）。
 * 已存在的文件跳过。
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const VOICE = "zh-CN-XiaoxiaoNeural";
const CACHE_DIR = path.join(__dirname, "..", "data", "tts-cache");
const QUESTIONS_DIR = path.join(__dirname, "..", "questions");
const WRAPPER = path.join(__dirname, "edge-tts-wrapper.py");

function cacheKey(text, voice) {
  return crypto.createHash("sha256").update(`${voice}\0${text}`).digest("hex");
}

// 递归加载所有题目 JSON
function loadAllQuestions() {
  const questions = [];
  for (const dir of ["practice", "official", "simulation"]) {
    const dirPath = path.join(QUESTIONS_DIR, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith(".json")) continue;
      const data = JSON.parse(fs.readFileSync(path.join(dirPath, file), "utf-8"));
      for (const q of data) {
        if (q.text_zh) questions.push(q.text_zh);
      }
    }
  }
  return [...new Set(questions)]; // 去重
}

function generateTTS(text) {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [WRAPPER], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const chunks = [];
    let stderr = "";
    proc.stdout.on("data", (c) => chunks.push(Buffer.from(c)));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`edge-tts exited ${code}: ${stderr}`));
      else resolve(Buffer.concat(chunks));
    });
    proc.on("error", reject);
    proc.stdin.write(JSON.stringify({ text, voice: VOICE }));
    proc.stdin.end();
  });
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const texts = loadAllQuestions();
  console.log(`找到 ${texts.length} 条唯一题目文本`);

  // 过滤掉已缓存的
  const toGenerate = texts.filter((t) => {
    const file = path.join(CACHE_DIR, `${cacheKey(t, VOICE)}.mp3`);
    return !fs.existsSync(file);
  });

  console.log(`需生成 ${toGenerate.length} 条（已有 ${texts.length - toGenerate.length} 条缓存）`);

  let done = 0;
  let errors = 0;

  // 并发 3 路生成，避免把网络打满
  const CONCURRENCY = 3;
  const queue = [...toGenerate];

  async function worker() {
    while (queue.length > 0) {
      const text = queue.shift();
      const key = cacheKey(text, VOICE);
      const file = path.join(CACHE_DIR, `${key}.mp3`);
      try {
        const buf = await generateTTS(text);
        fs.writeFileSync(file, buf);
        done++;
        if (done % 10 === 0 || done === toGenerate.length) {
          console.log(`进度: ${done}/${toGenerate.length}`);
        }
      } catch (err) {
        errors++;
        console.error(`失败: "${text.slice(0, 40)}..." — ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, toGenerate.length) }, () => worker());
  await Promise.all(workers);

  console.log(`\n完成！生成 ${done} 条，失败 ${errors} 条`);
  console.log(`缓存目录: ${CACHE_DIR}（共 ${fs.readdirSync(CACHE_DIR).length} 个文件）`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
