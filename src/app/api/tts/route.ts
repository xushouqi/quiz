import { NextResponse } from "next/server";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural";

function cacheDir(): string {
  return path.join(process.cwd(), "data", "tts-cache");
}

function cacheKey(text: string, voice: string): string {
  return crypto.createHash("sha256").update(`${voice}\u0000${text}`).digest("hex");
}

// 调用 Python edge-tts wrapper 生成语音
function generateTTS(text: string, voice = DEFAULT_VOICE): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts/edge-tts-wrapper.py");
    const proc = spawn("python3", [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const chunks: Buffer[] = [];
    let stderr = "";

    proc.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`edge-tts exited码 ${code}: ${stderr}`));
      } else {
        resolve(Buffer.concat(chunks));
      }
    });

    proc.on("error", reject);

    // 传入 JSON 参数
    proc.stdin.write(JSON.stringify({ text, voice }));
    proc.stdin.end();
  });
}

// 进程内 single-flight：相同 key 的并发生成共享一个任务，避免重复调用外部 TTS
const inflight = new Map<string, Promise<Buffer>>();

async function getAudio(text: string, voice: string): Promise<Buffer> {
  const key = cacheKey(text, voice);
  const file = path.join(cacheDir(), `${key}.mp3`);

  // 1. 磁盘缓存命中：毫秒级返回
  try {
    return await fs.readFile(file);
  } catch {
    // 缓存未命中，继续生成
  }

  // 2. 并发生成去重
  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      const buf = await generateTTS(text, voice);
      // 持久化缓存；写盘失败不影响本次返回
      await fs.mkdir(cacheDir(), { recursive: true }).catch(() => undefined);
      await fs.writeFile(file, buf).catch(() => undefined);
      return buf;
    })();
    inflight.set(key, pending);
    void pending.finally(() => inflight.delete(key));
  }
  return pending;
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'text' field" },
        { status: 400 }
      );
    }

    // 限制长度，避免滥用
    if (text.length > 500) {
      return NextResponse.json(
        { error: "Text too long (max 500 chars)" },
        { status: 400 }
      );
    }

    const audioBuffer = await getAudio(text, DEFAULT_VOICE);

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Edge TTS error:", error);
    return NextResponse.json(
      { error: "TTS generation failed" },
      { status: 500 }
    );
  }
}
