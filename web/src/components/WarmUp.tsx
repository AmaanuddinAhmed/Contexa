"use client";

import { useEffect } from "react";
import { shouldWarm, WARM_STORAGE_KEY } from "@/lib/warm";

/**
 * Pings /api/v1/warm in the background when Contexa is opened (at most once
 * per 5 minutes per browser), so the recommendation service is usually
 * awake by the time someone asks for matches. Renders nothing.
 */
export default function WarmUp() {
  useEffect(() => {
    const now = Date.now();
    let lastAt: number | null = null;

    try {
      const stored = localStorage.getItem(WARM_STORAGE_KEY);
      lastAt = stored === null ? null : Number(stored);
    } catch {
      // Storage blocked: ping anyway.
    }

    if (!shouldWarm(lastAt, now)) {
      return;
    }

    try {
      localStorage.setItem(WARM_STORAGE_KEY, String(now));
    } catch {
      // Storage blocked: nothing to remember.
    }

    fetch("/api/v1/warm", { method: "POST", keepalive: true }).catch(() => {
      // Best effort only.
    });
  }, []);

  return null;
}
