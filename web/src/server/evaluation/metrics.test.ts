import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    bootstrapMeanInterval,
    compareVariants,
    MIN_ROUNDS_TO_INTERPRET,
    overlapAtK,
    rankBiasedOverlap,
    RatedItem,
    scoreRound,
    seededRandom,
    summariseVariant,
    variantRatings
} from "./metrics";

const close = (actual: number, expected: number, tolerance = 1e-9) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

const round: RatedItem[] = [
    { rating: 5, ranks: { A: 1 } },
    { rating: 4, ranks: { A: 2, B: 2 } },
    { rating: 2, ranks: { B: 1 } },
    { rating: 1, ranks: {} }
];

describe("variantRatings", () => {
    it("lists a variant's people in its rank order", () => {
        assert.deepEqual(variantRatings(round, "A"), [5, 4]);
        assert.deepEqual(variantRatings(round, "B"), [2, 4]);
    });

    it("is empty for a variant not in the round", () => {
        assert.deepEqual(variantRatings(round, "C"), []);
    });
});

describe("scoreRound", () => {
    it("gives a perfect list NDCG 1", () => {
        const scores = scoreRound(round, "A")!;
        close(scores.ndcg, 1);
        close(scores.meanRating, 4.5);
        close(scores.precision, 1);
        assert.equal(scores.listSize, 2);
    });

    it("penalises putting the better person second", () => {
        const expected = (1 + 3 / Math.log2(3)) / (4 + 3 / Math.log2(3));
        const scores = scoreRound(round, "B")!;
        close(scores.ndcg, expected);
        close(scores.precision, 0.5);
        close(scores.meanRating, 3);
    });

    it("does not penalise a list when everyone was rated Not useful", () => {
        const allBad: RatedItem[] = [{ rating: 1, ranks: { A: 1 } }, { rating: 1, ranks: { A: 2 } }];
        close(scoreRound(allBad, "A")!.ndcg, 1);
    });

    it("returns null for a variant not in the round", () => {
        assert.equal(scoreRound(round, "C"), null);
    });
});

describe("bootstrapMeanInterval", () => {
    it("is reproducible for the same seed", () => {
        const values = [0.1, 0.4, -0.2, 0.3, 0.0];
        assert.deepEqual(bootstrapMeanInterval(values), bootstrapMeanInterval(values));
    });

    it("contains the sample mean", () => {
        const values = [0.1, 0.4, -0.2, 0.3, 0.0, 0.25, 0.15];
        const [low, high] = bootstrapMeanInterval(values);
        const sampleMean = values.reduce((sum, value) => sum + value, 0) / values.length;
        assert.ok(low <= sampleMean && sampleMean <= high);
    });

    it("collapses to the value when all values are equal", () => {
        assert.deepEqual(bootstrapMeanInterval([0.5, 0.5, 0.5]), [0.5, 0.5]);
    });

    it("is NaN with no values", () => {
        assert.ok(bootstrapMeanInterval([]).every(Number.isNaN));
    });
});

describe("seededRandom", () => {
    it("produces values in [0, 1)", () => {
        const random = seededRandom(1);
        for (let index = 0; index < 1000; index++) {
            const value = random();
            assert.ok(value >= 0 && value < 1);
        }
    });
});

describe("compareVariants", () => {
    const winning = (count: number) => Array.from({ length: count }, () => round);

    it("reports insufficient data below the minimum number of rounds", () => {
        const result = compareVariants(winning(MIN_ROUNDS_TO_INTERPRET - 1), "A", "B");
        assert.equal(result.verdict, "INSUFFICIENT_DATA");
        assert.equal(result.wins, MIN_ROUNDS_TO_INTERPRET - 1);
    });

    it("finds a consistent winner", () => {
        const result = compareVariants(winning(MIN_ROUNDS_TO_INTERPRET), "A", "B");
        assert.equal(result.verdict, "VARIANT_BETTER");
        assert.ok(result.meanDifference > 0);
        assert.deepEqual([result.wins, result.ties, result.losses], [MIN_ROUNDS_TO_INTERPRET, 0, 0]);
    });

    it("finds a consistent loser", () => {
        const result = compareVariants(winning(MIN_ROUNDS_TO_INTERPRET), "B", "A");
        assert.equal(result.verdict, "BASELINE_BETTER");
    });

    it("finds no clear difference when wins and losses balance", () => {
        const swapped: RatedItem[] = round.map((item) => ({
            rating: item.rating,
            ranks: { A: item.ranks.B, B: item.ranks.A }
        }));
        const rounds = Array.from({ length: 20 }, (_, index) => (index % 2 ? round : swapped));
        const result = compareVariants(rounds, "A", "B");
        assert.equal(result.verdict, "NO_CLEAR_DIFFERENCE");
        close(result.meanDifference, 0);
    });

    it("pairs only rounds containing both variants", () => {
        const onlyA: RatedItem[] = [{ rating: 5, ranks: { A: 1 } }];
        const result = compareVariants([round, onlyA], "A", "B");
        assert.equal(result.rounds, 1);
    });
});

describe("summariseVariant", () => {
    it("averages over the rounds that include the variant", () => {
        const onlyA: RatedItem[] = [{ rating: 3, ranks: { A: 1 } }];
        const summary = summariseVariant([round, onlyA], "A");
        assert.equal(summary.rounds, 2);
        close(summary.meanRating, (4.5 + 3) / 2);
    });

    it("has zero rounds for an unknown variant", () => {
        const summary = summariseVariant([round], "C");
        assert.equal(summary.rounds, 0);
        assert.ok(Number.isNaN(summary.ndcg));
    });
});

describe("overlapAtK", () => {
    it("is 1 for identical lists and 0 for disjoint ones", () => {
        close(overlapAtK(["a", "b"], ["b", "a"], 2), 1);
        close(overlapAtK(["a", "b"], ["c", "d"], 2), 0);
    });

    it("counts only the top k", () => {
        close(overlapAtK(["a", "b", "c"], ["a", "x", "b"], 2), 0.5);
    });
});

describe("rankBiasedOverlap", () => {
    it("is 1 for identical lists", () => {
        close(rankBiasedOverlap(["a", "b", "c"], ["a", "b", "c"]), 1);
    });

    it("is 0 for disjoint lists", () => {
        close(rankBiasedOverlap(["a", "b"], ["c", "d"]), 0);
    });

    it("weights agreement at the top more than at the bottom", () => {
        const topAgrees = rankBiasedOverlap(["a", "b", "c"], ["a", "x", "y"]);
        const bottomAgrees = rankBiasedOverlap(["a", "b", "c"], ["x", "y", "c"]);
        assert.ok(topAgrees > bottomAgrees);
    });

    it("is NaN for an empty list", () => {
        assert.ok(Number.isNaN(rankBiasedOverlap([], ["a"])));
    });
});