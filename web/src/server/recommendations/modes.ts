/**
 * PROFILE_ONLY  - baseline: stable profile information only.
 * CONTEXT_AWARE - proposed: profile + dynamic context + directional complementarity.
 */
export const RECOMMENDATION_MODES = ["PROFILE_ONLY", "CONTEXT_AWARE"] as const;

export type RecommendationMode = (typeof RECOMMENDATION_MODES)[number];

export const DEFAULT_RECOMMENDATION_MODE: RecommendationMode = "CONTEXT_AWARE";

export const isRecommendationMode = (value: string): value is RecommendationMode =>
    (RECOMMENDATION_MODES as readonly string[]).includes(value);

/**
 * How terms (skills, interests, needs) are compared, independent of the mode.
 * EXACT    - identical after trim + lowercase.
 * SEMANTIC - also near-synonyms, via sentence embeddings ("React" ~ "React.js").
 */
export const MATCHERS = ["EXACT", "SEMANTIC"] as const;

export type Matcher = (typeof MATCHERS)[number];

export const DEFAULT_MATCHER: Matcher = "EXACT";

export const isMatcher = (value: string): value is Matcher =>
    (MATCHERS as readonly string[]).includes(value);

/**
 * Variant id for evaluation: mode x matcher. EXACT variants keep the bare
 * mode name, so ids recorded before semantic matching existed stay valid.
 */
export const toVariantId = (mode: RecommendationMode, matcher: Matcher): string =>
    matcher === "EXACT" ? mode : `${mode}:${matcher}`;