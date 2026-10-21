/**
 * Keep-warm: the recommendation service runs on a free host that stops it
 * after 15 idle minutes and takes about a minute to restart. Each browser
 * that opens Contexa pings it (through /api/v1/warm) at most once per
 * WARM_INTERVAL_MS, so it is usually awake before anyone asks for matches.
 */

export const WARM_INTERVAL_MS = 5 * 60 * 1000;

/** localStorage key holding when this browser last sent a ping (ms since epoch). */
export const WARM_STORAGE_KEY = "contexa_warm_at";

/** Should this browser ping now? `lastAt` is null if it never has (or storage is unreadable). */
export const shouldWarm = (
    lastAt: number | null,
    now: number,
    intervalMs: number = WARM_INTERVAL_MS
): boolean =>
    lastAt === null || !Number.isFinite(lastAt) || lastAt > now || now - lastAt >= intervalMs;

/** How the admin page describes a ping result. */
export const describeServiceStatus = (status: { awake: boolean; ms: number }): string =>
    status.awake
        ? status.ms >= 5000
            ? `Was asleep; woke up in ${Math.round(status.ms / 1000)} s`
            : `Awake; answered in ${status.ms} ms`
        : `No answer after ${Math.round(status.ms / 1000)} s`;