import "server-only";
import mongoose from "mongoose";
import { Context, currentContextFilter, IContext } from "@/server/models/Context";
import { IProfile, Profile } from "@/server/models/Profile";
import { generateCandidates } from "./candidateGeneration";
import {
    DEFAULT_MATCHER,
    DEFAULT_RECOMMENDATION_MODE,
    Matcher,
    RecommendationMode
} from "./modes";
import { MatchReason, requestScores, toMatchingContext, toMatchingProfile } from "./scoringClient";

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
        isSample: boolean;
    };
    score: number;
    breakdown: Record<string, number>;
    reasons: MatchReason[];
}

export interface RecommendationResult {
    mode: RecommendationMode;
    matcher: Matcher;
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
    mode: RecommendationMode = DEFAULT_RECOMMENDATION_MODE,
    matcher: Matcher = DEFAULT_MATCHER
): Promise<RecommendationResult> => {
    const limit = normalizeLimit(requestedLimit);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("INVALID_USER_ID");
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [profile, context] = await Promise.all([
        Profile.findOne({ userId: userObjectId }),
        Context.findOne({ userId: userObjectId, ...currentContextFilter() }).sort({ createdAt: -1 })
    ]);

    if (!profile) {
        throw new Error("PROFILE_NOT_FOUND");
    }

    // The baseline does not use the requester's context, so it is only
    // required in CONTEXT_AWARE mode.
    if (mode === "CONTEXT_AWARE" && !context) {
        throw new Error("ACTIVE_CONTEXT_NOT_FOUND");
    }

    return rankForRequester(userObjectId, profile, context, limit, mode, matcher);
};

/**
 * Stages 1 and 2 for a requester whose profile and context are given rather
 * than loaded. getRecommendations uses it with the stored ones; the
 * experiment runner (scripts/run-experiment.ts) also uses it with a
 * different context, to hold the profile constant while varying context.
 */
export const rankForRequester = async (
    userObjectId: mongoose.Types.ObjectId,
    profile: IProfile,
    context: IContext | null,
    limit: number,
    mode: RecommendationMode,
    matcher: Matcher
): Promise<RecommendationResult> => {
    // Stage 1: retrieval. Note that `mode` is not passed in.
    const { candidates } = await generateCandidates(userObjectId, profile, context);

    // Stage 2: scoring and ranking in the Python service. Retrieval above is
    // the same for every mode and matcher, so variants rank the same pool.
    const scored = await requestScores({
        mode,
        matcher,
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
                collaborationPreferences: candidateProfile.collaborationPreferences,
                isSample: candidateProfile.isSample === true
            },
            score: result.score,
            breakdown: result.breakdown,
            reasons: result.reasons ?? []
        };
    });

    return {
        mode,
        matcher,
        recommendations,
        count: recommendations.length,
        limit
    };
};