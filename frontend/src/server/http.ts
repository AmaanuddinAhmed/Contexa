import "server-only";
import { NextResponse } from "next/server";

export const errorResponse = (
    status: number,
    code: string,
    message: string
): NextResponse =>
    NextResponse.json(
        {
            success: false,
            error: { code, message }
        },
        { status }
    );

/** Parses a JSON body; returns undefined when the body is missing or malformed. */
export const readJsonBody = async (request: Request): Promise<unknown> => {
    try {
        return await request.json();
    } catch {
        return undefined;
    }
};