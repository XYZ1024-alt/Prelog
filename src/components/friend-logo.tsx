"use client";

import { useState } from "react";

type FriendLogoProps = {
  readonly logoUrl: string | null;
  readonly name: string;
};

export function FriendLogo({ logoUrl, name }: FriendLogoProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl === logoUrl;
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "?";

  if (!logoUrl || failed) {
    return <span aria-hidden="true" className="friend-logo friend-logo--fallback">{initial}</span>;
  }

  return (
    <span className="friend-logo">
      {/* eslint-disable-next-line @next/next/no-img-element -- Friend domains cannot use a static remote allowlist. */}
      <img
        alt=""
        decoding="async"
        loading="lazy"
        onError={() => setFailedUrl(logoUrl)}
        referrerPolicy="no-referrer"
        src={logoUrl}
      />
    </span>
  );
}
