import { NextResponse } from "next/server";
import { requireActiveUser } from "@/server/auth";
import { connectDatabase } from "@/server/db";
import { errorResponse, readJsonBody } from "@/server/http";
import { Report } from "@/server/models/Report";
import { User } from "@/server/models/User";
import { POLICIES } from "@/server/rateLimit/rules";
import { consumeRateLimit, tooManyRequests } from "@/server/rateLimit/service";
import { checkSafetyTarget } from "@/lib/safety";
import { reportUser } from "@/server/safety/service";
import { reportSchema } from "@/server/validation";

/**
 * Reports a person and blocks them.
 * Body: { "userId": "...", "reason": "spam" | ..., "details"?: "..." }
 */
export const POST = async (request: Request) => {
    const auth = await requireActiveUser(request);

    if ("response" in auth) {
        return auth.response;
    }

    const result = reportSchema.safeParse(await readJsonBody(request));

    if (!result.success) {
        return errorResponse(400, "INVALID_REPORT", "Choose a reason (details up to 500 characters).");
    }

    const { userId, reason, details } = result.data;
    const rule = checkSafetyTarget(auth.userId, userId);

    if (!rule.ok) {
        return errorResponse(rule.status, rule.code, rule.message);
    }

    try {
        await connectDatabase();

        const limit = await consumeRateLimit(POLICIES.reportUser, auth.userId);
        if (!limit.allowed) {
            return tooManyRequests(limit.retryAfterSeconds, "reports");
        }

        if (!(await User.exists({ _id: userId }))) {
            return errorResponse(404, "USER_NOT_FOUND", "This person was not found.");
        }

        if (await Report.exists({ reporterId: auth.userId, reportedId: userId, status: "open" })) {
            return errorResponse(409, "REPORT_EXISTS", "You have already reported this person.");
        }

        await reportUser(auth.userId, userId, reason, details);

        return NextResponse.json(
            { success: true, message: "Reported and blocked." },
            { status: 201 }
        );
    } catch (error) {
        console.error("Report error:", error);
        return errorResponse(500, "REPORT_FAILED", "Unable to send the report.");
    }
};