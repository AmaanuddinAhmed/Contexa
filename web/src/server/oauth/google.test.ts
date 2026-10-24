import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeNextPath } from "../../lib/paths";
import {
    buildAuthUrl,
    CALLBACK_PATH,
    decodeJwtPayload,
    decodeOAuthCookie,
    encodeOAuthCookie,
    pkceChallenge,
    randomToken,
    readGoogleConfig,
    sameState,
    validateGoogleClaims
} from "./google";

const CLIENT_ID = "123.apps.googleusercontent.com";
const NOW = new Date("2026-10-20T10:00:00Z");
const nowSeconds = Math.floor(NOW.getTime() / 1000);

const goodClaims = () => ({
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    exp: nowSeconds + 300,
    sub: "1098765",
    email: "Amaan@Example.com",
    email_verified: true,
    name: "Amaan",
    picture: "https://lh3.googleusercontent.com/a/photo"
});

const fakeJwt = (payload: object) =>
    ["e30", Buffer.from(JSON.stringify(payload)).toString("base64url"), "sig"].join(".");

describe("readGoogleConfig", () => {
    it("builds the redirect URI from APP_URL when set", () => {
        const config = readGoogleConfig(
            { GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: "s", APP_URL: "https://contexa.example/" },
            "https://preview-123.vercel.app"
        );
        assert.equal(config?.redirectUri, `https://contexa.example${CALLBACK_PATH}`);
    });

    it("falls back to the request origin", () => {
        const config = readGoogleConfig({ GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: "s" }, "http://localhost:3000");
        assert.equal(config?.redirectUri, `http://localhost:3000${CALLBACK_PATH}`);
    });

    it("is null when the client id or secret is missing", () => {
        assert.equal(readGoogleConfig({ GOOGLE_CLIENT_ID: CLIENT_ID }, "http://localhost:3000"), null);
        assert.equal(readGoogleConfig({ GOOGLE_CLIENT_SECRET: "s" }, "http://localhost:3000"), null);
    });
});

describe("PKCE and state", () => {
    it("makes a 43-character URL-safe S256 challenge", () => {
        const challenge = pkceChallenge(randomToken());
        assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
    });

    it("gives the same challenge for the same verifier, different for another", () => {
        assert.equal(pkceChallenge("abc"), pkceChallenge("abc"));
        assert.notEqual(pkceChallenge("abc"), pkceChallenge("abd"));
    });

    it("puts state, challenge and scopes in the Google URL", () => {
        const url = new URL(buildAuthUrl(
            { clientId: CLIENT_ID, clientSecret: "s", redirectUri: "http://localhost:3000/cb" },
            "state-1",
            "challenge-1"
        ));
        assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
        assert.equal(url.searchParams.get("state"), "state-1");
        assert.equal(url.searchParams.get("code_challenge"), "challenge-1");
        assert.equal(url.searchParams.get("code_challenge_method"), "S256");
        assert.equal(url.searchParams.get("scope"), "openid email profile");
        assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/cb");
    });

    it("round-trips the state cookie", () => {
        const value = { state: "s", verifier: "v", next: "/map" };
        assert.deepEqual(decodeOAuthCookie(encodeOAuthCookie(value)), value);
    });

    it("rejects a missing or tampered state cookie", () => {
        assert.equal(decodeOAuthCookie(null), null);
        assert.equal(decodeOAuthCookie("not-json"), null);
        assert.equal(decodeOAuthCookie(Buffer.from('{"state":1}').toString("base64url")), null);
    });

    it("matches only the exact state", () => {
        assert.ok(sameState("abc", "abc"));
        assert.ok(!sameState("abc", "abd"));
        assert.ok(!sameState("abc", "ab"));
        assert.ok(!sameState("abc", null));
    });
});

describe("validateGoogleClaims", () => {
    it("accepts a valid token and lower-cases the email", () => {
        const result = validateGoogleClaims(decodeJwtPayload(fakeJwt(goodClaims())), CLIENT_ID, NOW);
        assert.ok("identity" in result);
        assert.deepEqual(result.identity, {
            googleId: "1098765",
            email: "amaan@example.com",
            name: "Amaan",
            picture: "https://lh3.googleusercontent.com/a/photo"
        });
    });

    it("accepts the short issuer form", () => {
        const result = validateGoogleClaims({ ...goodClaims(), iss: "accounts.google.com" }, CLIENT_ID, NOW);
        assert.ok("identity" in result);
    });

    const rejects: [string, Record<string, unknown> | null, string][] = [
        ["a malformed token", decodeJwtPayload("not.a.jwt.at.all"), "MALFORMED_TOKEN"],
        ["another issuer", { ...goodClaims(), iss: "https://evil.example" }, "WRONG_ISSUER"],
        ["a token for another app", { ...goodClaims(), aud: "other-client" }, "WRONG_AUDIENCE"],
        ["an expired token", { ...goodClaims(), exp: nowSeconds - 1 }, "EXPIRED"],
        ["no subject", { ...goodClaims(), sub: "" }, "NO_SUBJECT"],
        ["no email", { ...goodClaims(), email: undefined }, "NO_EMAIL"],
        ["an unverified email", { ...goodClaims(), email_verified: false }, "EMAIL_NOT_VERIFIED"]
    ];

    for (const [label, claims, code] of rejects) {
        it(`rejects ${label}`, () => {
            assert.deepEqual(validateGoogleClaims(claims, CLIENT_ID, NOW), { error: code });
        });
    }
});

describe("safeNextPath", () => {
    it("keeps same-site paths", () => {
        assert.equal(safeNextPath("/map?x=1"), "/map?x=1");
    });

    it("drops other sites and empty values", () => {
        assert.equal(safeNextPath("//evil.com"), null);
        assert.equal(safeNextPath("/\\evil.com"), null);
        assert.equal(safeNextPath("https://evil.com"), null);
        assert.equal(safeNextPath(null), null);
    });
});