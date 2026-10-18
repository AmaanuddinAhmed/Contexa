"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearToken, getToken, useIsLoggedIn } from "@/lib/auth";
import {
  MESSAGES_READ_EVENT,
  UNREAD_POLL_MS,
  UnreadResponse,
} from "@/lib/messages";
import { usePolling } from "@/lib/usePolling";

const NAV_LINKS = [
  { href: "/profile", label: "Profile" },
  { href: "/context", label: "Context" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/connections", label: "Connections" },
  { href: "/messages", label: "Messages" },
  { href: "/feedback", label: "Rate matches" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isLoggedIn = useIsLoggedIn();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  // The Evaluation link is only a convenience: /api/v1/admin/* checks the role itself.
  useEffect(() => {
    const token = getToken();

    if (!isLoggedIn || !token) {
      return;
    }

    let cancelled = false;

    api<{ data: { user: { role: string } } }>("/auth/me", { token })
      .then((response) => {
        if (!cancelled) {
          setIsAdmin(response.data.user.role === "admin");
        }
      })
      .catch(() => {
        // Leave the link hidden.
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const links =
    isLoggedIn && isAdmin
      ? [...NAV_LINKS, { href: "/admin", label: "Evaluation" }]
      : NAV_LINKS;

  const refreshUnread = useCallback(async () => {
    const token = getToken();

    if (!token) {
      return;
    }

    try {
      const response = await api<UnreadResponse>("/messages", { token });
      setUnreadTotal(response.data.total);
    } catch {
      // The badge is a convenience; the next refresh retries.
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const onRead = () => void refreshUnread();

    onRead();
    window.addEventListener(MESSAGES_READ_EVENT, onRead);

    return () => window.removeEventListener(MESSAGES_READ_EVENT, onRead);
  }, [isLoggedIn, refreshUnread]);

  usePolling(refreshUnread, UNREAD_POLL_MS, isLoggedIn);

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="text-xl font-bold tracking-tight">
          CONTEXA
        </Link>

        <nav className="flex flex-wrap items-center gap-5 text-sm font-medium">
          {isLoggedIn &&
            links.map((link) => {
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive ? "text-black" : "text-zinc-500 hover:text-black"
                  }
                >
                  {link.label}
                  {link.href === "/messages" && unreadTotal > 0 && (
                    <span
                      className="ml-1.5 rounded-full bg-black px-1.5 py-0.5 text-xs font-semibold text-white"
                      aria-label={`${unreadTotal} unread`}
                    >
                      {unreadTotal > 99 ? "99+" : unreadTotal}
                    </span>
                  )}
                </Link>
              );
            })}

          {isLoggedIn ? (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-zinc-900 hover:bg-zinc-50"
            >
              Log out
            </button>
          ) : (
            <>
              <Link href="/login" className="text-zinc-500 hover:text-black">
                Log in
              </Link>

              <Link
                href="/register"
                className="rounded-lg bg-black px-4 py-2 text-white hover:bg-zinc-800"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
