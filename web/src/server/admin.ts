import "server-only";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { authenticate } from "./auth";
import { connectDatabase } from "./db";
import { errorResponse } from "./http";
import { User } from "./models/User";

export const requireAdmin = async (
    request: Request
): Promise<{ userId: string } | { response: NextResponse }> => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth;
    }

    if (!mongoose.Types.ObjectId.isValid(auth.userId)) {
        return { response: errorResponse(403, "FORBIDDEN", "Admin access only.") };
    }

    await connectDatabase();

    const isAdmin = await User.exists({ _id: auth.userId, role: "admin", isActive: true });

    if (!isAdmin) {
        return { response: errorResponse(403, "FORBIDDEN", "Admin access only.") };
    }

    return auth;
};