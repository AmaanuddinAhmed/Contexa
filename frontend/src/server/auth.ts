import "server-only";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { errorResponse } from "./http";

const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not defined.");
    }

    return secret;
};

interface JwtPayload {
    userId: string;
}

export const generateToken = (userId: string): string =>
    jwt.sign({ userId }, getJwtSecret(), { expiresIn: "7d" });

const verifyToken = (token: string): JwtPayload =>
    jwt.verify(token, getJwtSecret()) as JwtPayload;

export const hashPassword = (password: string): Promise<string> =>
    bcrypt.hash(password, 12);

export const comparePassword = (
    password: string,
    passwordHash: string
): Promise<boolean> => bcrypt.compare(password, passwordHash);

/**
 * Replaces the Express `authenticate` middleware. Returns the user id, or a
 * 401 response the route handler should return as-is.
 */
export const authenticate = (
    request: Request
): { userId: string } | { response: NextResponse } => {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
        return {
            response: errorResponse(401, "UNAUTHORIZED", "Authentication required.")
        };
    }

    try {
        const payload = verifyToken(authorization.substring(7));
        return { userId: payload.userId };
    } catch {
        return {
            response: errorResponse(
                401,
                "INVALID_TOKEN",
                "Invalid or expired authentication token."
            )
        };
    }
};