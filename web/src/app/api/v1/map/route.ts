import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { authenticate } from "@/server/auth";
import { connectDatabase } from "@/server/db";
import { errorResponse } from "@/server/http";
import { canSeeOthers, distanceKm, isLocationVisible } from "@/lib/location";
import { Connection } from "@/server/models/Connection";
import { Profile } from "@/server/models/Profile";
import { UserLocation } from "@/server/models/UserLocation";
import { avatarUrlsFor } from "@/server/avatars/service";

/**
 * The caller's own shared area (if any) and the areas of their accepted
 * connections who share one, are not in ghost mode, and updated it within
 * MAX_LOCATION_AGE_DAYS. Visibility is mutual: a caller who is not sharing,
 * is in ghost mode, or whose area has expired gets nobody back.
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

        const [mine, connections] = await Promise.all([
            UserLocation.findOne({ userId: me }),
            Connection.find({
                $or: [{ requesterId: me }, { recipientId: me }],
                status: "accepted"
            }).select({ requesterId: 1, recipientId: 1 })
        ]);

        const connectionByUser = new Map(
            connections.map((connection) => [
                (connection.requesterId.equals(me) ? connection.recipientId : connection.requesterId).toString(),
                connection.id as string
            ])
        );
        const otherIds = [...connectionByUser.keys()];
        const now = new Date();
        const canSee = canSeeOthers(mine, now);

        const [locations, profiles, avatarById] = canSee
            ? await Promise.all([
                UserLocation.find({ userId: { $in: otherIds } }),
                Profile.find({ userId: { $in: otherIds } }).select({ userId: 1, name: 1, role: 1 }),
                avatarUrlsFor(otherIds)
            ])
            : [[], [], new Map<string, string>()];

        const profileById = new Map(profiles.map((profile) => [profile.userId.toString(), profile]));

        const people = locations
            .filter((location) => isLocationVisible(location, now))
            .map((location) => {
                const userId = location.userId.toString();
                const profile = profileById.get(userId);

                return {
                    userId,
                    connectionId: connectionByUser.get(userId)!,
                    name: profile?.name ?? "CONTEXA user",
                    role: profile?.role,
                    avatarUrl: avatarById.get(userId) ?? null,
                    lat: location.lat,
                    lng: location.lng,
                    distanceKm: mine ? distanceKm(mine, location) : null,
                    positionUpdatedAt: location.positionUpdatedAt
                };
            })
            .sort(
                (first, second) =>
                    (first.distanceKm ?? Infinity) - (second.distanceKm ?? Infinity) ||
                    first.name.localeCompare(second.name)
            );

        return NextResponse.json({
            success: true,
            data: {
                me: mine
                    ? {
                        lat: mine.lat,
                        lng: mine.lng,
                        ghost: mine.ghost,
                        positionUpdatedAt: mine.positionUpdatedAt
                    }
                    : null,
                people,
                canSee,
                connections: otherIds.length
            }
        });
    } catch (error) {
        console.error("Load map error:", error);
        return errorResponse(500, "MAP_FETCH_FAILED", "Unable to load the map.");
    }
};