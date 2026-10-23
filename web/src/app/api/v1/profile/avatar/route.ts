import { NextResponse } from "next/server";
import { authenticate, requireActiveUser } from "@/server/auth";
import { MAX_AVATAR_BYTES, sniffImageType } from "@/server/avatars/image";
import { avatarUrlFor } from "@/server/avatars/service";
import { connectDatabase } from "@/server/db";
import { errorResponse } from "@/server/http";
import { Avatar } from "@/server/models/Avatar";
import { POLICIES } from "@/server/rateLimit/rules";
import { consumeRateLimit, tooManyRequests } from "@/server/rateLimit/service";

/** Sets the caller's picture. Body: the image itself (JPEG, PNG or WebP). */
export const PUT = async (request: Request) => {
    const auth = await requireActiveUser(request);

    if ("response" in auth) {
        return auth.response;
    }

    // Refuse obviously large uploads before reading them.
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_AVATAR_BYTES) {
        return errorResponse(413, "AVATAR_TOO_LARGE", "The picture is too large.");
    }

    let bytes: Uint8Array;
    try {
        bytes = new Uint8Array(await request.arrayBuffer());
    } catch {
        return errorResponse(400, "INVALID_AVATAR", "Could not read the picture.");
    }

    if (bytes.length === 0) {
        return errorResponse(400, "INVALID_AVATAR", "No picture was sent.");
    }

    if (bytes.length > MAX_AVATAR_BYTES) {
        return errorResponse(413, "AVATAR_TOO_LARGE", "The picture is too large.");
    }

    const contentType = sniffImageType(bytes);

    if (!contentType) {
        return errorResponse(415, "UNSUPPORTED_AVATAR", "Use a JPEG, PNG or WebP picture.");
    }

    try {
        await connectDatabase();

        const limit = await consumeRateLimit(POLICIES.avatarUser, auth.userId);
        if (!limit.allowed) {
            return tooManyRequests(limit.retryAfterSeconds, "picture uploads");
        }

        await Avatar.findOneAndUpdate(
            { userId: auth.userId },
            { userId: auth.userId, data: Buffer.from(bytes), contentType, source: "upload" },
            { upsert: true, runValidators: true }
        );

        return NextResponse.json({
            success: true,
            data: { avatarUrl: await avatarUrlFor(auth.userId) }
        });
    } catch (error) {
        console.error("Upload avatar error:", error);
        return errorResponse(500, "AVATAR_SAVE_FAILED", "Unable to save the picture.");
    }
};

/** Removes the caller's picture; their initials are shown instead. */
export const DELETE = async (request: Request) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    try {
        await connectDatabase();
        await Avatar.deleteOne({ userId: auth.userId });

        return NextResponse.json({ success: true, data: { avatarUrl: null } });
    } catch (error) {
        console.error("Remove avatar error:", error);
        return errorResponse(500, "AVATAR_DELETE_FAILED", "Unable to remove the picture.");
    }
};