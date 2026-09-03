import jwt from "jsonwebtoken";

const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not defined.");
    }

    return secret;
};

export interface JwtPayload {
    userId: string;
}

export const generateToken = (userId: string): string => {
    return jwt.sign(
        { userId },
        getJwtSecret(),
        { expiresIn: "7d" }
    );
};

export const verifyToken = (token: string): JwtPayload => {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
};