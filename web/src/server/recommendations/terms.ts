import "server-only";

/**
 * Normalised, de-duplicated terms for indexed candidate retrieval.
 * Must match the matching engine's normalisation (trim + lowercase,
 * recommendation-service/matching.py), so retrieval and scoring agree on
 * what counts as the same skill, interest or need.
 */
export const toMatchTerms = (values: readonly string[]): string[] => [
    ...new Set(
        values
            .map((value) => value.trim().toLowerCase())
            .filter((value) => value.length > 0)
    )
];