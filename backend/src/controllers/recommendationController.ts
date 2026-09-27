import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import {
    getRecommendations
} from "../services/recommendationService.js";

export const getRecommendationList = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.userId) {
            res.status(401).json({
                success: false,
                error: {
                    code: "UNAUTHORIZED",
                    message: "Authentication required."
                }
            });
            return;
        }

        const rawLimit = req.query.limit;

        if (
            rawLimit !== undefined &&
            typeof rawLimit !== "string"
        ) {
            res.status(400).json({
                success: false,
                error: {
                    code: "INVALID_LIMIT",
                    message: "Limit must be a single integer value."
                }
            });
            return;
        }

        const limit = rawLimit === undefined
            ? undefined
            : Number(rawLimit);

        if (
            limit !== undefined &&
            (!Number.isInteger(limit) || limit < 1)
        ) {
            res.status(400).json({
                success: false,
                error: {
                    code: "INVALID_LIMIT",
                    message: "Limit must be a positive integer."
                }
            });
            return;
        }

        const result = await getRecommendations(
            req.userId,
            limit
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "INVALID_USER_ID"
        ) {
            res.status(400).json({
                success: false,
                error: {
                    code: "INVALID_USER_ID",
                    message: "Invalid user identifier."
                }
            });
            return;
        }

        if (
            error instanceof Error &&
            error.message === "PROFILE_NOT_FOUND"
        ) {
            res.status(404).json({
                success: false,
                error: {
                    code: "PROFILE_NOT_FOUND",
                    message:
                        "Create your profile before requesting recommendations."
                }
            });
            return;
        }

        if (
            error instanceof Error &&
            error.message === "ACTIVE_CONTEXT_NOT_FOUND"
        ) {
            res.status(404).json({
                success: false,
                error: {
                    code: "ACTIVE_CONTEXT_NOT_FOUND",
                    message:
                        "Create an active context before requesting recommendations."
                }
            });
            return;
        }

        console.error(
            "Get recommendations error:",
            error
        );

        res.status(500).json({
            success: false,
            error: {
                code: "RECOMMENDATIONS_FETCH_FAILED",
                message:
                    "Unable to generate recommendations."
            }
        });
    }
};