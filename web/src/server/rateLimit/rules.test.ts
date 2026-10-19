/**
 * Unit tests for the rate-limit rules (positive and negative cases).
 * Run from web/:  npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    bucketKey,
    clientIp,
    decide,
    formatRetryAfter,
    normaliseEmail,
    POLICIES,
    RateLimitPolicy,
    windowFor
} from "./rules";

const MINUTE = 60 * 1000;
const policy: RateLimitPolicy = { scope: "test", limit: 5, windowMs: 15 * MINUTE };

describe("windowFor", () => {
    it("puts times in the same 15-minute block in one window", () => {
        const a = windowFor(policy, 15 * MINUTE + 1);
        const b = windowFor(policy, 30 * MINUTE - 1);
        assert.deepEqual(a, b);
        assert.equal(a.start, 15 * MINUTE);
        assert.equal(a.resetAt, 30 * MINUTE);
    });

    it("starts a new window at the boundary", () => {
        assert.equal(windowFor(policy, 30 * MINUTE).start, 30 * MINUTE);
    });
});

describe("bucketKey", () => {
    it("separates scopes, identifiers and windows", () => {
        const keys = new Set([
            bucketKey(POLICIES.loginIp, "1.2.3.4", 0),
            bucketKey(POLICIES.loginEmail, "1.2.3.4", 0),
            bucketKey(POLICIES.loginIp, "5.6.7.8", 0),
            bucketKey(POLICIES.loginIp, "1.2.3.4", 15 * MINUTE)
        ]);
        assert.equal(keys.size, 4);
    });
});

describe("decide", () => {
    const window = windowFor(policy, 0);

    it("allows requests up to the limit (SEC-P1)", () => {
        for (let count = 1; count <= policy.limit; count++) {
            const result = decide(count, policy, window, 0);
            assert.equal(result.allowed, true);
            if (result.allowed) assert.equal(result.remaining, policy.limit - count);
        }
    });

    it("refuses the request after the limit (SEC-N1)", () => {
        const result = decide(policy.limit + 1, policy, window, 0);
        assert.equal(result.allowed, false);
    });

    it("says how long until the window resets", () => {
        const result = decide(policy.limit + 1, policy, window, 5 * MINUTE);
        assert.equal(result.allowed, false);
        if (!result.allowed) assert.equal(result.retryAfterSeconds, 10 * 60);
    });

    it("never reports a retry time below 1 second", () => {
        const result = decide(policy.limit + 1, policy, window, window.resetAt);
        assert.equal(result.allowed, false);
        if (!result.allowed) assert.equal(result.retryAfterSeconds, 1);
    });
});

describe("clientIp", () => {
    it("takes the first address from x-forwarded-for", () => {
        const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
        assert.equal(clientIp(headers), "203.0.113.7");
    });

    it("falls back to x-real-ip", () => {
        assert.equal(clientIp(new Headers({ "x-real-ip": "203.0.113.8" })), "203.0.113.8");
    });

    it("uses 'unknown' when no header is present", () => {
        assert.equal(clientIp(new Headers()), "unknown");
    });
});

describe("normaliseEmail", () => {
    it("gives one counter for case and spacing variants (SEC-N2)", () => {
        assert.equal(normaliseEmail("  Amaan@Example.COM "), "amaan@example.com");
    });
});

describe("formatRetryAfter", () => {
    it("formats seconds and minutes", () => {
        assert.equal(formatRetryAfter(1), "1 second");
        assert.equal(formatRetryAfter(30), "30 seconds");
        assert.equal(formatRetryAfter(60), "1 minute");
        assert.equal(formatRetryAfter(61), "2 minutes");
        assert.equal(formatRetryAfter(14 * 60), "14 minutes");
    });
});