/**
 * Unit tests for the session cookie helpers (positive and negative cases).
 * Run from web/:  npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    extractToken,
    readCookie,
    SESSION_COOKIE,
    SESSION_MAX_AGE_SECONDS,
    sessionCookieOptions
} from "./session";

describe("sessionCookieOptions", () => {
    it("is httpOnly, strict same-site and site-wide (AUTH-P1)", () => {
        const options = sessionCookieOptions(true);
        assert.equal(options.httpOnly, true);
        assert.equal(options.sameSite, "strict");
        assert.equal(options.path, "/");
        assert.equal(options.maxAge, SESSION_MAX_AGE_SECONDS);
    });

    it("is HTTPS-only in production but not locally", () => {
        assert.equal(sessionCookieOptions(true).secure, true);
        assert.equal(sessionCookieOptions(false).secure, false);
    });

    it("expires immediately when clearing (logout)", () => {
        assert.equal(sessionCookieOptions(true, 0).maxAge, 0);
    });
});

describe("readCookie", () => {
    it("finds a cookie among several", () => {
        assert.equal(readCookie("a=1; contexa_session=abc.def; b=2", SESSION_COOKIE), "abc.def");
    });

    it("does not match a cookie whose name only ends the same", () => {
        assert.equal(readCookie("old_contexa_session=x", SESSION_COOKIE), null);
    });

    it("keeps '=' inside the value", () => {
        assert.equal(readCookie("contexa_session=a=b=", SESSION_COOKIE), "a=b=");
    });

    it("returns null for a missing header, missing cookie or empty value", () => {
        assert.equal(readCookie(null, SESSION_COOKIE), null);
        assert.equal(readCookie("a=1", SESSION_COOKIE), null);
        assert.equal(readCookie("contexa_session=", SESSION_COOKIE), null);
    });

    it("returns null for a malformed encoded value", () => {
        assert.equal(readCookie("contexa_session=%E0%A4%A", SESSION_COOKIE), null);
    });
});

describe("extractToken", () => {
    it("reads the session cookie (AUTH-P2)", () => {
        const headers = new Headers({ cookie: "contexa_session=cookie-token" });
        assert.equal(extractToken(headers), "cookie-token");
    });

    it("prefers the cookie over a Bearer header", () => {
        const headers = new Headers({
            cookie: "contexa_session=cookie-token",
            authorization: "Bearer header-token"
        });
        assert.equal(extractToken(headers), "cookie-token");
    });

    it("accepts a Bearer header from API testing tools", () => {
        const headers = new Headers({ authorization: "Bearer header-token" });
        assert.equal(extractToken(headers), "header-token");
    });

    it("returns null with no credentials (AUTH-N1)", () => {
        assert.equal(extractToken(new Headers()), null);
        assert.equal(extractToken(new Headers({ authorization: "Basic abc" })), null);
        assert.equal(extractToken(new Headers({ authorization: "Bearer " })), null);
    });
});