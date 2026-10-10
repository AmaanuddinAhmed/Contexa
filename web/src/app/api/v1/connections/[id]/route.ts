import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { authenticate } from "@/server/auth";
import { checkRemove, checkRespond } from "@/server/connections/rules";
import { connectDatabase } from "@/server/db";
import { errorResponse, readJsonBody } from "@/server/http";
import { Connection, toRuleState } from "@/server/models/Connection";
import { connectionActionSchema } from "@/server/validation";

interface RouteContext {
    params: Promise<{ id: string }>;
}

const notFound = () =>
    errorResponse(404, "CONNECTION_NOT_FOUND", "Connection request not found.");

/** Accepts or declines a request. Body: { "action": "accept" | "decline" } */
export const PATCH = async (request: Request, { params }: RouteContext) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return notFound();
    }

    const result = connectionActionSchema.safeParse(await readJsonBody(request));

    if (!result.success) {
        return errorResponse(400, "INVALID_ACTION", "Action must be accept or decline.");
    }

    try {
        await connectDatabase();

        const connection = await Connection.findById(id);

        if (!connection) {
            return notFound();
        }

        const rule = checkRespond(toRuleState(connection), auth.userId);

        if (!rule.ok) {
            return errorResponse(rule.status, rule.code, rule.message);
        }

        // Conditional update: answers only a request that is still pending.
        const updated = await Connection.findOneAndUpdate(
            { _id: connection._id, recipientId: auth.userId, status: "pending" },
            {
                $set: {
                    status: result.data.action === "accept" ? "accepted" : "declined",
                    respondedAt: new Date()
                }
            },
            { new: true }
        );

        if (!updated) {
            return errorResponse(409, "NOT_PENDING", "This request has already been answered.");
        }

        return NextResponse.json({ success: true, data: { connection: updated } });
    } catch (error) {
        console.error("Respond to connection error:", error);
        return errorResponse(500, "CONNECTION_UPDATE_FAILED", "Unable to update request.");
    }
};

/** Cancels a pending request (requester) or removes a connection (either person). */
export const DELETE = async (request: Request, { params }: RouteContext) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return notFound();
    }

    try {
        await connectDatabase();

        const connection = await Connection.findById(id);

        if (!connection) {
            return notFound();
        }

        const rule = checkRemove(toRuleState(connection), auth.userId);

        if (!rule.ok) {
            return errorResponse(rule.status, rule.code, rule.message);
        }

        // Only delete the record in the state the rule was checked against.
        const deleted = await Connection.deleteOne({
            _id: connection._id,
            status: connection.status
        });

        if (deleted.deletedCount === 0) {
            return errorResponse(409, "CONNECTION_CHANGED", "Please refresh and try again.");
        }

        return NextResponse.json({ success: true, message: "Connection removed." });
    } catch (error) {
        console.error("Remove connection error:", error);
        return errorResponse(500, "CONNECTION_DELETE_FAILED", "Unable to remove connection.");
    }
};