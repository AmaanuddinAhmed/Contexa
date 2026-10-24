import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { loadDashboard } from "@/server/evaluation/service";
import { errorResponse } from "@/server/http";

export const GET = async (request: Request) => {
    try {
        const admin = await requireAdmin(request);

        if ("response" in admin) {
            return admin.response;
        }

        return NextResponse.json({ success: true, data: await loadDashboard() });
    } catch (error) {
        console.error("Admin dashboard error:", error);
        return errorResponse(500, "DASHBOARD_FAILED", "Unable to load the dashboard.");
    }
};