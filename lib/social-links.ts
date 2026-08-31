export type SocialPlatform = "Instagram" | "Facebook" | "TikTok" | "YouTube" | "X" | "Site";

export type NormalizedSocialLink = {
  platform: SocialPlatform;
  url: string;
  label: string;
};

function stripWrappingQuotes(value: string) {
  return value.trim().replace(/^["']+|["']+$/g, "").trim();
}

function sanitizeTseUrlInput(raw: string) {
  let value = stripWrappingQuotes(raw);
  if (!value) return "";

  // Repair rows previously stored with a double protocol prefix.
  value = value.replace(/^https:\/\/https\/\//i, "https://");
  value = value.replace(/^http:\/\/https\/\//i, "https://");

  // TSE often publishes HTTPS//HOST (missing colon) or HTTPS://HOST.
  value = value.replace(/^https?\/\//i, "https://");

  // Strip any leading protocol and normalize to a single https:// prefix below.
  value = value.replace(/^(?:https?:\/\/)+/i, "");
  return value;
}

function toHttpsUrl(raw: string): URL | null {
  const hostAndPath = sanitizeTseUrlInput(raw);
  if (!hostAndPath || /\s/.test(hostAndPath.split("?")[0] ?? "")) return null;

  try {
    const url = new URL(`https://${hostAndPath}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
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

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

function socialLinkLabel(url: URL, platform: SocialPlatform) {
  const parts = url.pathname.split("/").filter(Boolean).map(decodePathSegment);

  if (platform === "Instagram" || platform === "TikTok" || platform === "X") {
    const reserved = new Set(["p", "reel", "reels", "watch", "status", "intent", "home"]);
    for (const part of parts) {
      const handle = part.replace(/^@/, "");
      if (handle && !reserved.has(handle.toLowerCase())) return `@${handle}`;
    }
  }

  if (platform === "Facebook") {
    if (parts[0] === "profile.php") {
      const id = url.searchParams.get("id");
      return id ? `profile/${id}` : "Facebook";
    }
    const handle = parts[parts.length - 1]?.replace(/^@/, "");
    if (handle && !["pages", "people", "groups"].includes(handle.toLowerCase())) return handle;
  }

  if (platform === "YouTube") {
    const atHandle = parts.find((part) => part.startsWith("@"));
    if (atHandle) return atHandle;
    const channelIndex = parts.findIndex((part) => ["channel", "c", "user"].includes(part));
    if (channelIndex >= 0 && parts[channelIndex + 1]) {
      return `@${parts[channelIndex + 1].replace(/^@/, "")}`;
    }
    if (url.hostname === "youtu.be" && parts[0]) return `@${parts[0]}`;
  }

  if (platform === "Site") return url.hostname.replace(/^www\./i, "");
  return platform;
}

export function normalizeSocialLink(raw: string | null | undefined): NormalizedSocialLink | null {
  if (!raw) return null;
  const url = toHttpsUrl(raw);
  if (!url || isTseHost(url.hostname)) return null;

  const platform = platformFromHost(url.hostname);
  const href = url.toString();
  return {
    platform,
    url: href,
    label: socialLinkLabel(url, platform),
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

const SOCIAL_SUMMARY_PRIORITY: SocialPlatform[] = [
  "Instagram",
  "X",
  "Facebook",
  "YouTube",
  "Site",
  "TikTok",
];

export function socialSummaryPlatformLabel(platform: SocialPlatform) {
  const labels: Record<SocialPlatform, string> = {
    Instagram: "instagram",
    Facebook: "facebook",
    TikTok: "tiktok",
    YouTube: "youtube",
    X: "x",
    Site: "site",
  };
  return labels[platform];
}

export function pickPrimarySocialLink(socials: NormalizedSocialLink[]) {
  if (socials.length === 0) return null;

  for (const platform of SOCIAL_SUMMARY_PRIORITY) {
    const match = socials.find((social) => social.platform === platform);
    if (match) return match;
  }

  return socials[0] ?? null;
}
