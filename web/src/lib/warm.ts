export const WARM_INTERVAL_MS = 5 * 60 * 1000;

export const WARM_STORAGE_KEY = "contexa_warm_at";

export const shouldWarm = (
    lastAt: number | null,
    now: number,
    intervalMs: number = WARM_INTERVAL_MS
): boolean =>
    lastAt === null || !Number.isFinite(lastAt) || lastAt > now || now - lastAt >= intervalMs;

export const describeServiceStatus = (status: { awake: boolean; ms: number }): string =>
    status.awake
        ? status.ms >= 5000
            ? `Was asleep; woke up in ${Math.round(status.ms / 1000)} s`
            : `Awake; answered in ${status.ms} ms`
        : `No answer after ${Math.round(status.ms / 1000)} s`;