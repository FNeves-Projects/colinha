import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

export const TSE_FETCH_HEADERS = {
  Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
  Referer: "https://divulgacandcontas.tse.jus.br/divulga/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

export const TSE_PHOTO_ZIP_TIMEOUT_MS = 8_000;
export const TSE_PHOTO_FETCH_TIMEOUT_MS = 8_000;

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
