import { Response } from "express";
import { Context } from "../models/Context.js";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { contextSchema } from "../utils/validation.js";

export const getActiveContext = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const context = await Context.findOne({
            userId: req.userId,
            isActive: true
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            data: {
                context
            }
        });
    } catch (error) {
        console.error("Get context error:", error);

        res.status(500).json({
            success: false,
            error: {
                code: "CONTEXT_FETCH_FAILED",
                message: "Unable to retrieve context."
            }
        });
    }
};

export const createContext = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const result = contextSchema.safeParse(req.body);

        if (!result.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: "INVALID_CONTEXT",
                    message: "Invalid context data."
                }
            });
            return;
        }

        // Deactivate the user's previous active context.
        await Context.updateMany(
            {
                userId: req.userId,
                isActive: true
            },
            {
                $set: {
                    isActive: false
                }
            }
        );

        const context = await Context.create({
            ...result.data,
            userId: req.userId,
            validUntil: result.data.validUntil
                ? new Date(result.data.validUntil)
                : undefined
        });

        res.status(201).json({
            success: true,
            data: {
                context
            }
        });
    } catch (error) {
        console.error("Create context error:", error);

        res.status(500).json({
            success: false,
            error: {
                code: "CONTEXT_CREATE_FAILED",
                message: "Unable to create context."
            }
        });
    }
};

export const deactivateContext = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        await Context.updateMany(
            {
                userId: req.userId,
                isActive: true
            },
            {
                $set: {
                    isActive: false
                }
            }
        );

        res.json({
            success: true,
            message: "Active context deactivated."
        });
    } catch (error) {
        console.error("Deactivate context error:", error);

        res.status(500).json({
            success: false,
            error: {
                code: "CONTEXT_DEACTIVATION_FAILED",
                message: "Unable to deactivate context."
            }
        });
    }
};