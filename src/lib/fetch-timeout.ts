/**
 * Next.js patches global `fetch` in client components, serving stale RSC-cached
 * responses for API routes. Use XMLHttpRequest to bypass that cache entirely.
 */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.toString();
  const method = init.method ?? "GET";
  const headers = init.headers as Record<string, string> | undefined;
  const body = init.body as string | undefined;

  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    if (headers) {
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    }
    const timer = setTimeout(() => {
      xhr.abort();
      reject(new DOMException("Request timed out", "TimeoutError"));
    }, timeoutMs);
    xhr.onload = () => {
      clearTimeout(timer);
      const responseHeaders = new Headers();
      xhr.getAllResponseHeaders().trim().split(/\r?\n/).forEach((line) => {
        const idx = line.indexOf(":");
        if (idx > 0) responseHeaders.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
      });
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: responseHeaders,
        })
      );
    };
    xhr.onerror = () => {
      clearTimeout(timer);
      reject(new TypeError("Network error"));
    };
    xhr.onabort = () => {
      clearTimeout(timer);
      reject(new DOMException("Request aborted", "AbortError"));
    };
    xhr.send(body ?? null);
  });
}
