import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { authenticate } from "@/server/auth";
import { checkNewRequest, toPairKey } from "@/server/connections/rules";
import { connectDatabase } from "@/server/db";
import { errorResponse, readJsonBody } from "@/server/http";
import { Connection, IConnection, toRuleState } from "@/server/models/Connection";
import { Profile } from "@/server/models/Profile";
import { User } from "@/server/models/User";
import { connectionRequestSchema } from "@/server/validation";
import { avatarUrlsFor } from "@/server/avatars/service";

// Upper bound on records returned by one listing.
const MAX_LISTED = 200;

/**
 * Lists the user's pending requests (both directions) and accepted
 * connections, each with the other person's public profile summary.
 * Declined requests are not shown to either person.
 */
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

        const connections = await Connection.find({
            $or: [{ requesterId: me }, { recipientId: me }],
            status: { $in: ["pending", "accepted"] }
        })
            .sort({ updatedAt: -1 })
            .limit(MAX_LISTED);

        const otherIds = connections.map((connection) =>
            connection.requesterId.equals(me) ? connection.recipientId : connection.requesterId
        );

        const profiles = await Profile.find({ userId: { $in: otherIds } }).select({
            userId: 1,
            name: 1,
            role: 1,
            education: 1,
            experienceLevel: 1,
            skills: 1,
            interests: 1,
            isSample: 1
        });

        const profileById = new Map(
            profiles.map((profile) => [profile.userId.toString(), profile])
        );

        const avatarById = await avatarUrlsFor(otherIds);

        const items = connections.map((connection, index) => {
            const otherId = otherIds[index].toString();
            const profile = profileById.get(otherId);

            return {
                id: connection.id as string,
                status: connection.status,
                direction: connection.requesterId.equals(me) ? "outgoing" : "incoming",
                message: connection.message,
                createdAt: connection.createdAt,
                respondedAt: connection.respondedAt,
                user: {
                    userId: otherId,
                    name: profile?.name ?? "CONTEXA user",
                    role: profile?.role,
                    education: profile?.education,
                    experienceLevel: profile?.experienceLevel,
                    skills: profile?.skills ?? [],
                    interests: profile?.interests ?? [],
                    isSample: profile?.isSample === true,
                    avatarUrl: avatarById.get(otherId) ?? null
                }
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                incoming: items.filter(
                    (item) => item.status === "pending" && item.direction === "incoming"
                ),
                outgoing: items.filter(
                    (item) => item.status === "pending" && item.direction === "outgoing"
                ),
                connections: items.filter((item) => item.status === "accepted")
            }
        });
    } catch (error) {
        console.error("List connections error:", error);
        return errorResponse(500, "CONNECTIONS_FETCH_FAILED", "Unable to load connections.");
    }
};

/** Sends a connection request. */
export const POST = async (request: Request) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    const result = connectionRequestSchema.safeParse(await readJsonBody(request));

    if (!result.success) {
        return errorResponse(400, "INVALID_CONNECTION_REQUEST", "Invalid connection request.");
    }

    const { recipientId, message, source } = result.data;

    // Checked before touching the database.
    const selfCheck = checkNewRequest(auth.userId, recipientId, null);

    if (!selfCheck.ok) {
        return errorResponse(selfCheck.status, selfCheck.code, selfCheck.message);
    }

    try {
        await connectDatabase();

        const [requesterProfile, recipientUser, recipientProfile] = await Promise.all([
            Profile.exists({ userId: auth.userId }),
            User.exists({ _id: recipientId, isActive: true }),
            Profile.exists({ userId: recipientId, visibility: "public" })
        ]);

        // The recipient sees the requester's name, so a profile is required.
        if (!requesterProfile) {
            return errorResponse(
                400,
                "PROFILE_REQUIRED",
                "Create your profile before sending connection requests."
            );
        }

        if (!recipientUser || !recipientProfile) {
            return errorResponse(404, "RECIPIENT_NOT_FOUND", "This person is not available.");
        }

        const pairKey = toPairKey(auth.userId, recipientId);
        const existing = await Connection.findOne({ pairKey });

        const rule = checkNewRequest(
            auth.userId,
            recipientId,
            existing ? toRuleState(existing) : null
        );

        if (!rule.ok) {
            return errorResponse(rule.status, rule.code, rule.message);
        }

        const fields = {
            requesterId: auth.userId,
            recipientId,
            status: "pending" as const,
            message: message || undefined,
            source
        };

        let connection: IConnection | null;

        if (existing) {
            // Reuse the declined record. The status condition makes this a
            // no-op if someone else changed the record in the meantime.
            connection = await Connection.findOneAndUpdate(
                { _id: existing._id, status: "declined" },
                {
                    $set: fields,
                    $unset: {
                        respondedAt: 1,
                        ...(message ? {} : { message: 1 }),
                        ...(source ? {} : { source: 1 })
                    }
                },
                { new: true, runValidators: true }
            );
        } else {
            connection = await Connection.create({ ...fields, pairKey });
        }

        if (!connection) {
            return errorResponse(409, "CONNECTION_CHANGED", "Please refresh and try again.");
        }

        return NextResponse.json({ success: true, data: { connection } }, { status: 201 });
    } catch (error) {
        // Unique pairKey index: two requests for the same pair at once.
        if ((error as { code?: number }).code === 11000) {
            return errorResponse(409, "CONNECTION_CHANGED", "Please refresh and try again.");
        }

        console.error("Create connection error:", error);
        return errorResponse(500, "CONNECTION_CREATE_FAILED", "Unable to send request.");
    }
};