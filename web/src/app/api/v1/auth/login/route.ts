import { NextResponse } from "next/server";
import { connectDatabase } from "@/server/db";
import { comparePassword, setSessionCookie } from "@/server/auth";
import { errorResponse, readJsonBody } from "@/server/http";
import { User } from "@/server/models/User";
import { loginSchema } from "@/server/validation";
import { clientIp, normaliseEmail, POLICIES } from "@/server/rateLimit/rules";
import {
    consumeRateLimit,
    resetRateLimit,
    tooManyRequests
} from "@/server/rateLimit/service";

export const POST = async (request: Request) => {
    try {
        const result = loginSchema.safeParse(await readJsonBody(request));

        if (!result.success) {
            return errorResponse(400, "INVALID_INPUT", "Invalid login data.");
        }

        const { email, password } = result.data;

        await connectDatabase();

        const ipLimit = await consumeRateLimit(POLICIES.loginIp, clientIp(request.headers));
        if (!ipLimit.allowed) {
            return tooManyRequests(ipLimit.retryAfterSeconds, "login attempts");
        }

        const emailKey = normaliseEmail(email);
        const emailLimit = await consumeRateLimit(POLICIES.loginEmail, emailKey);
        if (!emailLimit.allowed) {
            return tooManyRequests(emailLimit.retryAfterSeconds, "login attempts");
        }

        const user = await User.findOne({ email });

        if (!user || !user.isActive) {
            return errorResponse(401, "INVALID_CREDENTIALS", "Invalid email or password.");
        }

        if (!user.passwordHash) {
            return errorResponse(
                401,
                "USE_GOOGLE_SIGN_IN",
                "This account signs in with Google. Use Continue with Google."
            );
        }

        const passwordValid = await comparePassword(password, user.passwordHash);

        if (!passwordValid) {
            return errorResponse(401, "INVALID_CREDENTIALS", "Invalid email or password.");
        }

        await resetRateLimit(POLICIES.loginEmail, emailKey);

        return setSessionCookie(
            NextResponse.json({
                success: true,
                data: {
                    user: { id: user.id, email: user.email, role: user.role }
                }
            }),
            user.id
        );
    } catch (error) {
        console.error("Login error:", error);
        return errorResponse(500, "LOGIN_FAILED", "Unable to log in.");
    }
};