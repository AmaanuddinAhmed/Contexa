import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { authenticate } from "@/server/auth";
import { connectDatabase } from "@/server/db";
import { errorResponse } from "@/server/http";
import { Avatar } from "@/server/models/Avatar";

interface RouteContext {
    params: Promise<{ userId: string }>;
}

export const GET = async (request: Request, { params }: RouteContext) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    const { userId } = await params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return errorResponse(404, "AVATAR_NOT_FOUND", "No picture.");
    }

    try {
        await connectDatabase();

        const avatar = await Avatar.findOne({ userId }).select({ data: 1, contentType: 1 });

        if (!avatar) {
            return errorResponse(404, "AVATAR_NOT_FOUND", "No picture.");
        }

        const versioned = new URL(request.url).searchParams.has("v");

        return new NextResponse(Uint8Array.from(avatar.data), {
            headers: {
                "Content-Type": avatar.contentType,
                "Cache-Control": versioned
                    ? "private, max-age=31536000, immutable"
                    : "private, no-cache"
            }
        });
    } catch (error) {
        console.error("Get avatar error:", error);
        return errorResponse(500, "AVATAR_FETCH_FAILED", "Unable to load the picture.");
    }
};