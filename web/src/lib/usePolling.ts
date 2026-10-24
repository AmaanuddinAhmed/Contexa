"use client";

import { useCallback, useEffect, useRef } from "react";

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

export const useAdaptivePolling = (
    callback: () => Promise<boolean>,
    delayFor: (quietForMs: number) => number,
    enabled = true,
): (() => void) => {
    const latest = useRef(callback);
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
            } finally {
                running = false;
            }

            schedule();
        };

        markActiveRef.current = () => {
            lastActivity = Date.now();

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