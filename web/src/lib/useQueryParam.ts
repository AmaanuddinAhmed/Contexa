"use client";

import { useSyncExternalStore } from "react";

// The query string only changes by navigating, which remounts the page.
const subscribe = () => () => { };

/** One query-string value, read in the browser; null during server render. */
export const useQueryParam = (name: string): string | null =>
    useSyncExternalStore(
        subscribe,
        () => new URLSearchParams(window.location.search).get(name),
        () => null,
    );