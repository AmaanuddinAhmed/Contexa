"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/auth";
import { safeNextPath } from "@/lib/paths";

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
