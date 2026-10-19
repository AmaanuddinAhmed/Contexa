/**
 * Session cookie settings and parsing.
 *
 * The login token lives in an httpOnly cookie, so page scripts (including
 * any injected by an XSS bug) cannot read it; the browser attaches it to
 * same-site API requests by itself.
 *
 * Pure functions only (no database, no Next.js), so they can be unit tested.
 */

export const SESSION_COOKIE = "contexa_session";

/** Same lifetime as the token itself (7 days). */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface SessionCookieOptions {
    httpOnly: true;
    secure: boolean;
    sameSite: "strict";
    path: "/";
    maxAge: number;
}

/**
 * - httpOnly: not readable from JavaScript.
 * - secure: sent over HTTPS only (off locally, where the app runs on http).
 * - sameSite "strict": never sent on requests started by another site, which
 *   blocks cross-site request forgery. The pages are rendered in the browser
 *   and call the API from the same site, so nothing legitimate needs it
 *   cross-site.
 */
export const sessionCookieOptions = (
    production: boolean,
    maxAge: number = SESSION_MAX_AGE_SECONDS
): SessionCookieOptions => ({
    httpOnly: true,
    secure: production,
    sameSite: "strict",
    path: "/",
    maxAge
});

/** The value of one cookie from a Cookie header, or null. */
export const readCookie = (cookieHeader: string | null, name: string): string | null => {
    if (!cookieHeader) return null;

    for (const part of cookieHeader.split(";")) {
        const separator = part.indexOf("=");
        if (separator === -1) continue;

        if (part.slice(0, separator).trim() === name) {
            const value = part.slice(separator + 1).trim();
            if (!value) return null;

            try {
                return decodeURIComponent(value);
            } catch {
                return null;
            }
        }
    }

    return null;
};

/**
 * The token to verify: the session cookie first; otherwise an
 * "Authorization: Bearer" header, kept for API testing tools (curl, Postman).
 */
export const extractToken = (headers: Headers): string | null => {
    const fromCookie = readCookie(headers.get("cookie"), SESSION_COOKIE);
    if (fromCookie) return fromCookie;

    const authorization = headers.get("authorization");
    if (authorization?.startsWith("Bearer ")) {
        return authorization.substring(7).trim() || null;
    }

    return null;
};