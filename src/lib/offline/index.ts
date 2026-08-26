/**
 * 离线模式安装器:覆盖 window.fetch,把 /api/* 请求路由到本地适配器。
 *
 * 非 /api/ 的请求(静态资源 /_next/*、/questions-images/*、/tts/* 等)
 * 保持原 fetch 行为(Capacitor WebView 内由内置服务器提供)。
 */
import { handleOfflineFetch } from "./api";

let installed = false;

export function installOfflineMode(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let urlStr: string;
    if (typeof input === "string") {
      urlStr = input;
    } else if (input instanceof URL) {
      urlStr = input.toString();
    } else if (typeof Request !== "undefined" && input instanceof Request) {
      urlStr = input.url;
    } else {
      urlStr = String(input);
    }

    let pathWithQuery: string;
    try {
      const u = urlStr.startsWith("http")
        ? new URL(urlStr)
        : new URL(urlStr, window.location.origin);
      pathWithQuery = u.pathname + u.search;
    } catch {
      pathWithQuery = urlStr;
    }

    if (pathWithQuery.startsWith("/api/")) {
      return handleOfflineFetch(pathWithQuery, init, origFetch);
    }
    return origFetch(input, init);
  };
}
