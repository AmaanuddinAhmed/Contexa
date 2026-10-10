import { NextResponse } from "next/server";
import { connectDatabase } from "@/server/db";
import { authenticate } from "@/server/auth";
import { errorResponse, readJsonBody } from "@/server/http";
import { Profile } from "@/server/models/Profile";
import { toMatchTerms } from "@/server/recommendations/terms";
import { profileSchema } from "@/server/validation";

export const GET = async (request: Request) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    try {
        await connectDatabase();

        const profile = await Profile.findOne({ userId: auth.userId });

        return NextResponse.json({ success: true, data: { profile } });
    } catch (error) {
        console.error("Get profile error:", error);
        return errorResponse(500, "PROFILE_FETCH_FAILED", "Unable to retrieve profile.");
    }
};

export const PUT = async (request: Request) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    try {
        const result = profileSchema.safeParse(await readJsonBody(request));

        if (!result.success) {
            return errorResponse(400, "INVALID_PROFILE", "Invalid profile data.");
        }

        await connectDatabase();

        const profile = await Profile.findOneAndUpdate(
            { userId: auth.userId },
            {
                ...result.data,
                matchTerms: toMatchTerms([
                    ...result.data.skills,
                    ...result.data.interests
                ]),
                userId: auth.userId
            },
            { new: true, upsert: true, runValidators: true }
        );

        return NextResponse.json({ success: true, data: { profile } });
    } catch (error) {
        console.error("Update profile error:", error);
        return errorResponse(500, "PROFILE_UPDATE_FAILED", "Unable to update profile.");
    }
};