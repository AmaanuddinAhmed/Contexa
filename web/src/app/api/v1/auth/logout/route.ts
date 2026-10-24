import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth";

export const POST = async () =>
    clearSessionCookie(NextResponse.json({ success: true }));