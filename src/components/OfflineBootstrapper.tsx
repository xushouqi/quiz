"use client";

import { useEffect } from "react";
import { installOfflineMode } from "@/lib/offline";

/**
 * 客户端离线模式引导:
 * 挂载时安装 fetch 拦截,让所有 /api/* 请求走本地离线适配器。
 * 放在 UserProvider 内部(子组件 effect 先于父组件执行),确保首个 /api/users 请求已被拦截。
 */
export function OfflineBootstrapper() {
  useEffect(() => {
    installOfflineMode();
  }, []);
  return null;
}
