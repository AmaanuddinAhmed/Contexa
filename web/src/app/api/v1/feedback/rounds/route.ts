import { NextResponse } from "next/server";
import { requireActiveUser } from "@/server/auth";
import { connectDatabase } from "@/server/db";
import { FEEDBACK_ERRORS } from "@/server/feedback/errors";
import { startOrResumeRound } from "@/server/feedback/service";
import { errorResponse } from "@/server/http";

/** Starts a blind rating round for the user's current context, or resumes it. */
export const POST = async (request: Request) => {
    const auth = await requireActiveUser(request);

    if ("response" in auth) {
        return auth.response;
    }

    try {
        await connectDatabase();

        const round = await startOrResumeRound(auth.userId);

        return NextResponse.json({ success: true, data: { round } });
    } catch (error) {
        const known = error instanceof Error ? FEEDBACK_ERRORS[error.message] : undefined;

        if (known && error instanceof Error) {
            return errorResponse(known[0], error.message, known[1]);
        }

        console.error("Start feedback round error:", error);
        return errorResponse(500, "FEEDBACK_ROUND_FAILED", "Unable to start rating.");
    }
};