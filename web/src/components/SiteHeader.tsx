"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearToken, getToken, useIsLoggedIn } from "@/lib/auth";
import { MESSAGES_READ_EVENT } from "@/lib/messages";
import {
  clearNotifications,
  NOTIFICATIONS_POLL_MS,
  NOTIFICATIONS_REFRESH_EVENT,
  NotificationsResponse,
  publishNotifications,
} from "@/lib/notifications";
import { usePolling } from "@/lib/usePolling";
import Logo from "@/components/Logo";
import InstallApp from "@/components/InstallApp";

const NAV_LINKS = [
  { href: "/recommendations", label: "Matches" },
  { href: "/context", label: "Context" },
  { href: "/profile", label: "Profile" },
  { href: "/connections", label: "Connections" },
  { href: "/messages", label: "Messages" },
  { href: "/map", label: "Map" },
  { href: "/feedback", label: "Rate matches" },
];

function CountBadge({
  count,
  label,
  className = "",
}: {
  count: number;
  label: string;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <span
      className={`inline-flex min-w-5 items-center justify-center rounded-full bg-signal px-1.5 text-[0.7rem] leading-5 font-bold text-ink tabular-nums ${className}`}
      aria-label={`${count} ${label}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isLoggedIn = useIsLoggedIn();
  const [counts, setCounts] = useState({ messages: 0, requests: 0 });
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

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
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const links =
    isLoggedIn && isAdmin
      ? [...NAV_LINKS, { href: "/admin", label: "Evaluation" }]
      : NAV_LINKS;

  const refreshNotifications = useCallback(async () => {
    const token = getToken();

    if (!token) {
      return;
    }

    try {
      const response = await api<NotificationsResponse>("/notifications", {
        token,
      });
      setCounts({
        messages: response.data.messages,
        requests: response.data.requests,
      });
      publishNotifications(response.data);
    } catch {
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const refresh = () => void refreshNotifications();

    refresh();
    window.addEventListener(MESSAGES_READ_EVENT, refresh);
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, refresh);

    return () => {
      window.removeEventListener(MESSAGES_READ_EVENT, refresh);
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, refresh);
    };
  }, [isLoggedIn, refreshNotifications]);

  usePolling(refreshNotifications, NOTIFICATIONS_POLL_MS, isLoggedIn);

  const badgeFor = (href: string) =>
    href === "/messages"
      ? { count: counts.messages, label: "unread" }
      : href === "/connections"
        ? { count: counts.requests, label: "new requests" }
        : null;
  const totalNew = counts.messages + counts.requests;

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => query.matches && setMenuOpen(false);
    query.addEventListener("change", onChange);

    return () => query.removeEventListener("change", onChange);
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    setCounts({ messages: 0, requests: 0 });
    clearNotifications();
    clearToken();
    router.push("/login");
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full bg-surface/85 pr-2 pl-4 shadow-[var(--shadow-lift)] ring-1 ring-line/80 backdrop-blur-xl">
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="flex shrink-0 items-center gap-2 rounded-full"
            aria-label="Contexa home"
          >
            <Logo className="h-7 w-7" />
            <span className="font-display text-lg font-semibold tracking-tight">
              Contexa
            </span>
          </Link>

          {isLoggedIn && (
            <nav
              aria-label="Main"
              className="hidden items-center gap-0.5 lg:flex"
            >
              {links.map((link) => {
                const active = isActive(link.href);
                const badge = badgeFor(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200 ${
                      active
                        ? "bg-ink text-white"
                        : "text-muted hover:bg-sunk hover:text-ink"
                    }`}
                  >
                    {link.label}
                    {badge && <CountBadge {...badge} />}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-1.5">
            {isLoggedIn ? (
              <>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn btn-quiet hidden lg:inline-flex"
                >
                  Log out
                </button>

                <button
                  ref={toggleRef}
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                  aria-controls="mobile-menu"
                  aria-label={
                    menuOpen
                      ? "Close menu"
                      : totalNew > 0
                        ? `Open menu, ${totalNew} new`
                        : "Open menu"
                  }
                  className="relative flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white transition-transform duration-300 ease-[var(--ease-spring)] active:scale-95 lg:hidden"
                >
                  <span
                    className="relative block h-3.5 w-[18px]"
                    aria-hidden="true"
                  >
                    <span
                      className={`absolute left-0 h-[2px] w-full rounded-full bg-current transition-all duration-500 ease-[var(--ease-spring)] ${
                        menuOpen
                          ? "top-1/2 -translate-y-1/2 rotate-45"
                          : "top-0"
                      }`}
                    />
                    <span
                      className={`absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2 rounded-full bg-current transition-all duration-300 ${
                        menuOpen ? "scale-x-0 opacity-0" : ""
                      }`}
                    />
                    <span
                      className={`absolute left-0 h-[2px] rounded-full bg-current transition-all duration-500 ease-[var(--ease-spring)] ${
                        menuOpen
                          ? "top-1/2 w-full -translate-y-1/2 -rotate-45"
                          : "bottom-0 w-2/3"
                      }`}
                    />
                  </span>
                  {!menuOpen && totalNew > 0 && (
                    <span
                      className="absolute -top-1 -right-1 inline-flex min-w-5 animate-fade items-center justify-center rounded-full bg-signal px-1 text-[0.65rem] leading-5 font-bold text-ink tabular-nums ring-2 ring-surface"
                      aria-hidden="true"
                    >
                      {totalNew > 99 ? "99+" : totalNew}
                    </span>
                  )}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
                >
                  Log in
                </Link>
                <Link href="/register" className="btn btn-primary">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {isLoggedIn && menuOpen && (
        <div
          id="mobile-menu"
          ref={menuRef}
          className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-fog/95 px-6 pt-24 pb-10 backdrop-blur-2xl animate-fade lg:hidden"
        >
          <nav aria-label="Main" className="flex flex-col">
            {links.map((link, index) => {
              const active = isActive(link.href);
              const badge = badgeFor(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  style={{ animationDelay: `${60 + index * 45}ms` }}
                  className={`group flex animate-rise items-center justify-between border-b border-line py-3.5 font-display text-[1.75rem] leading-tight font-semibold tracking-tight transition-colors ${
                    active ? "text-brand" : "text-ink hover:text-brand"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {link.label}
                    {badge && <CountBadge {...badge} className="font-sans" />}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                      active
                        ? "bg-brand"
                        : "bg-line-strong group-hover:bg-brand"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          <div
            style={{ animationDelay: `${80 + links.length * 45}ms` }}
            className="mt-8 flex animate-rise flex-wrap items-start gap-2.5"
          >
            <InstallApp />
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-quiet"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
