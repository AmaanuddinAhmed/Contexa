import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { authenticate } from "@/server/auth";
import { checkRemove, checkRespond } from "@/server/connections/rules";
import { connectDatabase } from "@/server/db";
import { errorResponse, readJsonBody } from "@/server/http";
import { Connection, toRuleState } from "@/server/models/Connection";
import { Message } from "@/server/models/Message";
import { connectionActionSchema } from "@/server/validation";

interface RouteContext {
    params: Promise<{ id: string }>;
}

const notFound = () =>
    errorResponse(404, "CONNECTION_NOT_FOUND", "Connection request not found.");

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

        const deleted = await Connection.deleteOne({
            _id: connection._id,
            status: connection.status
        });

        if (deleted.deletedCount === 0) {
            return errorResponse(409, "CONNECTION_CHANGED", "Please refresh and try again.");
        }

        if (connection.status === "accepted") {
            await Message.deleteMany({ connectionId: connection._id });
        }

        return NextResponse.json({ success: true, message: "Connection removed." });
    } catch (error) {
        console.error("Remove connection error:", error);
        return errorResponse(500, "CONNECTION_DELETE_FAILED", "Unable to remove connection.");
    }
};