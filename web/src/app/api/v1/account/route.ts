import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { checkDeleteRequest } from "@/lib/account";
import { deleteAccount } from "@/server/account/service";
import { authenticate, clearSessionCookie, comparePassword } from "@/server/auth";
import { connectDatabase } from "@/server/db";
import { errorResponse, readJsonBody } from "@/server/http";
import { User } from "@/server/models/User";
import { POLICIES } from "@/server/rateLimit/rules";
import { consumeRateLimit, tooManyRequests } from "@/server/rateLimit/service";
import { deleteAccountSchema } from "@/server/validation";

/** What the delete form needs: whether to ask for a password or for DELETE. */
export const GET = async (request: Request) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    if (!mongoose.Types.ObjectId.isValid(auth.userId)) {
        return errorResponse(400, "INVALID_USER_ID", "Invalid user identifier.");
    }

    try {
        await connectDatabase();

        const user = await User.findById(auth.userId).select({ email: 1, passwordHash: 1 }).lean();

        if (!user) {
            return errorResponse(404, "USER_NOT_FOUND", "Account not found.");
        }

        return NextResponse.json({
            success: true,
            data: { email: user.email, hasPassword: Boolean(user.passwordHash) }
        });
    } catch (error) {
        console.error("Get account error:", error);
        return errorResponse(500, "ACCOUNT_FETCH_FAILED", "Unable to load your account.");
    }
};

/**
 * Permanently deletes the caller's account and logs them out.
 * Body: { "password": "..." } or, for Google-only accounts, { "confirm": "DELETE" }.
 */
export const DELETE = async (request: Request) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    if (!mongoose.Types.ObjectId.isValid(auth.userId)) {
        return errorResponse(400, "INVALID_USER_ID", "Invalid user identifier.");
    }

    const result = deleteAccountSchema.safeParse(await readJsonBody(request));

    if (!result.success) {
        return errorResponse(400, "INVALID_REQUEST", "Invalid delete request.");
    }

    try {
        await connectDatabase();

        const limit = await consumeRateLimit(POLICIES.deleteAccount, auth.userId);
        if (!limit.allowed) {
            return tooManyRequests(limit.retryAfterSeconds, "attempts");
        }

        const user = await User.findById(auth.userId).select({ passwordHash: 1 });

        if (!user) {
            return errorResponse(404, "USER_NOT_FOUND", "Account not found.");
        }

        const check = checkDeleteRequest(Boolean(user.passwordHash), result.data);

        if (!check.ok) {
            return errorResponse(check.status, check.code, check.message);
        }

        if (
            check.needsPasswordCheck &&
            !(await comparePassword(result.data.password ?? "", user.passwordHash ?? ""))
        ) {
            return errorResponse(403, "WRONG_PASSWORD", "That password is not correct.");
        }

        await deleteAccount(auth.userId);

        return clearSessionCookie(
            NextResponse.json({ success: true, message: "Your account has been deleted." })
        );
    } catch (error) {
        console.error("Delete account error:", error);
        return errorResponse(500, "ACCOUNT_DELETE_FAILED", "Unable to delete your account.");
    }
};