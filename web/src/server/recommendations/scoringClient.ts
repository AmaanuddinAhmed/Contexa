import "server-only";
import { IContext } from "@/server/models/Context";
import { IProfile } from "@/server/models/Profile";
import type { RecommendationMode } from "./modes";

/**
 * Stage 2 (scoring + ranking) runs in the stateless Python recommendation
 * service. It receives only the fields the matching engine reads.
 */

const RECOMMENDATION_SERVICE_TIMEOUT_MS = 10_000;

const getRecommendationServiceUrl = (): string =>
    process.env.RECOMMENDATION_SERVICE_URL ?? "http://localhost:8000";

export const toMatchingProfile = (profile: IProfile) => ({
    skills: profile.skills,
    interests: profile.interests,
    experienceLevel: profile.experienceLevel ?? null,
    collaborationPreferences: profile.collaborationPreferences ?? []
});

export const toMatchingContext = (context: IContext) => ({
    need: context.need,
    activity: context.activity,
    availability: context.availability,
    interactionPreference: context.interactionPreference
});

export interface ScoredCandidate {
    userId: string;
    score: number;
    breakdown: Record<string, number>;
}

export interface ScoringRequest {
    mode: RecommendationMode;
    limit: number;
    requester: {
        profile: ReturnType<typeof toMatchingProfile>;
        context: ReturnType<typeof toMatchingContext> | null;
    };
    candidates: {
        userId: string;
        profile: ReturnType<typeof toMatchingProfile>;
        context: ReturnType<typeof toMatchingContext>;
    }[];
}

export const requestScores = async (
    payload: ScoringRequest
): Promise<ScoredCandidate[]> => {
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
                signal: AbortSignal.timeout(RECOMMENDATION_SERVICE_TIMEOUT_MS),
                cache: "no-store"
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

    const data = (await response.json()) as { recommendations: ScoredCandidate[] };

    return data.recommendations;
};