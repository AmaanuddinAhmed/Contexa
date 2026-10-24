import { mean, overlapAtK, rankBiasedOverlap } from "./metrics";

export interface ExperimentRow {
    userId: string;
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

export const needCoverage = (needs: readonly string[], capabilities: readonly string[]): number => {
    const wanted = new Set(needs.map(normalise).filter(Boolean));

    if (wanted.size === 0) {
        return NaN;
    }

    const offered = new Set(capabilities.map(normalise));
    return [...wanted].filter((need) => offered.has(need)).length / wanted.size;
};

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