import { isWebUrl } from "./images";

export type UrlCheck = { loaded: Set<string>; failed: Set<string> };

/** Loads each URL in a hidden image to learn whether it will actually display. Reports progress as it goes. */
export async function checkImageUrls(urls: string[], onProgress?: (done: number, total: number) => void, timeoutMs = 15000, concurrency = 6): Promise<UrlCheck> {
  const unique = [...new Set(urls.filter(isWebUrl))];
  const result: UrlCheck = { loaded: new Set(), failed: new Set() };
  let next = 0, done = 0;
  const probe = (url: string) => new Promise<boolean>((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => { image.src = ""; resolve(false); }, timeoutMs);
    image.onload = () => { window.clearTimeout(timer); resolve(true); };
    image.onerror = () => { window.clearTimeout(timer); resolve(false); };
    image.src = url;
  });
  const worker = async () => {
    while (next < unique.length) {
      const url = unique[next++];
      (await probe(url) ? result.loaded : result.failed).add(url);
      onProgress?.(++done, unique.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return result;
}

const EXT_FOR: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif", "image/bmp": "bmp" };

/** A readable library path for a downloaded picture: web/<host>/<file>. */
export function pathForUrl(url: string, contentType: string): string {
  let host = "web", file = "image";
  try { const u = new URL(url, location.href); host = u.hostname || "web"; file = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "image"); } catch { /* keep defaults */ }
  if (!/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(file)) file += "." + (EXT_FOR[contentType.split(";")[0]] ?? "jpg");
  return `web/${host}/${file}`;
}
