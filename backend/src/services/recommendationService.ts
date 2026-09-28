import mongoose from "mongoose";
import { Context, IContext } from "../models/Context.js";
import { Profile, IProfile } from "../models/Profile.js";
import { User } from "../models/User.js";

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

// Must not exceed MAX_CANDIDATES in recommendation-service/main.py.
const MAX_CANDIDATES = 500;

const RECOMMENDATION_SERVICE_TIMEOUT_MS = 10_000;

const getRecommendationServiceUrl = (): string =>
    process.env.RECOMMENDATION_SERVICE_URL ?? "http://localhost:8000";

const normalizeLimit = (limit?: number): number => {
    if (!Number.isFinite(limit)) {
        return DEFAULT_LIMIT;
    }

    return Math.min(
        Math.max(Math.floor(limit as number), 1),
        MAX_LIMIT
    );
};

// Only the fields the matching engine reads are sent to Python.
const toMatchingProfile = (profile: IProfile) => ({
    skills: profile.skills,
    interests: profile.interests,
    experienceLevel: profile.experienceLevel ?? null,
    collaborationPreferences: profile.collaborationPreferences ?? []
});

const toMatchingContext = (context: IContext) => ({
    need: context.need,
    activity: context.activity,
    availability: context.availability,
    interactionPreference: context.interactionPreference
});

interface ScoredCandidate {
    userId: string;
    score: number;
    breakdown: Record<string, number>;
}

interface RecommendationServiceResponse {
    mode: RecommendationMode;
    recommendations: ScoredCandidate[];
}

/**
 * Stage 2 (scoring + ranking) runs in the Python recommendation service.
 * This service only computes scores; it never reads the database.
 */
const requestScores = async (payload: unknown): Promise<ScoredCandidate[]> => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };

    if (process.env.INTERNAL_API_KEY) {
        headers["X-Internal-Key"] = process.env.INTERNAL_API_KEY;
    }

    let response: Response;

    try {
        response = await fetch(
            `${getRecommendationServiceUrl()}/internal/recommend`,
            {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(RECOMMENDATION_SERVICE_TIMEOUT_MS)
            }
        );
    } catch (error) {
        console.error("Recommendation service unreachable:", error);
        throw new Error("RECOMMENDATION_SERVICE_UNAVAILABLE");
    }

    if (!response.ok) {
        console.error(
            "Recommendation service error:",
            response.status,
            await response.text()
        );
        throw new Error("RECOMMENDATION_SERVICE_UNAVAILABLE");
    }

    const data = (await response.json()) as RecommendationServiceResponse;

    return data.recommendations;
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

    // Stage 1: candidate generation. Identical for both modes, so both rank
    // the same pool. (Indexed, bounded retrieval arrives with the Next.js
    // API routes in step C.)
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

    const profileMap = new Map<string, IProfile>();
    const candidates = [];

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

        profileMap.set(candidateId, candidateProfile);

        candidates.push({
            userId: candidateId,
            profile: toMatchingProfile(candidateProfile),
            context: toMatchingContext(candidateContext)
        });
    }

    if (candidates.length > MAX_CANDIDATES) {
        // Refuse rather than silently truncate: truncation would change which
        // people each mode can recommend.
        throw new Error("CANDIDATE_POOL_TOO_LARGE");
    }

    // Stage 2: scoring and ranking in the Python service.
    const scored = await requestScores({
        mode,
        limit,
        requester: {
            profile: toMatchingProfile(profile),
            context: context ? toMatchingContext(context) : null
        },
        candidates
    });

    // Attach display fields (name, bio, ...) that the scorer never sees.
    const recommendations: Recommendation[] = scored.map((result) => {
        const candidateProfile = profileMap.get(result.userId) as IProfile;

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
                collaborationPreferences:
                    candidateProfile.collaborationPreferences
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