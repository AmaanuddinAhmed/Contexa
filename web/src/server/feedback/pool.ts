/**
 * Blind feedback rounds: pooling and rating checks.
 *
 * Pure functions only (no database), so they can be unit tested.
 *
 * Method (pooled, blind, within-subject):
 *  1. Take the top K people from EACH variant (PROFILE_ONLY and
 *     CONTEXT_AWARE, each with EXACT and SEMANTIC matching) for the same
 *     user and the same context.
 *  2. Merge them into one pool. Someone in several lists appears once.
 *  3. Shuffle, and hide scores, reasons and which variant chose whom.
 *  4. The user rates every person in the pool from 1 to 5.
 *
 * Each rating can then be credited to every variant that ranked that person,
 * at the rank it gave, so the variants can be compared with rank-aware
 * metrics on the same ratings without the rater knowing which was which.
 */

/** Variant id: "CONTEXT_AWARE", "CONTEXT_AWARE:SEMANTIC", ... (see toVariantId). */
export type VariantId = string;

export interface VariantList {
    variant: VariantId;
    /** Ranked best first. */
    recommendations: { userId: string; score: number }[];
}

export interface PoolItem {
    userId: string;
    /** 1-based rank in each variant that included this person. */
    ranks: Record<VariantId, number>;
    scores: Record<VariantId, number>;
}

export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** Fisher-Yates shuffle. `random` is injectable so tests are repeatable. */
export const shuffle = <T>(items: readonly T[], random: () => number = Math.random): T[] => {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index--) {
        const swapWith = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[swapWith]] = [shuffled[swapWith], shuffled[index]];
    }

    return shuffled;
};

/** Merges the top `k` of each variant into one shuffled pool of unique people. */
export const buildPool = (
    lists: readonly VariantList[],
    k: number,
    random: () => number = Math.random
): PoolItem[] => {
    const byUserId = new Map<string, PoolItem>();

    for (const list of lists) {
        list.recommendations.slice(0, k).forEach((recommendation, index) => {
            const item = byUserId.get(recommendation.userId) ?? {
                userId: recommendation.userId,
                ranks: {},
                scores: {}
            };

            item.ranks[list.variant] = index + 1;
            item.scores[list.variant] = recommendation.score;
            byUserId.set(recommendation.userId, item);
        });
    }

    return shuffle([...byUserId.values()], random);
};

export type RatingCheck = { ok: true } | { ok: false; code: string; message: string };

/** Ratings must cover every pooled person exactly once, each 1-5. */
export const checkRatings = (
    poolUserIds: readonly string[],
    ratings: readonly { userId: string; rating: number }[]
): RatingCheck => {
    const expected = new Set(poolUserIds);
    const seen = new Set<string>();

    for (const { userId, rating } of ratings) {
        if (!expected.has(userId)) {
            return { ok: false, code: "UNKNOWN_PERSON", message: "A rating is for someone not in this round." };
        }

        if (seen.has(userId)) {
            return { ok: false, code: "DUPLICATE_RATING", message: "Each person can be rated only once." };
        }

        if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
            return { ok: false, code: "INVALID_RATING", message: "Ratings must be whole numbers from 1 to 5." };
        }

        seen.add(userId);
    }

    if (seen.size !== expected.size) {
        return { ok: false, code: "INCOMPLETE_RATINGS", message: "Please rate every person." };
    }

    return { ok: true };
};