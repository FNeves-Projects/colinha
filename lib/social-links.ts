export type SocialPlatform = "Instagram" | "Facebook" | "TikTok" | "YouTube" | "X" | "Site";

export type NormalizedSocialLink = {
  platform: SocialPlatform;
  url: string;
  label: string;
};

function stripWrappingQuotes(value: string) {
  return value.trim().replace(/^["']+|["']+$/g, "").trim();
}

function toHttpsUrl(raw: string): URL | null {
  const value = stripWrappingQuotes(raw);
  if (!value) return null;

  const withoutProtocols = value.replace(/^(https?:\/\/)+/i, "");
  if (!withoutProtocols || /\s/.test(withoutProtocols.split("?")[0] ?? "")) return null;

  try {
    const url = new URL(`https://${withoutProtocols}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.protocol = "https:";
    if (!url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

function platformFromHost(host: string): SocialPlatform {
  const hostname = host.toLowerCase().replace(/^www\./, "");
  if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) return "Instagram";
  if (
    hostname === "facebook.com"
    || hostname.endsWith(".facebook.com")
    || hostname === "fb.com"
    || hostname.endsWith(".fb.com")
    || hostname === "fb.watch"
  ) return "Facebook";
  if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) return "TikTok";
  if (
    hostname === "youtube.com"
    || hostname.endsWith(".youtube.com")
    || hostname === "youtu.be"
  ) return "YouTube";
  if (hostname === "x.com" || hostname.endsWith(".x.com") || hostname === "twitter.com" || hostname.endsWith(".twitter.com")) {
    return "X";
  }
  return "Site";
}

function isTseHost(host: string) {
  const hostname = host.toLowerCase();
  return hostname === "tse.jus.br" || hostname.endsWith(".tse.jus.br");
}

export function normalizeSocialLink(raw: string | null | undefined): NormalizedSocialLink | null {
  if (!raw) return null;
  const url = toHttpsUrl(raw);
  if (!url || isTseHost(url.hostname)) return null;

  const platform = platformFromHost(url.hostname);
  const href = url.toString();
  const hostLabel = url.hostname.replace(/^www\./i, "");
  return {
    platform,
    url: href,
    label: platform === "Site" ? hostLabel : platform,
  };
}

export function normalizeSocialLinks(links: Array<{ url?: string | null; platform?: string | null }>): NormalizedSocialLink[] {
  const seen = new Set<string>();
  const normalized: NormalizedSocialLink[] = [];

  for (const link of links) {
    const item = normalizeSocialLink(link.url);
    if (!item || seen.has(item.url)) continue;
    seen.add(item.url);
    normalized.push(item);
  }

  return normalized;
}
