import { NextResponse } from "next/server";
import { connectDatabase } from "@/server/db";
import { errorResponse } from "@/server/http";
import { clientIp, POLICIES } from "@/server/rateLimit/rules";
import { consumeRateLimit, tooManyRequests } from "@/server/rateLimit/service";
import { pingRecommendationService } from "@/server/recommendations/warm";

export const dynamic = "force-dynamic";
// Waking the free-tier service can take about a minute.
export const maxDuration = 60;

/**
 * Wakes the recommendation service and says how long it took. Needs no
 * login (the home and login pages call it too) and returns nothing private.
 */
export const POST = async (request: Request) => {
    try {
        await connectDatabase();

        const limit = await consumeRateLimit(POLICIES.warmIp, clientIp(request.headers));
        if (!limit.allowed) {
            return tooManyRequests(limit.retryAfterSeconds, "wake-up requests");
        }
    } catch (error) {
        console.error("Warm rate limit error:", error);
        return errorResponse(500, "WARM_FAILED", "Unable to check the recommendation service.");
    }

    const status = await pingRecommendationService();

    return NextResponse.json({ success: true, data: status });
};