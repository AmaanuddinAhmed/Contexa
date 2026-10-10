/**
 * Unit tests for blind feedback pooling and rating checks.
 * Run from web/:  npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPool, checkRatings, shuffle } from "./pool";

const list = (variant: string, ids: string[]) => ({
    variant,
    recommendations: ids.map((userId, index) => ({ userId, score: 1 - index / 10 }))
});

// Repeatable "random" numbers for the shuffle.
const sequence = (...values: number[]) => {
    let index = 0;
    return () => values[index++ % values.length];
};

describe("buildPool", () => {
    it("includes each person once, crediting every variant that ranked them", () => {
        const pool = buildPool(
            [list("PROFILE_ONLY", ["a", "b", "c"]), list("CONTEXT_AWARE", ["c", "d", "a"])],
            3,
            sequence(0.5)
        );

        assert.equal(pool.length, 4);

        const byId = new Map(pool.map((item) => [item.userId, item]));
        assert.deepEqual(byId.get("a")!.ranks, { PROFILE_ONLY: 1, CONTEXT_AWARE: 3 });
        assert.deepEqual(byId.get("c")!.ranks, { PROFILE_ONLY: 3, CONTEXT_AWARE: 1 });
        assert.deepEqual(byId.get("d")!.ranks, { CONTEXT_AWARE: 2 });
        assert.equal(byId.get("d")!.scores.CONTEXT_AWARE, 0.9);
    });

    it("only takes the top k of each list", () => {
        const pool = buildPool(
            [list("PROFILE_ONLY", ["a", "b", "c"]), list("CONTEXT_AWARE", ["d", "e", "f"])],
            2
        );

        assert.deepEqual(pool.map((item) => item.userId).sort(), ["a", "b", "d", "e"]);
    });

    it("returns an empty pool when there are no recommendations", () => {
        assert.deepEqual(buildPool([list("PROFILE_ONLY", []), list("CONTEXT_AWARE", [])], 5), []);
    });
});

describe("shuffle", () => {
    it("keeps every item exactly once", () => {
        const items = ["a", "b", "c", "d", "e"];
        assert.deepEqual(shuffle(items, sequence(0.9, 0.1, 0.5, 0.3)).sort(), items);
    });

    it("does not change the input array", () => {
        const items = ["a", "b", "c"];
        shuffle(items, sequence(0));
        assert.deepEqual(items, ["a", "b", "c"]);
    });

    it("can change the order (so variant order is hidden)", () => {
        assert.notDeepEqual(shuffle(["a", "b", "c", "d"], sequence(0)), ["a", "b", "c", "d"]);
    });
});

describe("checkRatings", () => {
    const pool = ["a", "b", "c"];

    it("accepts one 1-5 rating per person", () => {
        assert.deepEqual(
            checkRatings(pool, [
                { userId: "a", rating: 1 },
                { userId: "b", rating: 5 },
                { userId: "c", rating: 3 }
            ]),
            { ok: true }
        );
    });

    const rejects = (ratings: { userId: string; rating: number }[], code: string) => {
        const result = checkRatings(pool, ratings);
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.code, code);
    };

    it("rejects missing ratings", () => {
        rejects([{ userId: "a", rating: 3 }], "INCOMPLETE_RATINGS");
    });

    it("rejects rating the same person twice", () => {
        rejects(
            [
                { userId: "a", rating: 3 },
                { userId: "a", rating: 4 },
                { userId: "b", rating: 3 }
            ],
            "DUPLICATE_RATING"
        );
    });

    it("rejects people outside the round", () => {
        rejects([{ userId: "z", rating: 3 }], "UNKNOWN_PERSON");
    });

    it("rejects ratings outside 1-5 or not whole numbers", () => {
        rejects([{ userId: "a", rating: 0 }], "INVALID_RATING");
        rejects([{ userId: "a", rating: 6 }], "INVALID_RATING");
        rejects([{ userId: "a", rating: 2.5 }], "INVALID_RATING");
    });
});