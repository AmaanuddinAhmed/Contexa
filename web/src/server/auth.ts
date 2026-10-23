import "server-only";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDatabase } from "./db";
import { errorResponse } from "./http";
import { User } from "./models/User";
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


/**
 * Like `authenticate`, but also checks that the account still exists and is
 * active. Used by routes that create or change data, so a token kept from a
 * deleted account cannot recreate data under that account.
 */
export const requireActiveUser = async (
    request: Request
): Promise<{ userId: string } | { response: NextResponse }> => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth;
    }

    const unavailable = () => ({
        response: clearSessionCookie(
            errorResponse(401, "ACCOUNT_UNAVAILABLE", "This account no longer exists.")
        )
    });

    if (!mongoose.Types.ObjectId.isValid(auth.userId)) {
        return unavailable();
    }

    await connectDatabase();

    if (!(await User.exists({ _id: auth.userId, isActive: true }))) {
        return unavailable();
    }

    return auth;
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