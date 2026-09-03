import { Request, Response } from "express";
import { User } from "../models/User.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { generateToken } from "../utils/jwt.js";
import { loginSchema, registerSchema } from "../utils/validation.js";

import { AuthenticatedRequest } from "../middleware/auth.js";

export const register = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const result = registerSchema.safeParse(req.body);

        if (!result.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: "INVALID_INPUT",
                    message: "Invalid registration data."
                }
            });
            return;
        }

        const { email, password } = result.data;

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            res.status(409).json({
                success: false,
                error: {
                    code: "EMAIL_ALREADY_EXISTS",
                    message: "An account with this email already exists."
                }
            });
            return;
        }

        const passwordHash = await hashPassword(password);

        const user = await User.create({
            email,
            passwordHash
        });

        const token = generateToken(user.id);

        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role
                },
                token
            }
        });
    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            error: {
                code: "REGISTRATION_FAILED",
                message: "Unable to create account."
            }
        });
    }
};

export const login = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const result = loginSchema.safeParse(req.body);

        if (!result.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: "INVALID_INPUT",
                    message: "Invalid login data."
                }
            });
            return;
        }

        const { email, password } = result.data;

        const user = await User.findOne({ email });

        if (!user || !user.isActive) {
            res.status(401).json({
                success: false,
                error: {
                    code: "INVALID_CREDENTIALS",
                    message: "Invalid email or password."
                }
            });
            return;
        }

        const passwordValid = await comparePassword(
            password,
            user.passwordHash
        );

        if (!passwordValid) {
            res.status(401).json({
                success: false,
                error: {
                    code: "INVALID_CREDENTIALS",
                    message: "Invalid email or password."
                }
            });
            return;
        }

        const token = generateToken(user.id);

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role
                },
                token
            }
        });
    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            error: {
                code: "LOGIN_FAILED",
                message: "Unable to log in."
            }
        });
    }
};

export const getCurrentUser = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const user = await User.findById(req.userId).select(
            "-passwordHash"
        );

        if (!user) {
            res.status(404).json({
                success: false,
                error: {
                    code: "USER_NOT_FOUND",
                    message: "User not found."
                }
            });
            return;
        }

        res.json({
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

        res.status(500).json({
            success: false,
            error: {
                code: "USER_FETCH_FAILED",
                message: "Unable to retrieve user."
            }
        });
    }
};