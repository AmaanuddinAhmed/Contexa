import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { authenticate, requireActiveUser } from "@/server/auth";
import { connectDatabase } from "@/server/db";
import { errorResponse, readJsonBody } from "@/server/http";
import { Block } from "@/server/models/Block";
import { Profile } from "@/server/models/Profile";
import { User } from "@/server/models/User";
import { avatarUrlsFor } from "@/server/avatars/service";
import { POLICIES } from "@/server/rateLimit/rules";
import { consumeRateLimit, tooManyRequests } from "@/server/rateLimit/service";
import { checkSafetyTarget } from "@/lib/safety";
import { blockUser } from "@/server/safety/service";
import { blockSchema } from "@/server/validation";

const MAX_LISTED = 200;

/** People the caller has blocked, newest first. */
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

        const blocks = await Block.find({ blockerId: auth.userId })
            .sort({ createdAt: -1 })
            .limit(MAX_LISTED)
            .lean();
        const ids = blocks.map((block) => block.blockedId);

        const [profiles, avatarById] = await Promise.all([
            Profile.find({ userId: { $in: ids } }).select({ userId: 1, name: 1, role: 1 }).lean(),
            avatarUrlsFor(ids)
        ]);
        const profileById = new Map(profiles.map((profile) => [profile.userId.toString(), profile]));

        return NextResponse.json({
            success: true,
            data: {
                blocked: blocks.map((block) => {
                    const userId = block.blockedId.toString();
                    const profile = profileById.get(userId);

                    return {
                        userId,
                        name: profile?.name ?? "CONTEXA user",
                        role: profile?.role,
                        avatarUrl: avatarById.get(userId) ?? null,
                        blockedAt: block.createdAt
                    };
                })
            }
        });
    } catch (error) {
        console.error("List blocks error:", error);
        return errorResponse(500, "BLOCKS_FETCH_FAILED", "Unable to load blocked people.");
    }
};

/** Blocks a person. Body: { "userId": "..." }. Also removes any connection between you. */
export const POST = async (request: Request) => {
    const auth = await requireActiveUser(request);

    if ("response" in auth) {
        return auth.response;
    }

    const result = blockSchema.safeParse(await readJsonBody(request));

    if (!result.success) {
        return errorResponse(400, "INVALID_BLOCK", "Invalid block request.");
    }

    const { userId } = result.data;
    const rule = checkSafetyTarget(auth.userId, userId);

    if (!rule.ok) {
        return errorResponse(rule.status, rule.code, rule.message);
    }

    try {
        await connectDatabase();

        const limit = await consumeRateLimit(POLICIES.blockUser, auth.userId);
        if (!limit.allowed) {
            return tooManyRequests(limit.retryAfterSeconds, "block changes");
        }

        if (!(await User.exists({ _id: userId }))) {
            return errorResponse(404, "USER_NOT_FOUND", "This person was not found.");
        }

        const created = await blockUser(auth.userId, userId);

        return NextResponse.json(
            { success: true, message: "Blocked." },
            { status: created ? 201 : 200 }
        );
    } catch (error) {
        console.error("Block error:", error);
        return errorResponse(500, "BLOCK_FAILED", "Unable to block this person.");
    }
};