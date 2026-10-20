import { NextResponse } from "next/server";
import { setSessionCookie } from "@/server/auth";
import { connectDatabase } from "@/server/db";
import { User } from "@/server/models/User";
import {
    decodeJwtPayload,
    decodeOAuthCookie,
    GOOGLE_TOKEN_URL,
    OAUTH_COOKIE,
    OAUTH_COOKIE_PATH,
    readGoogleConfig,
    sameState,
    validateGoogleClaims
} from "@/server/oauth/google";
import { readCookie } from "@/server/session";

/**
 * Google redirects here with ?code&state. Checks the state, swaps the code
 * for an ID token, then signs in the matching account: by Google id, else by
 * the same (Google-verified) email, else a new account.
 */
export const GET = async (request: Request) => {
    const url = new URL(request.url);

    const finish = (path: string) => {
        const response = NextResponse.redirect(new URL(path, url.origin));
        // The state cookie is single-use.
        response.cookies.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
        return response;
    };
    const fail = (code: string) => finish(`/login?error=${code}`);

    const config = readGoogleConfig(process.env, url.origin);
    if (!config) return fail("google_unavailable");

    // The user pressed Cancel on Google's screen.
    if (url.searchParams.get("error")) return fail("google_cancelled");

    const saved = decodeOAuthCookie(readCookie(request.headers.get("cookie"), OAUTH_COOKIE));
    const code = url.searchParams.get("code");

    if (!saved || !code || !sameState(saved.state, url.searchParams.get("state"))) {
        return fail("google_state");
    }

    try {
        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uri: config.redirectUri,
                grant_type: "authorization_code",
                code_verifier: saved.verifier
            }),
            signal: AbortSignal.timeout(10_000)
        });

        if (!tokenResponse.ok) {
            console.error("Google token exchange failed:", tokenResponse.status, await tokenResponse.text());
            return fail("google_failed");
        }

        const tokens = (await tokenResponse.json()) as { id_token?: string };
        const result = validateGoogleClaims(
            tokens.id_token ? decodeJwtPayload(tokens.id_token) : null,
            config.clientId
        );

        if ("error" in result) {
            console.error("Google ID token rejected:", result.error);
            return fail(result.error === "EMAIL_NOT_VERIFIED" ? "google_unverified" : "google_failed");
        }

        const { googleId, email, picture } = result.identity;

        await connectDatabase();

        let user = await User.findOne({ googleId });
        let created = false;

        if (!user) {
            user = await User.findOne({ email });

            if (user) {
                // Same email, verified by Google: link it to this account.
                user.googleId = googleId;
            } else {
                user = new User({ email, googleId });
                created = true;
            }
        }

        if (!user.isActive) return fail("account_disabled");

        if (picture) user.googlePicture = picture;
        await user.save();

        const next = created
            ? "/profile?onboarding=1"
            : saved.next ?? "/recommendations";

        return setSessionCookie(
            finish(`/auth/google/done?next=${encodeURIComponent(next)}`),
            user.id
        );
    } catch (error) {
        console.error("Google sign-in error:", error);
        return fail("google_failed");
    }
};