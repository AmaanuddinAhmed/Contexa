import { NextResponse } from "next/server";
import { connectDatabase } from "@/server/db";
import { generateToken, hashPassword } from "@/server/auth";
import { errorResponse, readJsonBody } from "@/server/http";
import { User } from "@/server/models/User";
import { registerSchema } from "@/server/validation";

export const POST = async (request: Request) => {
    try {
        const result = registerSchema.safeParse(await readJsonBody(request));

        if (!result.success) {
            return errorResponse(400, "INVALID_INPUT", "Invalid registration data.");
        }

        const { email, password } = result.data;

        await connectDatabase();

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return errorResponse(
                409,
                "EMAIL_ALREADY_EXISTS",
                "An account with this email already exists."
            );
        }

        const passwordHash = await hashPassword(password);
        const user = await User.create({ email, passwordHash });
        const token = generateToken(user.id);

        return NextResponse.json(
            {
                success: true,
                data: {
                    user: { id: user.id, email: user.email, role: user.role },
                    token
                }
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Registration error:", error);
        return errorResponse(500, "REGISTRATION_FAILED", "Unable to create account.");
    }
};