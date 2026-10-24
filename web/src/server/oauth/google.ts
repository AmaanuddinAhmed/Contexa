import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export const OAUTH_COOKIE = "contexa_oauth";
export const OAUTH_COOKIE_PATH = "/api/v1/auth/google";
export const OAUTH_MAX_AGE_SECONDS = 10 * 60;

export const CALLBACK_PATH = "/api/v1/auth/google/callback";

export interface GoogleConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export const readGoogleConfig = (
    env: Record<string, string | undefined>,
    requestOrigin: string
): GoogleConfig | null => {
    const clientId = env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
        return null;
    }

    const base = (env.APP_URL?.trim() || requestOrigin).replace(/\/+$/, "");

    return { clientId, clientSecret, redirectUri: `${base}${CALLBACK_PATH}` };
};

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

export const pkceChallenge = (verifier: string): string =>
    createHash("sha256").update(verifier).digest("base64url");

export const buildAuthUrl = (
    config: GoogleConfig,
    state: string,
    codeChallenge: string
): string => {
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "select_account"
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

export interface OAuthCookie {
    state: string;
    verifier: string;
    next: string | null;
}

export const encodeOAuthCookie = (value: OAuthCookie): string =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

export const decodeOAuthCookie = (raw: string | null): OAuthCookie | null => {
    if (!raw) return null;

    try {
        const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));

        if (typeof value?.state !== "string" || typeof value?.verifier !== "string") {
            return null;
        }

        return {
            state: value.state,
            verifier: value.verifier,
            next: typeof value.next === "string" ? value.next : null
        };
    } catch {
        return null;
    }
};

export const sameState = (expected: string, received: string | null): boolean => {
    if (!received) return false;

    const a = Buffer.from(expected);
    const b = Buffer.from(received);

    return a.length === b.length && timingSafeEqual(a, b);
};

export const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    try {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        return payload && typeof payload === "object" ? payload : null;
    } catch {
        return null;
    }
};

export interface GoogleIdentity {
    googleId: string;
    email: string;
    name?: string;
    picture?: string;
}

export type ClaimsResult = { identity: GoogleIdentity } | { error: string };

export const validateGoogleClaims = (
    claims: Record<string, unknown> | null,
    clientId: string,
    now: Date = new Date()
): ClaimsResult => {
    if (!claims) return { error: "MALFORMED_TOKEN" };

    if (typeof claims.iss !== "string" || !GOOGLE_ISSUERS.includes(claims.iss)) {
        return { error: "WRONG_ISSUER" };
    }

    if (claims.aud !== clientId) return { error: "WRONG_AUDIENCE" };

    if (typeof claims.exp !== "number" || claims.exp * 1000 <= now.getTime()) {
        return { error: "EXPIRED" };
    }

    if (typeof claims.sub !== "string" || claims.sub.length === 0) {
        return { error: "NO_SUBJECT" };
    }

    if (typeof claims.email !== "string" || claims.email.length === 0) {
        return { error: "NO_EMAIL" };
    }

    if (claims.email_verified !== true) return { error: "EMAIL_NOT_VERIFIED" };

    return {
        identity: {
            googleId: claims.sub,
            email: claims.email.trim().toLowerCase(),
            name: typeof claims.name === "string" ? claims.name : undefined,
            picture: typeof claims.picture === "string" ? claims.picture : undefined
        }
    };
};