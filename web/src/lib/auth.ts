"use client";

import { useSyncExternalStore } from "react";

const SESSION_FLAG_KEY = "contexa_logged_in";
const LEGACY_TOKEN_KEY = "contexa_token";
const AUTH_EVENT = "contexa-auth-change";

export const getToken = (): string | null => {
    try {
        return localStorage.getItem(SESSION_FLAG_KEY);
    } catch {
        return null;
    }
};

export const setToken = (): void => {
    try {
        localStorage.setItem(SESSION_FLAG_KEY, "1");
        localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
    }
    window.dispatchEvent(new Event(AUTH_EVENT));
};

export const clearToken = (): void => {
    try {
        localStorage.removeItem(SESSION_FLAG_KEY);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
    }
    window.dispatchEvent(new Event(AUTH_EVENT));

    fetch("/api/v1/auth/logout", { method: "POST", keepalive: true }).catch(() => { });
};

const subscribe = (onChange: () => void): (() => void) => {
    window.addEventListener(AUTH_EVENT, onChange);
    window.addEventListener("storage", onChange);

    return () => {
        window.removeEventListener(AUTH_EVENT, onChange);
        window.removeEventListener("storage", onChange);
    };
};

export const useIsLoggedIn = (): boolean =>
    useSyncExternalStore(
        subscribe,
        () => getToken() !== null,
        () => false,
    );


export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export const useAuthStatus = (): AuthStatus =>
    useSyncExternalStore(
        subscribe,
        () => (getToken() !== null ? "authenticated" : "unauthenticated"),
        () => "loading",
    );

export { safeNextPath } from "./paths";