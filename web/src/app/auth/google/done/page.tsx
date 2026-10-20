"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/auth";
import { safeNextPath } from "@/lib/paths";

/**
 * Where Google sign-in lands after the server set the session cookie: marks
 * the browser as logged in (the flag the menus read), then moves on.
 */
export default function GoogleDonePage() {
  const router = useRouter();

  useEffect(() => {
    setToken();
    const next = safeNextPath(
      new URLSearchParams(window.location.search).get("next"),
    );
    router.replace(next ?? "/recommendations");
  }, [router]);

  return (
    <main className="page">
      <p className="text-muted" aria-live="polite">
        Signing you in…
      </p>
    </main>
  );
}
