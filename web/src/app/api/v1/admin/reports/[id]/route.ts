import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { errorResponse, readJsonBody } from "@/server/http";
import { Report } from "@/server/models/Report";
import { reportReviewSchema } from "@/server/validation";

/** Marks a report as reviewed. Body: { "status": "reviewed" }. Admin only. */
export const PATCH = async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) => {
    const auth = await requireAdmin(request);

    if ("response" in auth) {
        return auth.response;
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(404, "REPORT_NOT_FOUND", "Report not found.");
    }

    if (!reportReviewSchema.safeParse(await readJsonBody(request)).success) {
        return errorResponse(400, "INVALID_STATUS", "Status must be reviewed.");
    }

    try {
        const report = await Report.findOneAndUpdate(
            { _id: id },
            { $set: { status: "reviewed", reviewedAt: new Date() } },
            { new: true }
        );

        if (!report) {
            return errorResponse(404, "REPORT_NOT_FOUND", "Report not found.");
        }

        return NextResponse.json({ success: true, data: { id, status: report.status } });
    } catch (error) {
        console.error("Review report error:", error);
        return errorResponse(500, "REPORT_UPDATE_FAILED", "Unable to update the report.");
    }
};