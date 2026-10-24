import { NextResponse } from "next/server";
import { authenticate, requireActiveUser } from "@/server/auth";
import { connectDatabase } from "@/server/db";
import { errorResponse, readJsonBody } from "@/server/http";
import { snapToGrid } from "@/lib/location";
import { UserLocation } from "@/server/models/UserLocation";
import { ghostModeSchema, locationSchema } from "@/server/validation";

const toView = (location: { lat: number; lng: number; ghost: boolean; positionUpdatedAt: Date }) => ({
    lat: location.lat,
    lng: location.lng,
    ghost: location.ghost,
    positionUpdatedAt: location.positionUpdatedAt
});

export const PUT = async (request: Request) => {
    const auth = await requireActiveUser(request);

    if ("response" in auth) {
        return auth.response;
    }

    const result = locationSchema.safeParse(await readJsonBody(request));

    if (!result.success) {
        return errorResponse(400, "INVALID_LOCATION", "Latitude and longitude are required.");
    }

    try {
        await connectDatabase();

        const { lat, lng } = snapToGrid(result.data);
        const location = await UserLocation.findOneAndUpdate(
            { userId: auth.userId },
            {
                $set: { lat, lng, positionUpdatedAt: new Date() },
                $setOnInsert: { ghost: false }
            },
            { upsert: true, returnDocument: "after", runValidators: true }
        );

        return NextResponse.json({ success: true, data: { me: toView(location!) } });
    } catch (error) {
        console.error("Share location error:", error);
        return errorResponse(500, "LOCATION_SAVE_FAILED", "Unable to save your location.");
    }
};

export const PATCH = async (request: Request) => {
    const auth = await requireActiveUser(request);

    if ("response" in auth) {
        return auth.response;
    }

    const result = ghostModeSchema.safeParse(await readJsonBody(request));

    if (!result.success) {
        return errorResponse(400, "INVALID_GHOST_MODE", "Ghost mode must be true or false.");
    }

    try {
        await connectDatabase();

        const location = await UserLocation.findOneAndUpdate(
            { userId: auth.userId },
            { $set: { ghost: result.data.ghost } },
            { returnDocument: "after" }
        );

        if (!location) {
            return errorResponse(404, "LOCATION_NOT_SHARED", "Share your location first.");
        }

        return NextResponse.json({ success: true, data: { me: toView(location) } });
    } catch (error) {
        console.error("Ghost mode error:", error);
        return errorResponse(500, "LOCATION_SAVE_FAILED", "Unable to update ghost mode.");
    }
};

export const DELETE = async (request: Request) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    try {
        await connectDatabase();
        await UserLocation.deleteOne({ userId: auth.userId });

        return NextResponse.json({ success: true, message: "Location removed." });
    } catch (error) {
        console.error("Remove location error:", error);
        return errorResponse(500, "LOCATION_DELETE_FAILED", "Unable to remove your location.");
    }
};