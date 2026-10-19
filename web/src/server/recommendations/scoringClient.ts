import "server-only";
import { IContext } from "@/server/models/Context";
import { IProfile } from "@/server/models/Profile";
import type { Matcher, RecommendationMode } from "./modes";

/**
 * Stage 2 (scoring + ranking) runs in the stateless Python recommendation
 * service. It receives only the fields the matching engine reads.
 */

// A free-tier host can take up to about a minute to wake an idle service,
// so the deployed app raises this via RECOMMENDATION_SERVICE_TIMEOUT_MS.
const getRecommendationServiceTimeoutMs = (): number => {
    const configured = Number(process.env.RECOMMENDATION_SERVICE_TIMEOUT_MS);
    return Number.isInteger(configured) && configured > 0 ? configured : 10_000;
};

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

/** One human-readable reason for a match, produced by explain.py. */
export interface MatchReason {
    code: string;
    text: string;
    items: string[];
}

export interface ScoredCandidate {
    userId: string;
    score: number;
    breakdown: Record<string, number>;
    reasons: MatchReason[];
}

export interface ScoringRequest {
    mode: RecommendationMode;
    matcher: Matcher;
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

    const internalKey = process.env.INTERNAL_API_KEY;

    if (internalKey) {
        headers["X-Internal-Key"] = internalKey;
    } else if (process.env.NODE_ENV === "production") {
        // Fail closed: never call the scoring service without the key in
        // production (the service would refuse it anyway).
        console.error("INTERNAL_API_KEY is not set; refusing to call the recommendation service.");
        throw new Error("RECOMMENDATION_SERVICE_UNAVAILABLE");
    }

    let response: Response;

    try {
        response = await fetch(
            `${getRecommendationServiceUrl()}/internal/recommend`,
            {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(getRecommendationServiceTimeoutMs()),
                cache: "no-store"
            }
        );
    } catch (error) {
        console.error("Recommendation service unreachable:", error);
        throw new Error("RECOMMENDATION_SERVICE_UNAVAILABLE");
    }

    if (!response.ok) {
        const body = await response.text();
        console.error("Recommendation service error:", response.status, body);

        // The service is up but its embedding model is not: only SEMANTIC fails.
        if (response.status === 503 && body.includes("SEMANTIC_MATCHER_UNAVAILABLE")) {
            throw new Error("SEMANTIC_MATCHER_UNAVAILABLE");
        }

        throw new Error("RECOMMENDATION_SERVICE_UNAVAILABLE");
    }

    const data = (await response.json()) as { recommendations: ScoredCandidate[] };

    return data.recommendations;
};