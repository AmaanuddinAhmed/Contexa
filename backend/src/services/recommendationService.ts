import mongoose from "mongoose";
import { Context, IContext } from "../models/Context.js";
import { Profile, IProfile } from "../models/Profile.js";
import { User } from "../models/User.js";
import {
    calculateContextCompatibility,
    ContextMatchResult
} from "./contextMatchingService.js";
import {
    calculateProfileSimilarity,
    ProfileMatchResult
} from "./profileMatchingService.js";

/**
 * PROFILE_ONLY  - baseline: stable profile information only.
 * CONTEXT_AWARE - proposed: profile + dynamic context + directional complementarity.
 */
export const RECOMMENDATION_MODES = [
    "PROFILE_ONLY",
    "CONTEXT_AWARE"
] as const;

export type RecommendationMode =
    (typeof RECOMMENDATION_MODES)[number];

export const DEFAULT_RECOMMENDATION_MODE: RecommendationMode =
    "CONTEXT_AWARE";

export const isRecommendationMode = (
    value: string
): value is RecommendationMode =>
    (RECOMMENDATION_MODES as readonly string[]).includes(value);

export type RecommendationBreakdown =
    | ProfileMatchResult["breakdown"]
    | ContextMatchResult["breakdown"];

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
    breakdown: RecommendationBreakdown;
}

export interface RecommendationResult {
    mode: RecommendationMode;
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

/**
 * Scores one candidate under the given mode. Only this step differs between
 * modes; candidate generation is identical, so both modes rank the same pool.
 */
export const scoreCandidate = (
    mode: RecommendationMode,
    requesterProfile: IProfile,
    candidateProfile: IProfile,
    requesterContext: IContext | null,
    candidateContext: IContext
): { score: number; breakdown: RecommendationBreakdown } => {
    if (mode === "PROFILE_ONLY") {
        return calculateProfileSimilarity(
            requesterProfile,
            candidateProfile
        );
    }

    if (!requesterContext) {
        throw new Error("ACTIVE_CONTEXT_NOT_FOUND");
    }

    return calculateContextCompatibility(
        requesterProfile,
        candidateProfile,
        requesterContext,
        candidateContext
    );
};

export const getRecommendations = async (
    userId: string,
    requestedLimit?: number,
    mode: RecommendationMode = DEFAULT_RECOMMENDATION_MODE
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

    // The baseline does not use the requester's context, so it is only
    // required in CONTEXT_AWARE mode.
    if (mode === "CONTEXT_AWARE" && !context) {
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

        const result = scoreCandidate(
            mode,
            profile as IProfile,
            candidateProfile as IProfile,
            context as IContext | null,
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
        mode,
        recommendations: recommendations.slice(0, limit),
        count: Math.min(recommendations.length, limit),
        limit
    };
};