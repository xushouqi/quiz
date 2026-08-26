#!/usr/bin/env node
/**
 * 预生成所有题干的离线朗读音频(Edge TTS, zh-CN-XiaoxiaoNeural)。
 *
 * 输出:
 *   - public/tts/<sha256>.mp3             — 静态资源,打包进 APK
 *   - src/lib/offline/audio-map.ts        — 文本 → /tts/<hash>.mp3 映射
 *
 * 复用 data/tts-cache 已有缓存(与 /api/tts 同 key 格式),支持断点续传。
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const Database = require("better-sqlite3");

const VOICE = "zh-CN-XiaoxiaoNeural";
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "quiz.db");
const TTS_CACHE = path.join(ROOT, "data", "tts-cache");
const OUT_DIR = path.join(ROOT, "public", "tts");
const MAP_PATH = path.join(ROOT, "src", "lib", "offline", "audio-map.ts");
const WRAPPER = path.join(ROOT, "scripts", "edge-tts-wrapper.py");

function cacheKey(text) {
  return crypto.createHash("sha256").update(`${VOICE}\0${text}`).digest("hex");
}

// 与 /api/tts 相同的 Edge TTS 调用(JSON 进 stdin, MP3 出 stdout)
function generateTTS(text) {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [WRAPPER], { stdio: ["pipe", "pipe", "pipe"] });
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
  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare("SELECT text_zh FROM questions").all();
  db.close();
  const texts = [...new Set(rows.map((r) => r.text_zh).filter(Boolean))];

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TTS_CACHE, { recursive: true });

  const map = {};
  const toGenerate = [];
  for (const text of texts) {
    const key = cacheKey(text);
    const outFile = path.join(OUT_DIR, `${key}.mp3`);
    if (fs.existsSync(outFile)) {
      map[text] = `/tts/${key}.mp3`;
      continue;
    }
    const cacheFile = path.join(TTS_CACHE, `${key}.mp3`);
    if (fs.existsSync(cacheFile)) {
      fs.copyFileSync(cacheFile, outFile);
      map[text] = `/tts/${key}.mp3`;
      continue;
    }
    toGenerate.push(text);
  }

  console.log(`共 ${texts.length} 条题干文本,待生成 ${toGenerate.length} 条`);

  let done = 0;
  let errors = 0;
  const CONCURRENCY = 3;
  const queue = [...toGenerate];

  async function worker() {
    while (queue.length > 0) {
      const text = queue.shift();
      const key = cacheKey(text);
      const outFile = path.join(OUT_DIR, `${key}.mp3`);
      try {
        const buf = await generateTTS(text);
        fs.writeFileSync(outFile, buf);
        fs.writeFileSync(path.join(TTS_CACHE, `${key}.mp3`), buf);
        map[text] = `/tts/${key}.mp3`;
        done++;
        if (done % 10 === 0 || done === toGenerate.length) {
          console.log(`进度: ${done}/${toGenerate.length}`);
        }
      } catch (err) {
        errors++;
        console.error(`失败: "${text.slice(0, 30)}..." — ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, toGenerate.length) }, () => worker());
  await Promise.all(workers);

  const ts = `// 自动生成:由 scripts/generate-offline-audio.js 生成,请勿手改。
// 重新生成: node scripts/generate-offline-audio.js
export const OFFLINE_AUDIO: Record<string, string> = ${JSON.stringify(map)};
`;
  fs.writeFileSync(MAP_PATH, ts);

  const totalBytes = Object.values(map).reduce((acc, f) => {
    try {
      return acc + fs.statSync(path.join(OUT_DIR, path.basename(f))).size;
    } catch {
      return acc;
    }
  }, 0);
  console.log(`完成: 生成 ${done} 条,失败 ${errors} 条`);
  console.log(`audio-map: ${Object.keys(map).length} 条 → ${MAP_PATH}`);
  console.log(`音频总量: ${(totalBytes / 1024 / 1024).toFixed(1)} MB (${OUT_DIR})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
