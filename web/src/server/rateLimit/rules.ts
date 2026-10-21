/**
 * Rate-limit rules: which bucket a request falls in and whether it is over
 * the limit.
 *
 * Pure functions only (no database), so the rules can be unit tested on
 * their own; service.ts stores the counters in MongoDB.
 *
 * Fixed windows: time is cut into blocks of `windowMs`, and each
 * (policy, identifier, window) has one counter. In-memory counters would not
 * work on Vercel, where each request may run on a different instance, so the
 * counters live in the database instead.
 */

export interface RateLimitPolicy {
    /** Prefix for the counter key, e.g. "login:ip". */
    scope: string;
    /** Requests allowed per window; request number limit + 1 is refused. */
    limit: number;
    windowMs: number;
}

const MINUTE = 60 * 1000;

/**
 * Limits are generous per IP because classmates on campus Wi-Fi share one
 * public IP; the per-email limit is the one that stops password guessing.
 */
export const POLICIES = {
    /** All login attempts from one IP. */
    loginIp: { scope: "login:ip", limit: 50, windowMs: 15 * MINUTE },
    /** Login attempts for one account (cleared after a successful login). */
    loginEmail: { scope: "login:email", limit: 5, windowMs: 15 * MINUTE },
    /** New accounts from one IP. */
    registerIp: { scope: "register:ip", limit: 20, windowMs: 60 * MINUTE },
    /** Profile picture uploads by one user. */
    avatarUser: { scope: "avatar:user", limit: 20, windowMs: 60 * MINUTE }
} satisfies Record<string, RateLimitPolicy>;

export interface RateWindow {
    start: number;
    /** When this window ends and the counter starts again (ms since epoch). */
    resetAt: number;
}

export const windowFor = (policy: RateLimitPolicy, now: number): RateWindow => {
    const start = Math.floor(now / policy.windowMs) * policy.windowMs;
    return { start, resetAt: start + policy.windowMs };
};

export const bucketKey = (
    policy: RateLimitPolicy,
    identifier: string,
    windowStart: number
): string => `${policy.scope}:${identifier}:${windowStart}`;

export type RateLimitDecision =
    | { allowed: true; remaining: number }
    | { allowed: false; retryAfterSeconds: number };

/** `count` is the counter after this request was added. */
export const decide = (
    count: number,
    policy: RateLimitPolicy,
    window: RateWindow,
    now: number
): RateLimitDecision => {
    if (count <= policy.limit) {
        return { allowed: true, remaining: policy.limit - count };
    }

    return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000))
    };
};

/**
 * The caller's IP. Vercel sets x-forwarded-for (client first) and
 * x-real-ip; locally neither may be present, so all requests share "unknown".
 */
export const clientIp = (headers: Headers): string => {
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;

    const realIp = headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;

    return "unknown";
};

/** "Amaan@Example.com " and "amaan@example.com" share one counter. */
export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

/** "14 minutes" / "1 minute" / "30 seconds", for the error message. */
export const formatRetryAfter = (seconds: number): string => {
    if (seconds < 60) {
        return `${seconds} second${seconds === 1 ? "" : "s"}`;
    }

    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};