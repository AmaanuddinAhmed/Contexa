import { NextResponse } from "next/server";
import { connectDatabase } from "@/server/db";
import { comparePassword, generateToken } from "@/server/auth";
import { errorResponse, readJsonBody } from "@/server/http";
import { User } from "@/server/models/User";
import { loginSchema } from "@/server/validation";

export const POST = async (request: Request) => {
    try {
        const result = loginSchema.safeParse(await readJsonBody(request));

        if (!result.success) {
            return errorResponse(400, "INVALID_INPUT", "Invalid login data.");
        }

        const { email, password } = result.data;

        await connectDatabase();

        const user = await User.findOne({ email });

        if (!user || !user.isActive) {
            return errorResponse(401, "INVALID_CREDENTIALS", "Invalid email or password.");
        }

        const passwordValid = await comparePassword(password, user.passwordHash);

        if (!passwordValid) {
            return errorResponse(401, "INVALID_CREDENTIALS", "Invalid email or password.");
        }

        const token = generateToken(user.id);

        return NextResponse.json({
            success: true,
            data: {
                user: { id: user.id, email: user.email, role: user.role },
                token
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        return errorResponse(500, "LOGIN_FAILED", "Unable to log in.");
    }
};