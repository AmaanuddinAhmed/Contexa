import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth";

/**
 * Logs out by deleting the httpOnly session cookie (page scripts cannot
 * delete it themselves). Needs no login, so logging out always succeeds.
 */
export const POST = async () =>
    clearSessionCookie(NextResponse.json({ success: true }));