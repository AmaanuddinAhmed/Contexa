export const SESSION_COOKIE = "contexa_session";

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface SessionCookieOptions {
    httpOnly: true;
    secure: boolean;
    sameSite: "strict";
    path: "/";
    maxAge: number;
}

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

export const extractToken = (headers: Headers): string | null => {
    const fromCookie = readCookie(headers.get("cookie"), SESSION_COOKIE);
    if (fromCookie) return fromCookie;

    const authorization = headers.get("authorization");
    if (authorization?.startsWith("Bearer ")) {
        return authorization.substring(7).trim() || null;
    }

    return null;
};