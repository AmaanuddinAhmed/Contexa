import { NextResponse } from "next/server";
import { connectDatabase } from "@/server/db";
import { authenticate } from "@/server/auth";
import { errorResponse } from "@/server/http";
import {
    DEFAULT_RECOMMENDATION_MODE,
    isRecommendationMode,
    RECOMMENDATION_MODES
} from "@/server/recommendations/modes";
import { getRecommendations } from "@/server/recommendations/service";

const KNOWN_ERRORS: Record<string, [number, string]> = {
    INVALID_USER_ID: [400, "Invalid user identifier."],
    PROFILE_NOT_FOUND: [404, "Create your profile before requesting recommendations."],
    ACTIVE_CONTEXT_NOT_FOUND: [404, "Create an active context before requesting recommendations."],
    RECOMMENDATION_SERVICE_UNAVAILABLE: [
        503,
        "The recommendation engine is not available. Please try again shortly."
    ]
};

export const GET = async (request: Request) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    const params = new URL(request.url).searchParams;

    const rawLimits = params.getAll("limit");

    if (rawLimits.length > 1) {
        return errorResponse(400, "INVALID_LIMIT", "Limit must be a single integer value.");
    }

    const limit = rawLimits.length === 0 ? undefined : Number(rawLimits[0]);

    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
        return errorResponse(400, "INVALID_LIMIT", "Limit must be a positive integer.");
    }

    const rawModes = params.getAll("mode");

    if (rawModes.length > 1) {
        return errorResponse(400, "INVALID_MODE", "Mode must be a single value.");
    }

    const mode =
        rawModes.length === 0
            ? DEFAULT_RECOMMENDATION_MODE
            : rawModes[0].trim().toUpperCase();

    if (!isRecommendationMode(mode)) {
        return errorResponse(
            400,
            "INVALID_MODE",
            `Mode must be one of: ${RECOMMENDATION_MODES.join(", ")}.`
        );
    }

    try {
        await connectDatabase();

        const result = await getRecommendations(auth.userId, limit, mode);

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        const known = error instanceof Error ? KNOWN_ERRORS[error.message] : undefined;

        if (known && error instanceof Error) {
            return errorResponse(known[0], error.message, known[1]);
        }

        console.error("Get recommendations error:", error);
        return errorResponse(
            500,
            "RECOMMENDATIONS_FETCH_FAILED",
            "Unable to generate recommendations."
        );
    }
};