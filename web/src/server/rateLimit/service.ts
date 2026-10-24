import "server-only";

import { NextResponse } from "next/server";
import { errorResponse } from "../http";
import { RateLimit } from "../models/RateLimit";
import {
    bucketKey,
    decide,
    formatRetryAfter,
    RateLimitDecision,
    RateLimitPolicy,
    windowFor
} from "./rules";

const isDuplicateKeyError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000;

export const consumeRateLimit = async (
    policy: RateLimitPolicy,
    identifier: string
): Promise<RateLimitDecision> => {
    const now = Date.now();
    const window = windowFor(policy, now);
    const key = bucketKey(policy, identifier, window.start);

    const increment = () =>
        RateLimit.findOneAndUpdate(
            { key },
            {
                $inc: { count: 1 },
                $setOnInsert: { expiresAt: new Date(window.resetAt) }
            },
            { upsert: true, returnDocument: "after" }
        ).lean();

    let counter;
    try {
        counter = await increment();
    } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        counter = await increment();
    }

    return decide(counter?.count ?? 1, policy, window, now);
};

export const resetRateLimit = async (
    policy: RateLimitPolicy,
    identifier: string
): Promise<void> => {
    const window = windowFor(policy, Date.now());
    await RateLimit.deleteOne({ key: bucketKey(policy, identifier, window.start) });
};

export const tooManyRequests = (
    retryAfterSeconds: number,
    action: string
): NextResponse => {
    const response = errorResponse(
        429,
        "TOO_MANY_REQUESTS",
        `Too many ${action}. Please try again in ${formatRetryAfter(retryAfterSeconds)}.`
    );
    response.headers.set("Retry-After", String(retryAfterSeconds));
    return response;
};