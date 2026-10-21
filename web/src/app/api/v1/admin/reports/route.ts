import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { errorResponse } from "@/server/http";
import { Profile } from "@/server/models/Profile";
import { Report } from "@/server/models/Report";
import { User } from "@/server/models/User";

const MAX_LISTED = 100;

/** Reports for review: open ones first, then newest first. Admin only. */
export const GET = async (request: Request) => {
    const auth = await requireAdmin(request);

    if ("response" in auth) {
        return auth.response;
    }

    try {
        const reports = await Report.find()
            .sort({ status: 1, createdAt: -1 })
            .limit(MAX_LISTED)
            .lean();

        const ids = [...new Set(reports.flatMap((report) => [
            report.reporterId.toString(),
            report.reportedId.toString()
        ]))];

        const [profiles, users] = await Promise.all([
            Profile.find({ userId: { $in: ids } }).select({ userId: 1, name: 1 }).lean(),
            User.find({ _id: { $in: ids } }).select({ email: 1 }).lean()
        ]);
        const nameById = new Map(profiles.map((profile) => [profile.userId.toString(), profile.name]));
        const emailById = new Map(users.map((user) => [user._id.toString(), user.email]));

        const person = (id: string) => ({
            userId: id,
            name: nameById.get(id) ?? (emailById.has(id) ? "No profile" : "Deleted account"),
            email: emailById.get(id) ?? null
        });

        return NextResponse.json({
            success: true,
            data: {
                open: await Report.countDocuments({ status: "open" }),
                reports: reports.map((report) => ({
                    id: report._id.toString(),
                    reason: report.reason,
                    details: report.details ?? null,
                    status: report.status,
                    createdAt: report.createdAt,
                    reviewedAt: report.reviewedAt ?? null,
                    reporter: person(report.reporterId.toString()),
                    reported: person(report.reportedId.toString()),
                    messages: report.messages
                }))
            }
        });
    } catch (error) {
        console.error("Admin reports error:", error);
        return errorResponse(500, "REPORTS_FETCH_FAILED", "Unable to load reports.");
    }
};