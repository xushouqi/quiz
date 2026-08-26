/**
 * 安卓离线构建脚本:
 * 1. 临时移走 src/app/api(静态导出不支持 route handlers)
 * 2. NEXT_PUBLIC_OFFLINE=true 运行 next build → 输出 out/
 * 3. 无论成败都恢复 api 目录,保证在线构建不受影响
 *
 * 用法: npm run build:android
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiDir = path.join(root, "src", "app", "api");
// 注意:备份目录不能放在 src/app/ 内,否则 Next.js App Router 会把它当作路由段
const bakDir = path.join(root, "src", "api.bak-offline");

const hadApi = fs.existsSync(apiDir);
if (hadApi) fs.renameSync(apiDir, bakDir);

let exitCode = 0;
try {
  const r = spawnSync("npx", ["next", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, NEXT_PUBLIC_OFFLINE: "true" },
  });
  exitCode = r.status ?? 1;
} catch (err) {
  console.error("build failed:", err);
  exitCode = 1;
} finally {
  if (hadApi && fs.existsSync(bakDir)) {
    fs.renameSync(bakDir, apiDir);
  }
}

if (exitCode === 0) {
  console.log("✅ 离线静态构建完成 → out/");
} else {
  console.error("❌ 离线构建失败,api 目录已恢复");
}
process.exit(exitCode);
