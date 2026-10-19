"use client";

import { useSyncExternalStore } from "react";

/*
 * The login token itself is in an httpOnly cookie that page scripts cannot
 * read (see server/session.ts). The browser only keeps a "logged in" flag
 * here, so the UI knows which menu to show and pages know to call the API.
 * The flag holds no secret: if it is stale, the API answers 401 and
 * lib/api.ts clears it.
 *
 * The names getToken/setToken/clearToken are kept so existing pages need no
 * changes; getToken returns the flag, not a token.
 */
const SESSION_FLAG_KEY = "contexa_logged_in";
/** Where the token itself was stored before it moved to a cookie. */
const LEGACY_TOKEN_KEY = "contexa_token";
const AUTH_EVENT = "contexa-auth-change";

/** "1" while logged in, otherwise null. Not a credential. */
export const getToken = (): string | null => {
    try {
        return localStorage.getItem(SESSION_FLAG_KEY);
    } catch {
        return null;
    }
};

/** Call after a successful login or registration (the server set the cookie). */
export const setToken = (): void => {
    try {
        localStorage.setItem(SESSION_FLAG_KEY, "1");
        localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
        // Storage blocked: the cookie still works; the UI just shows logged out.
    }
    window.dispatchEvent(new Event(AUTH_EVENT));
};

/** Logs out here and on the server (which deletes the httpOnly cookie). */
export const clearToken = (): void => {
    try {
        localStorage.removeItem(SESSION_FLAG_KEY);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
        // Nothing stored to clear.
    }
    window.dispatchEvent(new Event(AUTH_EVENT));

    // keepalive lets the request finish even if the page navigates away.
    fetch("/api/v1/auth/logout", { method: "POST", keepalive: true }).catch(() => {});
};

const subscribe = (onChange: () => void): (() => void) => {
    // AUTH_EVENT covers this tab; "storage" covers logins/logouts in other tabs.
    window.addEventListener(AUTH_EVENT, onChange);
    window.addEventListener("storage", onChange);

    return () => {
        window.removeEventListener(AUTH_EVENT, onChange);
        window.removeEventListener("storage", onChange);
    };
};

/** Returns true when a token is stored. Re-renders on login/logout. */
export const useIsLoggedIn = (): boolean =>
    useSyncExternalStore(
        subscribe,
        () => getToken() !== null,
        () => false, // server render: assume logged out
    ); 


export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * Like useIsLoggedIn, but "loading" until the browser has been checked, so
 * guards never redirect during the first (server-rendered) paint.
 */
export const useAuthStatus = (): AuthStatus =>
  useSyncExternalStore(
    subscribe,
    () => (getToken() !== null ? "authenticated" : "unauthenticated"),
    () => "loading",
  );

/** Only same-site paths, e.g. "/context" (blocks "//evil.com" redirects). */
export const safeNextPath = (value: string | null): string | null =>
  value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : null;