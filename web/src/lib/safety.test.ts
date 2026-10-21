/**
 * Unit tests for block and report rules (positive and negative cases).
 * Run from web/:  npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    checkSafetyTarget,
    hiddenUserIds,
    otherPartyOf,
    REPORT_REASON_LABELS,
    REPORT_REASONS
} from "./safety";

const A = "a".repeat(24);
const B = "b".repeat(24);
const C = "c".repeat(24);

describe("checkSafetyTarget", () => {
    it("allows blocking or reporting someone else", () => {
        assert.deepEqual(checkSafetyTarget(A, B), { ok: true });
    });

    it("refuses blocking or reporting yourself", () => {
        const result = checkSafetyTarget(A, A);
        assert.equal(result.ok, false);
        assert.equal(!result.ok && result.code, "CANNOT_TARGET_SELF");
        assert.equal(!result.ok && result.status, 400);
    });
});

describe("hiddenUserIds", () => {
    it("hides people you blocked", () => {
        assert.deepEqual(hiddenUserIds([{ blockerId: A, blockedId: B }], A), [B]);
    });

    it("hides people who blocked you", () => {
        assert.deepEqual(hiddenUserIds([{ blockerId: C, blockedId: A }], A), [C]);
    });

    it("lists a person once when both blocked each other", () => {
        assert.deepEqual(
            hiddenUserIds(
                [
                    { blockerId: A, blockedId: B },
                    { blockerId: B, blockedId: A }
                ],
                A
            ),
            [B]
        );
    });

    it("hides nobody when there are no blocks", () => {
        assert.deepEqual(hiddenUserIds([], A), []);
    });
});

describe("otherPartyOf", () => {
    it("returns the other person from either side", () => {
        assert.equal(otherPartyOf({ blockerId: A, blockedId: B }, A), B);
        assert.equal(otherPartyOf({ blockerId: A, blockedId: B }, B), A);
    });
});

describe("report reasons", () => {
    it("has a label for every reason", () => {
        for (const reason of REPORT_REASONS) {
            assert.ok(REPORT_REASON_LABELS[reason].length > 0);
        }
    });
});