export interface RateLimitPolicy {
    scope: string;
    limit: number;
    windowMs: number;
}

const MINUTE = 60 * 1000;

export const POLICIES = {
    loginIp: { scope: "login:ip", limit: 50, windowMs: 15 * MINUTE },
    loginEmail: { scope: "login:email", limit: 5, windowMs: 15 * MINUTE },
    registerIp: { scope: "register:ip", limit: 20, windowMs: 60 * MINUTE },
    avatarUser: { scope: "avatar:user", limit: 20, windowMs: 60 * MINUTE },
    blockUser: { scope: "block:user", limit: 30, windowMs: 60 * MINUTE },
    reportUser: { scope: "report:user", limit: 10, windowMs: 24 * 60 * MINUTE },
    deleteAccount: { scope: "delete:user", limit: 5, windowMs: 15 * MINUTE },
    warmIp: { scope: "warm:ip", limit: 60, windowMs: 15 * MINUTE }
} satisfies Record<string, RateLimitPolicy>;

export interface RateWindow {
    start: number;
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

export const clientIp = (headers: Headers): string => {
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;

    const realIp = headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;

    return "unknown";
};

export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

export const formatRetryAfter = (seconds: number): string => {
    if (seconds < 60) {
        return `${seconds} second${seconds === 1 ? "" : "s"}`;
    }

    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};