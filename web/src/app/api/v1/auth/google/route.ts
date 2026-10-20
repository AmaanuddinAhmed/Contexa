import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/paths";
import {
    buildAuthUrl,
    encodeOAuthCookie,
    OAUTH_COOKIE,
    OAUTH_COOKIE_PATH,
    OAUTH_MAX_AGE_SECONDS,
    pkceChallenge,
    randomToken,
    readGoogleConfig
} from "@/server/oauth/google";

/** Starts Google sign-in: GET /api/v1/auth/google?next=/somewhere */
export const GET = (request: Request) => {
    const url = new URL(request.url);
    const config = readGoogleConfig(process.env, url.origin);

    if (!config) {
        return NextResponse.redirect(new URL("/login?error=google_unavailable", url.origin));
    }

    const state = randomToken();
    const verifier = randomToken();
    const response = NextResponse.redirect(buildAuthUrl(config, state, pkceChallenge(verifier)));

    // SameSite=Lax, not Strict: Google's redirect back is a cross-site
    // navigation, and a Strict cookie would not be sent with it.
    response.cookies.set(
        OAUTH_COOKIE,
        encodeOAuthCookie({ state, verifier, next: safeNextPath(url.searchParams.get("next")) }),
        {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: OAUTH_COOKIE_PATH,
            maxAge: OAUTH_MAX_AGE_SECONDS
        }
    );

    return response;
};