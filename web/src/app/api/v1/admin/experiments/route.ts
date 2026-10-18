import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { listExperiments } from "@/server/evaluation/service";
import { errorResponse } from "@/server/http";

/** Synthetic experiment runs (scripts/run-experiment.ts), newest first. */
export const GET = async (request: Request) => {
    try {
        const admin = await requireAdmin(request);

        if ("response" in admin) {
            return admin.response;
        }

        return NextResponse.json({ success: true, data: { experiments: await listExperiments() } });
    } catch (error) {
        console.error("List experiments error:", error);
        return errorResponse(500, "EXPERIMENTS_FETCH_FAILED", "Unable to load experiments.");
    }
};