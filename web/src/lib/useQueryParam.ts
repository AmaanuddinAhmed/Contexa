"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => { };

export const useQueryParam = (name: string): string | null =>
    useSyncExternalStore(
        subscribe,
        () => new URLSearchParams(window.location.search).get(name),
        () => null,
    );