import { NextResponse } from "next/server";
import { requireActiveUser } from "@/server/auth";
import { connectDatabase } from "@/server/db";
import { FEEDBACK_ERRORS } from "@/server/feedback/errors";
import { submitRatings } from "@/server/feedback/service";
import { errorResponse, readJsonBody } from "@/server/http";
import { feedbackRatingsSchema } from "@/server/validation";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const POST = async (request: Request, { params }: RouteContext) => {
    const auth = await requireActiveUser(request);

    if ("response" in auth) {
        return auth.response;
    }

    const result = feedbackRatingsSchema.safeParse(await readJsonBody(request));

    if (!result.success) {
        return errorResponse(400, "INVALID_RATINGS", "Ratings must be whole numbers from 1 to 5.");
    }

    const { id } = await params;

    try {
        await connectDatabase();

        await submitRatings(auth.userId, id, result.data.ratings);

        return NextResponse.json({ success: true, message: "Thank you for your ratings." });
    } catch (error) {
        const known = error instanceof Error ? FEEDBACK_ERRORS[error.message] : undefined;

        if (known && error instanceof Error) {
            return errorResponse(known[0], error.message, known[1]);
        }

        console.error("Submit ratings error:", error);
        return errorResponse(500, "RATINGS_SUBMIT_FAILED", "Unable to save ratings.");
    }
};