import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { authenticate } from "@/server/auth";
import { connectDatabase } from "@/server/db";
import { errorResponse } from "@/server/http";
import { POLICIES } from "@/server/rateLimit/rules";
import { consumeRateLimit, tooManyRequests } from "@/server/rateLimit/service";
import { unblockUser } from "@/server/safety/service";

export const DELETE = async (
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    const { userId } = await params;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(auth.userId)) {
        return errorResponse(404, "BLOCK_NOT_FOUND", "You have not blocked this person.");
    }

    try {
        await connectDatabase();

        const limit = await consumeRateLimit(POLICIES.blockUser, auth.userId);
        if (!limit.allowed) {
            return tooManyRequests(limit.retryAfterSeconds, "block changes");
        }

        if (!(await unblockUser(auth.userId, userId))) {
            return errorResponse(404, "BLOCK_NOT_FOUND", "You have not blocked this person.");
        }

        return NextResponse.json({ success: true, message: "Unblocked." });
    } catch (error) {
        console.error("Unblock error:", error);
        return errorResponse(500, "UNBLOCK_FAILED", "Unable to unblock this person.");
    }
};