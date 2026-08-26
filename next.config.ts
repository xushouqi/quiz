import type { NextConfig } from "next";

// 安卓离线构建(NEXT_PUBLIC_OFFLINE=true)时启用静态导出。
// 注意:静态导出不支持 route handlers,scripts/build-offline.mjs 会在构建前
// 临时移走 src/app/api,构建后恢复,因此在线 dev/build 不受影响。
const isOffline = process.env.NEXT_PUBLIC_OFFLINE === "true";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  ...(isOffline
    ? {
        output: "export" as const,
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
