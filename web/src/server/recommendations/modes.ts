export const RECOMMENDATION_MODES = ["PROFILE_ONLY", "CONTEXT_AWARE"] as const;

export type RecommendationMode = (typeof RECOMMENDATION_MODES)[number];

export const DEFAULT_RECOMMENDATION_MODE: RecommendationMode = "CONTEXT_AWARE";

export const isRecommendationMode = (value: string): value is RecommendationMode =>
    (RECOMMENDATION_MODES as readonly string[]).includes(value);

export const MATCHERS = ["EXACT", "SEMANTIC"] as const;

export type Matcher = (typeof MATCHERS)[number];

export const DEFAULT_MATCHER: Matcher = "EXACT";

export const isMatcher = (value: string): value is Matcher =>
    (MATCHERS as readonly string[]).includes(value);

export const toVariantId = (mode: RecommendationMode, matcher: Matcher): string =>
    matcher === "EXACT" ? mode : `${mode}:${matcher}`;