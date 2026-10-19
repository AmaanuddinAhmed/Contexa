import "server-only";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { errorResponse } from "./http";
import { extractToken, SESSION_COOKIE, sessionCookieOptions } from "./session";

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
    const token = extractToken(request.headers);

    if (!token) {
        return {
            response: errorResponse(401, "UNAUTHORIZED", "Authentication required.")
        };
    }

    try {
        const payload = verifyToken(token);
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


const isProduction = (): boolean => process.env.NODE_ENV === "production";

/** Puts a new login token in the httpOnly session cookie. */
export const setSessionCookie = (response: NextResponse, userId: string): NextResponse => {
    response.cookies.set(SESSION_COOKIE, generateToken(userId), sessionCookieOptions(isProduction()));
    return response;
};

/** Deletes the session cookie (same attributes, expired). */
export const clearSessionCookie = (response: NextResponse): NextResponse => {
    response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(isProduction(), 0));
    return response;
};