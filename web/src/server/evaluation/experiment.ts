/**
 * Synthetic experiment: how much do the four variants' rankings differ, and
 * does each one respond to context?
 *
 * Pure functions only (no database), so they can be unit tested. The runner
 * (scripts/run-experiment.ts) collects the lists and calls these.
 *
 * For each requester it records, per variant:
 *  - lists:   the top-K user ids with the requester's own profile and context
 *  - swapped: the top-K with the same profile but another user's context
 *  - coverage: share of the requester's needs covered (exact terms) by the
 *              skills and interests of the top-K
 *
 * What the summary shows:
 *  - agreement between variants (overlap@K, rank-biased overlap): how much
 *    the mode or the matcher changes who is recommended
 *  - context sensitivity (original vs swapped lists): CONTEXT_AWARE should
 *    change when only the context changes; PROFILE_ONLY should not
 *  - need coverage: circular for CONTEXT_AWARE, which optimises it directly,
 *    so it describes behaviour and is not evidence of better recommendations
 *
 * Synthetic data describes system behaviour, not real-world relevance; that
 * comes from the blind feedback ratings (metrics.ts).
 */
import { mean, overlapAtK, rankBiasedOverlap } from "./metrics";

export interface ExperimentRow {
    userId: string;
    /** Whose context was borrowed for the swapped lists. */
    swappedWith: string;
    lists: Record<string, string[]>;
    swapped: Record<string, string[]>;
    coverage: Record<string, number>;
}

export interface PairAgreement {
    first: string;
    second: string;
    overlap: number;
    rbo: number;
}

export interface VariantBehaviour {
    variant: string;
    /** Overlap@K between the original and swapped-context lists (1 = unchanged). */
    sameAfterContextSwap: number;
    rboAfterContextSwap: number;
    needCoverage: number;
}

export interface ExperimentSummary {
    requesters: number;
    agreement: PairAgreement[];
    behaviour: VariantBehaviour[];
}

const normalise = (value: string) => value.trim().toLowerCase();

/** Share of `needs` found among the given people's skills and interests (exact terms). */
export const needCoverage = (needs: readonly string[], capabilities: readonly string[]): number => {
    const wanted = new Set(needs.map(normalise).filter(Boolean));

    if (wanted.size === 0) {
        return NaN;
    }

    const offered = new Set(capabilities.map(normalise));
    return [...wanted].filter((need) => offered.has(need)).length / wanted.size;
};

/**
 * Pairs a requester with another requester's context, deterministically:
 * shuffles with `random`, then gives each person the next one's context.
 * Nobody is paired with themselves when there are at least two people.
 */
export const contextDonors = (ids: readonly string[], random: () => number): Map<string, string> => {
    const order = [...ids];

    for (let index = order.length - 1; index > 0; index--) {
        const swapWith = Math.floor(random() * (index + 1));
        [order[index], order[swapWith]] = [order[swapWith], order[index]];
    }

    return new Map(order.map((id, index) => [id, order[(index + 1) % order.length]]));
};

const finiteMean = (values: number[]) => mean(values.filter(Number.isFinite));

export const summariseExperiment = (
    rows: readonly ExperimentRow[],
    variants: readonly string[],
    k: number
): ExperimentSummary => {
    const agreement: PairAgreement[] = [];

    for (let first = 0; first < variants.length; first++) {
        for (let second = first + 1; second < variants.length; second++) {
            const a = variants[first];
            const b = variants[second];

            agreement.push({
                first: a,
                second: b,
                overlap: finiteMean(rows.map((row) => overlapAtK(row.lists[a] ?? [], row.lists[b] ?? [], k))),
                rbo: finiteMean(rows.map((row) => rankBiasedOverlap(row.lists[a] ?? [], row.lists[b] ?? [])))
            });
        }
    }

    const behaviour = variants.map((variant) => ({
        variant,
        sameAfterContextSwap: finiteMean(
            rows.map((row) => overlapAtK(row.lists[variant] ?? [], row.swapped[variant] ?? [], k))
        ),
        rboAfterContextSwap: finiteMean(
            rows.map((row) => rankBiasedOverlap(row.lists[variant] ?? [], row.swapped[variant] ?? []))
        ),
        needCoverage: finiteMean(rows.map((row) => row.coverage[variant]))
    }));

    return { requesters: rows.length, agreement, behaviour };
};