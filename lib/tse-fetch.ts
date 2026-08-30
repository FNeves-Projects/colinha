import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

export const TSE_FETCH_HEADERS = {
  Accept: "application/zip,application/octet-stream,image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
  Referer: "https://dadosabertos.tse.jus.br/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

export const TSE_PHOTO_ZIP_TIMEOUT_MS = 180_000;
export const TSE_PHOTO_FETCH_TIMEOUT_MS = 15_000;

export async function fetchTse(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: TSE_FETCH_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}
