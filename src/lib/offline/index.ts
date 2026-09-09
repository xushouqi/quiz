/**
 * 离线模式安装器:覆盖 window.fetch 与 XMLHttpRequest,把 /api/* 请求路由到本地适配器。
 *
 * - fetch 拦截:覆盖 window.fetch,所有 /api/* 请求走本地适配器。
 * - XHR 拦截:fetchWithTimeout 为绕过 Next.js RSC 缓存使用 XHR,
 *   若只拦截 fetch 会导致离线模式下所有走 fetchWithTimeout 的页面
 *  (practice / exam / shangshi / olympiad / mistakes / parents)
 *   直接打到不存在的服务器,出现 "Couldn't reach the server" 错误。
 * - 非 /api/ 的请求(静态资源 /_next/*、/questions-images/*、/tts/* 等)
 *   保持原 fetch/XHR 行为(Capacitor WebView 内由内置服务器提供)。
 */
import { handleOfflineFetch } from "./api";

let installed = false;

export function installOfflineMode(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const pathWithQuery = extractPath(input);
    if (pathWithQuery.startsWith("/api/")) {
      return handleOfflineFetch(pathWithQuery, init, origFetch);
    }
    return origFetch(input, init);
  };

  installXhrOverride(origFetch);
}

// ---------------------------------------------------------------------------
// URL 提取(fetch 拦截复用)
// ---------------------------------------------------------------------------

function extractPath(input: RequestInfo | URL): string {
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
  try {
    const u = urlStr.startsWith("http")
      ? new URL(urlStr)
      : new URL(urlStr, window.location.origin);
    return u.pathname + u.search;
  } catch {
    return urlStr;
  }
}

// ---------------------------------------------------------------------------
// XMLHttpRequest 拦截
// ---------------------------------------------------------------------------

type XhrWithMeta = XMLHttpRequest & {
  __ofu_method?: string;
  __ofu_url?: string;
  __ofu_headers?: Record<string, string>;
  __ofu_aborted?: boolean;
  __ofu_inflight?: AbortController;
};

/**
 * 拦截 XMLHttpRequest:仅对 /api/* 路径把请求转接到已 patch 的 fetch,
 * 其他路径仍走原生 XHR。
 */
function installXhrOverride(origFetch: typeof window.fetch): void {
  if (typeof XMLHttpRequest === "undefined") return;

  const OrigProto = XMLHttpRequest.prototype as XMLHttpRequest & {
    __open?: typeof XMLHttpRequest.prototype.open;
    __send?: typeof XMLHttpRequest.prototype.send;
    __abort?: typeof XMLHttpRequest.prototype.abort;
  };

  if (OrigProto.__open) return; // 已经拦截过

  OrigProto.__open = OrigProto.open;
  OrigProto.__send = OrigProto.send;
  OrigProto.__abort = OrigProto.abort;

  // open:记录 method/url,只给 /api/* 路径打标记
  OrigProto.open = function (
    this: XhrWithMeta,
    method: string,
    url: string,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    const pathWithQuery = extractPath(url);
    if (pathWithQuery.startsWith("/api/")) {
      this.__ofu_method = method;
      this.__ofu_url = pathWithQuery;
      this.__ofu_headers = {};
      this.__ofu_aborted = false;
      return; // 不调用原生 open —— 不发起真实网络请求
    }
    if (async === undefined) return OrigProto.__open!.call(this, method, url, true);
    return OrigProto.__open!.call(this, method, url, async, username ?? null, password ?? null);
  };

  // setRequestHeader:/api/* 路径时只收集到 map,实际在 send 时随 fetch 发出
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (this: XhrWithMeta, name: string, value: string) {
    if (this.__ofu_url) {
      if (this.__ofu_headers) this.__ofu_headers[name] = value;
      return;
    }
    return origSetHeader.call(this, name, value);
  };

  // send:对 /api/* 路径用 fetch 完成,然后回填 XHR 属性、触发 onload
  OrigProto.send = function (this: XhrWithMeta, body?: Document | XMLHttpRequestBodyInit | null) {
    if (!this.__ofu_url) {
      return OrigProto.__send!.call(this, body);
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias -- 需要把 xhr 实例传给异步辅助函数
    const xhr = this;
    const method = xhr.__ofu_method ?? "GET";
    const pathWithQuery = xhr.__ofu_url!;
    const headers = xhr.__ofu_headers ?? {};
    const controller = new AbortController();
    xhr.__ofu_inflight = controller;

    void runXhrFetch(xhr, pathWithQuery, {
      method,
      headers,
      body: body as BodyInit | null,
      signal: controller.signal,
    });
  };

  // abort:若 fetch 正在进行,通过 AbortController 取消
  OrigProto.abort = function (this: XhrWithMeta) {
    if (this.__ofu_url) {
      this.__ofu_aborted = true;
      this.__ofu_inflight?.abort();
      this.__ofu_inflight = undefined;
      const onabort = this.onabort as ((this: XMLHttpRequest, ev: Event) => unknown) | null;
      if (typeof onabort === "function") {
        onabort.call(this, new Event("abort"));
      }
      return;
    }
    return OrigProto.__abort!.call(this);
  };

  // getAllResponseHeaders:/api/* 路径走 fetch 完成,原生 XHR 从未真正 open,
  // 调用原生 getAllResponseHeaders 可能抛错;直接返回空字符串即可
  // (fetchWithTimeout 只关心 status / statusText / responseText,不解析响应头)。
  const origGetAllHeaders = XMLHttpRequest.prototype.getAllResponseHeaders;
  XMLHttpRequest.prototype.getAllResponseHeaders = function (this: XhrWithMeta) {
    if (this.__ofu_url) return "";
    return origGetAllHeaders.call(this);
  };

  // getResponseHeader:同理,对 /api/* 路径返回 null
  const origGetHeader = XMLHttpRequest.prototype.getResponseHeader;
  XMLHttpRequest.prototype.getResponseHeader = function (this: XhrWithMeta, name: string) {
    if (this.__ofu_url) return null;
    return origGetHeader.call(this, name);
  };

  // 异步执行 fetch 并把结果回填到 XHR 实例(独立函数,避免在 send 内 alias `this`)
  async function runXhrFetch(
    xhr: XhrWithMeta,
    pathWithQuery: string,
    init: RequestInit,
  ): Promise<void> {
    try {
      if (xhr.__ofu_aborted) return;
      const resp = await handleOfflineFetch(pathWithQuery, init, origFetch);
      const text = await resp.text();

      // 回填 XHR 只读属性
      defineXhrProp(xhr, "readyState", 4);
      defineXhrProp(xhr, "status", resp.status);
      defineXhrProp(xhr, "statusText", resp.statusText);
      defineXhrProp(xhr, "responseText", text);
      defineXhrProp(xhr, "response", text);
      defineXhrProp(xhr, "responseURL", resp.url || pathWithQuery);

      // 触发事件(this 指向 xhr 实例,与原生行为一致)
      const onload = xhr.onload as ((this: XMLHttpRequest, ev: ProgressEvent) => unknown) | null;
      if (typeof onload === "function") {
        onload.call(xhr, new ProgressEvent("load") as ProgressEvent);
      }
      const onReady = xhr.onreadystatechange as
        | ((this: XMLHttpRequest, ev: Event) => unknown)
        | null;
      if (typeof onReady === "function") {
        onReady.call(xhr, new Event("readystatechange"));
      }
    } catch (err) {
      if (xhr.__ofu_aborted) return;
      defineXhrProp(xhr, "readyState", 4);
      defineXhrProp(xhr, "status", 0);
      defineXhrProp(xhr, "statusText", (err as Error)?.message ?? "Network error");

      const onerror = xhr.onerror as ((this: XMLHttpRequest, ev: ProgressEvent) => unknown) | null;
      if (typeof onerror === "function") {
        onerror.call(xhr, new ProgressEvent("error") as ProgressEvent);
      }
    } finally {
      xhr.__ofu_inflight = undefined;
    }
  }
}

function defineXhrProp(xhr: object, key: string, value: unknown): void {
  Object.defineProperty(xhr, key, { value, writable: true, configurable: true });
}
