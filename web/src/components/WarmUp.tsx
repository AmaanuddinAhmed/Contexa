"use client";

import { useEffect } from "react";
import { shouldWarm, WARM_STORAGE_KEY } from "@/lib/warm";

export default function WarmUp() {
  useEffect(() => {
    const now = Date.now();
    let lastAt: number | null = null;

    try {
      const stored = localStorage.getItem(WARM_STORAGE_KEY);
      lastAt = stored === null ? null : Number(stored);
    } catch {
    }

    if (!shouldWarm(lastAt, now)) {
      return;
    }

    try {
      localStorage.setItem(WARM_STORAGE_KEY, String(now));
    } catch {
    }

    fetch("/api/v1/warm", { method: "POST", keepalive: true }).catch(() => {
    });
  }, []);

  return null;
}
