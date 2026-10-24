import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { authenticate } from "@/server/auth";
import { connectDatabase } from "@/server/db";
import { errorResponse } from "@/server/http";
import { Message } from "@/server/models/Message";

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

        const groups = await Message.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
            {
                $match: {
                    recipientId: new mongoose.Types.ObjectId(auth.userId),
                    readAt: { $exists: false }
                }
            },
            { $group: { _id: "$connectionId", count: { $sum: 1 } } }
        ]);

        const byConnection: Record<string, number> = {};
        let total = 0;

        for (const group of groups) {
            byConnection[group._id.toString()] = group.count;
            total += group.count;
        }

        return NextResponse.json({ success: true, data: { total, byConnection } });
    } catch (error) {
        console.error("Unread messages error:", error);
        return errorResponse(500, "UNREAD_FETCH_FAILED", "Unable to load unread messages.");
    }
};