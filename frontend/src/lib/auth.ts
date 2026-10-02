"use client";

import { useSyncExternalStore } from "react";

const TOKEN_KEY = "contexa_token";
const AUTH_EVENT = "contexa-auth-change";

export const getToken = (): string | null => {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
};

export const setToken = (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
    window.dispatchEvent(new Event(AUTH_EVENT));
};

export const clearToken = (): void => {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event(AUTH_EVENT));
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