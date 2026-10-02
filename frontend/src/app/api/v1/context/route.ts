import { NextResponse } from "next/server";
import { connectDatabase } from "@/server/db";
import { authenticate } from "@/server/auth";
import { errorResponse, readJsonBody } from "@/server/http";
import { Context } from "@/server/models/Context";
import { toMatchTerms } from "@/server/recommendations/terms";
import { contextSchema } from "@/server/validation";

export const GET = async (request: Request) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    try {
        await connectDatabase();

        const context = await Context.findOne({
            userId: auth.userId,
            isActive: true
        }).sort({ createdAt: -1 });

        return NextResponse.json({ success: true, data: { context } });
    } catch (error) {
        console.error("Get context error:", error);
        return errorResponse(500, "CONTEXT_FETCH_FAILED", "Unable to retrieve context.");
    }
};

export const POST = async (request: Request) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    try {
        const result = contextSchema.safeParse(await readJsonBody(request));

        if (!result.success) {
            return errorResponse(400, "INVALID_CONTEXT", "Invalid context data.");
        }

        await connectDatabase();

        // Deactivate the user's previous active context.
        await Context.updateMany(
            { userId: auth.userId, isActive: true },
            { $set: { isActive: false } }
        );

        const context = await Context.create({
            ...result.data,
            needTerms: toMatchTerms(result.data.need),
            userId: auth.userId,
            validUntil: result.data.validUntil
                ? new Date(result.data.validUntil)
                : undefined
        });

        return NextResponse.json({ success: true, data: { context } }, { status: 201 });
    } catch (error) {
        console.error("Create context error:", error);
        return errorResponse(500, "CONTEXT_CREATE_FAILED", "Unable to create context.");
    }
};

export const DELETE = async (request: Request) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    try {
        await connectDatabase();

        await Context.updateMany(
            { userId: auth.userId, isActive: true },
            { $set: { isActive: false } }
        );

        return NextResponse.json({
            success: true,
            message: "Active context deactivated."
        });
    } catch (error) {
        console.error("Deactivate context error:", error);
        return errorResponse(
            500,
            "CONTEXT_DEACTIVATION_FAILED",
            "Unable to deactivate context."
        );
    }
};