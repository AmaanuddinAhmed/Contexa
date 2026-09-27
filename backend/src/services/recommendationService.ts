import mongoose from "mongoose";
import { Context, IContext } from "../models/Context.js";
import { Profile, IProfile } from "../models/Profile.js";
import { User } from "../models/User.js";
import {
    calculateContextCompatibility,
    ContextMatchResult
} from "./contextMatchingService.js";

export interface Recommendation {
    userId: string;
    profile: {
        name: string;
        bio?: string;
        education?: string;
        role?: string;
        experienceLevel?: string;
        skills: string[];
        interests: string[];
        collaborationPreferences?: string[];
    };
    score: number;
    breakdown: ContextMatchResult["breakdown"];
}

export interface RecommendationResult {
    recommendations: Recommendation[];
    count: number;
    limit: number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const normalizeLimit = (limit?: number): number => {
    if (!Number.isFinite(limit)) {
        return DEFAULT_LIMIT;
    }

    return Math.min(
        Math.max(Math.floor(limit as number), 1),
        MAX_LIMIT
    );
};

export const getRecommendations = async (
    userId: string,
    requestedLimit?: number
): Promise<RecommendationResult> => {
    const limit = normalizeLimit(requestedLimit);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("INVALID_USER_ID");
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [profile, context] = await Promise.all([
        Profile.findOne({
            userId: userObjectId
        }),
        Context.findOne({
            userId: userObjectId,
            isActive: true
        }).sort({ createdAt: -1 })
    ]);

    if (!profile) {
        throw new Error("PROFILE_NOT_FOUND");
    }

    if (!context) {
        throw new Error("ACTIVE_CONTEXT_NOT_FOUND");
    }

    const [candidateProfiles, candidateContexts] =
        await Promise.all([
            Profile.find({
                userId: { $ne: userObjectId },
                visibility: "public"
            }),
            Context.find({
                userId: { $ne: userObjectId },
                isActive: true
            })
        ]);

    const activeUserIds = await User.find({
        _id: {
            $in: candidateProfiles.map(
                (candidate) => candidate.userId
            )
        },
        isActive: true
    }).distinct("_id");

    const activeUserIdSet = new Set(
        activeUserIds.map((id) => id.toString())
    );

    const contextMap = new Map<string, IContext>();

    for (const candidateContext of candidateContexts) {
        contextMap.set(
            candidateContext.userId.toString(),
            candidateContext
        );
    }

    const recommendations: Recommendation[] = [];

    for (const candidateProfile of candidateProfiles) {
        const candidateId =
            candidateProfile.userId.toString();

        if (!activeUserIdSet.has(candidateId)) {
            continue;
        }

        const candidateContext =
            contextMap.get(candidateId);

        if (!candidateContext) {
            continue;
        }

        const result = calculateContextCompatibility(
            profile as IProfile,
            candidateProfile as IProfile,
            context as IContext,
            candidateContext
        );

        recommendations.push({
            userId: candidateId,
            profile: {
                name: candidateProfile.name,
                bio: candidateProfile.bio,
                education: candidateProfile.education,
                role: candidateProfile.role,
                experienceLevel:
                    candidateProfile.experienceLevel,
                skills: candidateProfile.skills,
                interests: candidateProfile.interests,
                collaborationPreferences:
                    candidateProfile.collaborationPreferences
            },
            score: result.score,
            breakdown: result.breakdown
        });
    }

    recommendations.sort(
        (first, second) => second.score - first.score
    );

    return {
        recommendations: recommendations.slice(0, limit),
        count: Math.min(recommendations.length, limit),
        limit
    };
};