import { requireAdmin } from "@/server/admin";
import { exportFeedbackCsv } from "@/server/evaluation/service";
import { errorResponse } from "@/server/http";

/** Completed feedback ratings as a CSV download. */
export const GET = async (request: Request) => {
    try {
        const admin = await requireAdmin(request);

        if ("response" in admin) {
            return admin.response;
        }

        const date = new Date().toISOString().slice(0, 10);

        return new Response(await exportFeedbackCsv(), {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="contexa-feedback-${date}.csv"`,
                "Cache-Control": "no-store"
            }
        });
    } catch (error) {
        console.error("Export feedback error:", error);
        return errorResponse(500, "EXPORT_FAILED", "Unable to export feedback.");
    }
};