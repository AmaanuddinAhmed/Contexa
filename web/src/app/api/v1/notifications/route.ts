import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { authenticate } from "@/server/auth";
import { connectDatabase } from "@/server/db";
import { errorResponse } from "@/server/http";
import { Connection } from "@/server/models/Connection";
import { Message } from "@/server/models/Message";
import { toConnectionsVersion } from "@/server/notifications/version";

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

        const me = new mongoose.Types.ObjectId(auth.userId);
        const mine = { $or: [{ requesterId: me }, { recipientId: me }] };

        const [messages, requests, connectionCount, latest] = await Promise.all([
            Message.countDocuments({ recipientId: me, readAt: { $exists: false } }),
            Connection.countDocuments({ recipientId: me, status: "pending" }),
            Connection.countDocuments(mine),
            Connection.findOne(mine).sort({ updatedAt: -1 }).select({ updatedAt: 1 }).lean()
        ]);

        return NextResponse.json({
            success: true,
            data: {
                messages,
                requests,
                connectionsVersion: toConnectionsVersion(connectionCount, latest?.updatedAt)
            }
        });
    } catch (error) {
        console.error("Notifications error:", error);
        return errorResponse(500, "NOTIFICATIONS_FETCH_FAILED", "Unable to load notifications.");
    }
};