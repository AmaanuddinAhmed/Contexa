/**
 * PROFILE_ONLY  - baseline: stable profile information only.
 * CONTEXT_AWARE - proposed: profile + dynamic context + directional complementarity.
 */
export const RECOMMENDATION_MODES = ["PROFILE_ONLY", "CONTEXT_AWARE"] as const;

export type RecommendationMode = (typeof RECOMMENDATION_MODES)[number];

export const DEFAULT_RECOMMENDATION_MODE: RecommendationMode = "CONTEXT_AWARE";

export const isRecommendationMode = (value: string): value is RecommendationMode =>
    (RECOMMENDATION_MODES as readonly string[]).includes(value);