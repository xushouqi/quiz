import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

// 调用 Python edge-tts wrapper 生成语音
function generateTTS(text: string, voice = "zh-CN-XiaoxiaoNeural"): Promise<Buffer> {
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

    const audioBuffer = await generateTTS(text);

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
