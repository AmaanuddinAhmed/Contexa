import "server-only";
import mongoose from "mongoose";
import { Context } from "@/server/models/Context";
import { Profile } from "@/server/models/Profile";
import { generateCandidates } from "./candidateGeneration";
import { DEFAULT_RECOMMENDATION_MODE, RecommendationMode } from "./modes";
import { requestScores, toMatchingContext, toMatchingProfile } from "./scoringClient";

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
    breakdown: Record<string, number>;
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

    return Math.min(Math.max(Math.floor(limit as number), 1), MAX_LIMIT);
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
        Profile.findOne({ userId: userObjectId }),
        Context.findOne({ userId: userObjectId, isActive: true }).sort({ createdAt: -1 })
    ]);

    if (!profile) {
        throw new Error("PROFILE_NOT_FOUND");
    }

    // The baseline does not use the requester's context, so it is only
    // required in CONTEXT_AWARE mode.
    if (mode === "CONTEXT_AWARE" && !context) {
        throw new Error("ACTIVE_CONTEXT_NOT_FOUND");
    }

    // Stage 1: retrieval. Note that `mode` is not passed in.
    const { candidates } = await generateCandidates(userObjectId, profile, context);

    // Stage 2: scoring and ranking in the Python service.
    const scored = await requestScores({
        mode,
        limit,
        requester: {
            profile: toMatchingProfile(profile),
            context: context ? toMatchingContext(context) : null
        },
        candidates: candidates.map((candidate) => ({
            userId: candidate.userId,
            profile: toMatchingProfile(candidate.profile),
            context: toMatchingContext(candidate.context)
        }))
    });

    // Attach display fields (name, bio, ...) that the scorer never sees.
    const profileById = new Map(
        candidates.map((candidate) => [candidate.userId, candidate.profile])
    );

    const recommendations: Recommendation[] = scored.map((result) => {
        const candidateProfile = profileById.get(result.userId)!;

        return {
            userId: result.userId,
            profile: {
                name: candidateProfile.name,
                bio: candidateProfile.bio,
                education: candidateProfile.education,
                role: candidateProfile.role,
                experienceLevel: candidateProfile.experienceLevel,
                skills: candidateProfile.skills,
                interests: candidateProfile.interests,
                collaborationPreferences: candidateProfile.collaborationPreferences
            },
            score: result.score,
            breakdown: result.breakdown
        };
    });

    return {
        mode,
        recommendations,
        count: recommendations.length,
        limit
    };
};