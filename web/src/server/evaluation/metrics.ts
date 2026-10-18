/**
 * Evaluation metrics for the blind feedback rounds (real evidence).
 *
 * Pure functions only (no database), so they can be unit tested.
 *
 * Each completed round holds one user's 1-5 ratings of a pooled set of
 * people, plus the rank each variant gave each person (see feedback/pool.ts).
 * A variant's list in a round is the pooled people it ranked, in its order;
 * every one of them was rated, so every list is fully judged.
 *
 * Per round and variant:
 *  - meanRating   average rating of the variant's list
 *  - precision    share of the list rated at least RELEVANT_RATING ("Useful")
 *  - ndcg         DCG of the list / DCG of the best possible list drawn from
 *                 the same pool, with gain = rating - 1 (so "Not useful" = 0)
 *
 * Variants are compared on the rounds that contain both (paired), with a
 * bootstrap confidence interval on the mean difference.
 */

export const RELEVANT_RATING = 4;

/** Below this many paired rounds, a difference is reported but not interpreted. */
export const MIN_ROUNDS_TO_INTERPRET = 10;

export interface RatedItem {
    rating: number;
    /** Variant id -> 1-based rank that variant gave this person. */
    ranks: Record<string, number>;
}

export interface RoundScores {
    meanRating: number;
    precision: number;
    ndcg: number;
    /** How many people the variant contributed (normally K). */
    listSize: number;
}

const gain = (rating: number): number => Math.max(rating - 1, 0);

const dcg = (ratings: number[]): number =>
    ratings.reduce((sum, rating, index) => sum + gain(rating) / Math.log2(index + 2), 0);

/** The variant's list in this round, best rank first, as ratings. */
export const variantRatings = (items: readonly RatedItem[], variant: string): number[] =>
    items
        .filter((item) => item.ranks[variant] !== undefined)
        .sort((first, second) => first.ranks[variant] - second.ranks[variant])
        .map((item) => item.rating);

/** Scores of one variant in one round, or null if the variant is not in it. */
export const scoreRound = (
    items: readonly RatedItem[],
    variant: string
): RoundScores | null => {
    const ratings = variantRatings(items, variant);

    if (ratings.length === 0) {
        return null;
    }

    // Ideal: the best `ratings.length` people anywhere in the pool.
    const ideal = items
        .map((item) => item.rating)
        .sort((first, second) => second - first)
        .slice(0, ratings.length);
    const idealDcg = dcg(ideal);

    return {
        meanRating: ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
        precision: ratings.filter((rating) => rating >= RELEVANT_RATING).length / ratings.length,
        // Everyone rated "Not useful": no list could do better, so it is not penalised.
        ndcg: idealDcg === 0 ? 1 : dcg(ratings) / idealDcg,
        listSize: ratings.length
    };
};

export const mean = (values: readonly number[]): number =>
    values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;

/** Small seeded PRNG (mulberry32), so reported intervals are reproducible. */
export const seededRandom = (seed: number): (() => number) => {
    let state = seed >>> 0;

    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

/**
 * Percentile bootstrap 95% interval for the mean of `values`.
 * Returns [NaN, NaN] when there are no values.
 */
export const bootstrapMeanInterval = (
    values: readonly number[],
    resamples = 2000,
    seed = 20261011
): [number, number] => {
    if (values.length === 0) {
        return [NaN, NaN];
    }

    const random = seededRandom(seed);
    const means: number[] = [];

    for (let draw = 0; draw < resamples; draw++) {
        let sum = 0;

        for (let index = 0; index < values.length; index++) {
            sum += values[Math.floor(random() * values.length)];
        }

        means.push(sum / values.length);
    }

    means.sort((first, second) => first - second);

    return [
        means[Math.floor(0.025 * (resamples - 1))],
        means[Math.ceil(0.975 * (resamples - 1))]
    ];
};

export interface VariantSummary {
    variant: string;
    rounds: number;
    meanRating: number;
    precision: number;
    ndcg: number;
    ndcgInterval: [number, number];
}

export interface Comparison {
    /** The variant being tested, e.g. CONTEXT_AWARE. */
    variant: string;
    /** What it is compared against, e.g. PROFILE_ONLY. */
    baseline: string;
    /** Rounds that contain both variants. */
    rounds: number;
    /** Mean of (variant NDCG - baseline NDCG) over those rounds. */
    meanDifference: number;
    interval: [number, number];
    wins: number;
    ties: number;
    losses: number;
    /** Enough rounds, and the interval excludes zero. */
    verdict: "INSUFFICIENT_DATA" | "NO_CLEAR_DIFFERENCE" | "VARIANT_BETTER" | "BASELINE_BETTER";
}

export const summariseVariant = (
    rounds: readonly (readonly RatedItem[])[],
    variant: string
): VariantSummary => {
    const scores = rounds
        .map((items) => scoreRound(items, variant))
        .filter((score): score is RoundScores => score !== null);
    const ndcgs = scores.map((score) => score.ndcg);

    return {
        variant,
        rounds: scores.length,
        meanRating: mean(scores.map((score) => score.meanRating)),
        precision: mean(scores.map((score) => score.precision)),
        ndcg: mean(ndcgs),
        ndcgInterval: bootstrapMeanInterval(ndcgs)
    };
};

// Differences smaller than this count as ties.
const TIE = 1e-9;

export const compareVariants = (
    rounds: readonly (readonly RatedItem[])[],
    variant: string,
    baseline: string
): Comparison => {
    const differences: number[] = [];

    for (const items of rounds) {
        const tested = scoreRound(items, variant);
        const reference = scoreRound(items, baseline);

        if (tested && reference) {
            differences.push(tested.ndcg - reference.ndcg);
        }
    }

    const interval = bootstrapMeanInterval(differences);
    const wins = differences.filter((difference) => difference > TIE).length;
    const losses = differences.filter((difference) => difference < -TIE).length;

    let verdict: Comparison["verdict"];

    if (differences.length < MIN_ROUNDS_TO_INTERPRET) {
        verdict = "INSUFFICIENT_DATA";
    } else if (interval[0] > 0) {
        verdict = "VARIANT_BETTER";
    } else if (interval[1] < 0) {
        verdict = "BASELINE_BETTER";
    } else {
        verdict = "NO_CLEAR_DIFFERENCE";
    }

    return {
        variant,
        baseline,
        rounds: differences.length,
        meanDifference: mean(differences),
        interval,
        wins,
        ties: differences.length - wins - losses,
        losses,
        verdict
    };
};

/**
 * Ranking agreement for the synthetic experiment.
 */

/** Share of the top-k that two lists have in common (0-1). */
export const overlapAtK = (first: readonly string[], second: readonly string[], k: number): number => {
    if (k <= 0) {
        return NaN;
    }

    const top = new Set(first.slice(0, k));
    return second.slice(0, k).filter((id) => top.has(id)).length / k;
};

/**
 * Rank-biased overlap (Webber et al., 2010), truncated at the list depth:
 * agreement at each depth d, weighted by p^(d-1), normalised so identical
 * lists score 1. Top positions count more than lower ones.
 */
export const rankBiasedOverlap = (
    first: readonly string[],
    second: readonly string[],
    p = 0.9
): number => {
    const depth = Math.min(first.length, second.length);

    if (depth === 0) {
        return NaN;
    }

    let weighted = 0;
    let totalWeight = 0;

    for (let d = 1; d <= depth; d++) {
        const weight = Math.pow(p, d - 1);
        weighted += weight * overlapAtK(first, second, d);
        totalWeight += weight;
    }

    return weighted / totalWeight;
};