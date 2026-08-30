import type { ReactNode } from "react";
import type { SocialPlatform } from "@/lib/social-links";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function SocialNetworkIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === "Instagram") {
    return (
      <Icon>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" />
      </Icon>
    );
  }
  if (platform === "Facebook") {
    return (
      <Icon>
        <path d="M14 8h2.5V4.8H14c-2.3 0-3.8 1.5-3.8 4V11H8v3.2h2.2V20H14v-5.8h2.4L17 11h-3V9.2c0-.7.3-1.2 1-1.2Z" fill="currentColor" stroke="none" />
      </Icon>
    );
  }
  if (platform === "YouTube") {
    return (
      <Icon>
        <rect x="2.8" y="6" width="18.4" height="12" rx="3" />
        <path d="M10.5 9.4v5.2L15.4 12z" fill="currentColor" stroke="none" />
      </Icon>
    );
  }
  if (platform === "X") {
    return (
      <Icon>
        <path d="M5 5l14 14M19 5L5 19" />
      </Icon>
    );
  }
  if (platform === "TikTok") {
    return (
      <Icon>
        <path d="M14 6.5c.8 1.8 2.4 3 4.4 3.2V13c-1.5 0-2.9-.5-4.4-1.4v4.7c0 2.7-2.2 4.9-4.9 4.9S4.2 19 4.2 16.3 6.4 11.4 9.1 11.4c.3 0 .6 0 .9.1v3.3c-.3-.1-.6-.2-.9-.2-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2V6.5h3Z" />
      </Icon>
    );
  }
  return (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.6 3.6 5.5 3.6 8.5s-1.2 5.9-3.6 8.5c-2.4-2.6-3.6-5.5-3.6-8.5s1.2-5.9 3.6-8.5Z" />
    </Icon>
  );
}
