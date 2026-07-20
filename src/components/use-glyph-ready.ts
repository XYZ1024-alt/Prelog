"use client";

import { useEffect, useRef, useState } from "react";

export function useGlyphReady(sceneSelector: string, sourceKey: string) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      throw new Error("Interactive Glyph host is unavailable.");
    }

    const markReady = () => {
      const scene = host.querySelector(sceneSelector);
      const hasOutput = Boolean(scene?.textContent?.trim());
      if (hasOutput) setReady(true);
      return hasOutput;
    };

    if (markReady()) return;

    const observer = new MutationObserver(() => {
      if (markReady()) observer.disconnect();
    });
    observer.observe(host, { characterData: true, childList: true, subtree: true });
    return () => observer.disconnect();
  }, [sceneSelector, sourceKey]);

  return { hostRef, ready } as const;
}
