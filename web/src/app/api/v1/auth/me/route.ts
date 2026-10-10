import { NextResponse } from "next/server";
import { connectDatabase } from "@/server/db";
import { authenticate } from "@/server/auth";
import { errorResponse } from "@/server/http";
import { User } from "@/server/models/User";

export const GET = async (request: Request) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    try {
        await connectDatabase();

        const user = await User.findById(auth.userId).select("-passwordHash");

        if (!user) {
            return errorResponse(404, "USER_NOT_FOUND", "User not found.");
        }

        return NextResponse.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    isActive: user.isActive
                }
            }
        });
    } catch (error) {
        console.error("Get current user error:", error);
        return errorResponse(500, "USER_FETCH_FAILED", "Unable to retrieve user.");
    }
};