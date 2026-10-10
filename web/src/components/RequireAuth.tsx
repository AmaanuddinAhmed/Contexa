"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStatus } from "@/lib/auth";

/**
 * Page guard: sends logged-out visitors to /login and brings them back here
 * afterwards. Data is protected separately by the API (every route checks
 * the JWT); this only stops protected pages from rendering.
 */
export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const status = useAuthStatus();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") {
    return null;
  }

  return <>{children}</>;
}
