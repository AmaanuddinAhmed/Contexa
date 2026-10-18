/**
 * Unit tests for the synthetic experiment summary.
 * Run from web/:  npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contextDonors, ExperimentRow, needCoverage, summariseExperiment } from "./experiment";
import { seededRandom } from "./metrics";

describe("needCoverage", () => {
    it("is the share of needs offered, ignoring case and spaces", () => {
        assert.equal(needCoverage(["React", "Python"], [" react ", "SQL"]), 0.5);
        assert.equal(needCoverage(["React"], ["React"]), 1);
    });

    it("counts a repeated need once", () => {
        assert.equal(needCoverage(["React", "react"], ["React"]), 1);
    });

    it("is NaN with no needs, so it is left out of averages", () => {
        assert.ok(Number.isNaN(needCoverage([], ["React"])));
    });
});

describe("contextDonors", () => {
    const ids = ["a", "b", "c", "d", "e"];

    it("never pairs someone with themselves", () => {
        const donors = contextDonors(ids, seededRandom(7));
        for (const id of ids) {
            assert.notEqual(donors.get(id), id);
        }
    });

    it("uses every context exactly once", () => {
        const donors = contextDonors(ids, seededRandom(7));
        assert.deepEqual([...donors.values()].sort(), [...ids].sort());
    });

    it("is reproducible for the same seed", () => {
        assert.deepEqual(contextDonors(ids, seededRandom(3)), contextDonors(ids, seededRandom(3)));
    });
});

describe("summariseExperiment", () => {
    const row = (lists: Record<string, string[]>, swapped: Record<string, string[]>): ExperimentRow => ({
        userId: "u",
        swappedWith: "v",
        lists,
        swapped,
        coverage: { A: 1, B: 0.5 }
    });

    it("measures agreement between variants and response to context", () => {
        const rows = [
            row(
                { A: ["x", "y"], B: ["x", "z"] },
                // A changes completely with a new context; B does not change.
                { A: ["p", "q"], B: ["x", "z"] }
            )
        ];
        const summary = summariseExperiment(rows, ["A", "B"], 2);

        assert.equal(summary.requesters, 1);
        assert.deepEqual(summary.agreement.map((pair) => [pair.first, pair.second, pair.overlap]), [
            ["A", "B", 0.5]
        ]);

        const [a, b] = summary.behaviour;
        assert.equal(a.sameAfterContextSwap, 0);
        assert.equal(b.sameAfterContextSwap, 1);
        assert.equal(a.needCoverage, 1);
        assert.equal(b.needCoverage, 0.5);
    });

    it("leaves requesters without needs out of the coverage average", () => {
        const rows: ExperimentRow[] = [
            { userId: "u1", swappedWith: "u2", lists: { A: ["x"] }, swapped: { A: ["x"] }, coverage: { A: 1 } },
            { userId: "u2", swappedWith: "u1", lists: { A: ["x"] }, swapped: { A: ["x"] }, coverage: { A: NaN } }
        ];
        assert.equal(summariseExperiment(rows, ["A"], 1).behaviour[0].needCoverage, 1);
    });
});