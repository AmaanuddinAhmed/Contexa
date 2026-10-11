"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Calls `callback` every `intervalMs` while the tab is visible, and once
 * more when the tab becomes visible again. Never runs two calls at once.
 * Errors are ignored here: the callback reports its own, and the next tick retries.
 */
export const usePolling = (
    callback: () => Promise<void>,
    intervalMs: number,
    enabled = true,
): void => {
    const latest = useRef(callback);

    useEffect(() => {
        latest.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let running = false;

        const tick = async () => {
            if (running || document.visibilityState !== "visible") {
                return;
            }

            running = true;

            try {
                await latest.current();
            } catch {
                // The next tick retries.
            } finally {
                running = false;
            }
        };

        const intervalId = window.setInterval(tick, intervalMs);
        const onVisibilityChange = () => void tick();

        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [intervalMs, enabled]);
};

/**
 * Like usePolling, but the wait before each call comes from `delayFor`, given
 * how long it has been since the last activity. Activity is:
 *  - the callback returning true (it found something new)
 *  - the returned `markActive` being called (e.g. the user sent or typed)
 *  - the tab becoming visible again
 *
 * Pauses while the tab is hidden. `delayFor` should be a stable function
 * (defined outside the component), or polling restarts on every render.
 */
export const useAdaptivePolling = (
    callback: () => Promise<boolean>,
    delayFor: (quietForMs: number) => number,
    enabled = true,
): (() => void) => {
    const latest = useRef(callback);
    // Replaced while polling runs; a no-op otherwise.
    const markActiveRef = useRef<() => void>(() => { });

    useEffect(() => {
        latest.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let stopped = false;
        let running = false;
        let timerId: number | undefined;
        let nextAt = 0;
        let lastActivity = Date.now();

        const schedule = () => {
            window.clearTimeout(timerId);

            if (stopped || document.visibilityState !== "visible") {
                return;
            }

            const delay = delayFor(Date.now() - lastActivity);

            nextAt = Date.now() + delay;
            timerId = window.setTimeout(tick, delay);
        };

        const tick = async () => {
            if (running || stopped) {
                return;
            }

            running = true;

            try {
                if (await latest.current()) {
                    lastActivity = Date.now();
                }
            } catch {
                // The next tick retries.
            } finally {
                running = false;
            }

            schedule();
        };

        markActiveRef.current = () => {
            lastActivity = Date.now();

            // Bring the next check forward if it is further away than the fastest
            // delay. Never pushes it back, so continuous typing cannot stop polling.
            if (!running && nextAt > Date.now() + delayFor(0)) {
                schedule();
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                lastActivity = Date.now();
                void tick();
            } else {
                window.clearTimeout(timerId);
            }
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        schedule();

        return () => {
            stopped = true;
            window.clearTimeout(timerId);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            markActiveRef.current = () => { };
        };
    }, [enabled, delayFor]);

    return useCallback(() => markActiveRef.current(), []);
};