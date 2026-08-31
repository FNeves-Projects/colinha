import { Globe } from "lucide-react";
import { useId, type ReactNode } from "react";
import type { SocialPlatform } from "@/lib/social-links";

function IconFrame({ size = 20, children }: { size?: number; children: ReactNode }) {
  return (
    <span className="social-link-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size} height={size}>
        {children}
      </svg>
    </span>
  );
}

export function SocialNetworkIcon({ platform, size = 20 }: { platform: SocialPlatform; size?: number }) {
  const instagramGradientId = useId();

  if (platform === "Instagram") {
    return (
      <IconFrame size={size}>
        <defs>
          <radialGradient id={instagramGradientId} cx="30%" cy="107%" r="150%">
            <stop offset="0%" stopColor="#fdf497" />
            <stop offset="5%" stopColor="#fdf497" />
            <stop offset="45%" stopColor="#fd5949" />
            <stop offset="60%" stopColor="#d6249f" />
            <stop offset="90%" stopColor="#285AEB" />
          </radialGradient>
        </defs>
        <rect width="24" height="24" rx="6" fill={`url(#${instagramGradientId})`} />
        <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="16.8" cy="7.2" r="1" fill="#fff" />
      </IconFrame>
    );
  }

  if (platform === "Facebook") {
    return (
      <IconFrame size={size}>
        <rect width="24" height="24" rx="6" fill="#1877F2" />
        <path
          d="M15.5 8.2h-2.1c-1.2 0-1.4.6-1.4 1.4v1.9h2.8l-.4 2.9h-2.4v7.4h-3V14.4H8v-2.9h2.4V9.1c0-2.4 1.4-3.7 3.6-3.7 1 0 1.9.1 2.5.2v2.6Z"
          fill="#fff"
        />
      </IconFrame>
    );
  }

  if (platform === "YouTube") {
    return (
      <IconFrame size={size}>
        <rect width="24" height="24" rx="6" fill="#FF0000" />
        <path d="M17.8 9.4a1.5 1.5 0 0 0-1.1-1.1C15.4 8 12 8 12 8s-3.4 0-4.7.3a1.5 1.5 0 0 0-1.1 1.1C6 10.7 6 12 6 12s0 1.3.2 2.6a1.5 1.5 0 0 0 1.1 1.1C8.6 16 12 16 12 16s3.4 0 4.7-.3a1.5 1.5 0 0 0 1.1-1.1C18 13.3 18 12 18 12s0-1.3-.2-2.6Z" fill="#fff" />
        <path d="M10.5 14.6V9.4L15 12l-4.5 2.6Z" fill="#FF0000" />
      </IconFrame>
    );
  }

  if (platform === "TikTok") {
    return (
      <IconFrame size={size}>
        <rect width="24" height="24" rx="6" fill="#010101" />
        <path
          d="M15.8 8.3c-.9 0-1.7-.3-2.4-.8v5.9a3.4 3.4 0 1 1-2.4-3.2v2a1.4 1.4 0 1 0 1 1.3V8.1h2.1c.2 1 .9 1.8 1.7 2.2v-2Z"
          fill="#25F4EE"
        />
        <path
          d="M16.5 7.5c-.8-.5-1.4-1.3-1.6-2.2h-1.8v8.4a1.4 1.4 0 1 1-1-1.3v-2a3.4 3.4 0 1 0 3.4 3.4V9.7c.8-.2 1.6-.5 2.3-1v-1.2c-.8.3-1.6.5-2.3.5Z"
          fill="#FE2C55"
        />
        <path
          d="M14.9 5.3h1.8v8.4a1.4 1.4 0 1 1-1-1.3V5.3Zm1.6 4.4c.7-.5 1.5-.8 2.3-1V7.5c-.7.3-1.5.5-2.3.5V9.7Z"
          fill="#fff"
        />
      </IconFrame>
    );
  }

  if (platform === "X") {
    return (
      <IconFrame size={size}>
        <rect width="24" height="24" rx="6" fill="#000" />
        <path
          d="M13.7 10.6 18.9 5h-1.2l-4.5 4.9L9.8 5H5.5l5.5 7.3L5.5 19h1.2l4.8-5.2 3.8 5.2h4.3l-5.6-7.4Zm-1.9 2.1-.56-.8-4.4-6.2h1.9l3.5 4.9.56.8 4.6 6.4h-1.9l-3.7-5.1Z"
          fill="#fff"
        />
      </IconFrame>
    );
  }

  return (
    <span className="social-link-icon social-link-icon--site" aria-hidden="true">
      <Globe size={size} strokeWidth={2.1} />
    </span>
  );
}
