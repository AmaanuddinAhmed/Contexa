import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMatcher, toVariantId } from "./modes";

describe("toVariantId", () => {
    it("keeps the bare mode name for EXACT, so older records stay valid", () => {
        assert.equal(toVariantId("CONTEXT_AWARE", "EXACT"), "CONTEXT_AWARE");
        assert.equal(toVariantId("PROFILE_ONLY", "EXACT"), "PROFILE_ONLY");
    });

    it("suffixes SEMANTIC variants", () => {
        assert.equal(toVariantId("CONTEXT_AWARE", "SEMANTIC"), "CONTEXT_AWARE:SEMANTIC");
        assert.equal(toVariantId("PROFILE_ONLY", "SEMANTIC"), "PROFILE_ONLY:SEMANTIC");
    });

    it("gives four distinct ids", () => {
        const ids = new Set(
            (["PROFILE_ONLY", "CONTEXT_AWARE"] as const).flatMap((mode) =>
                (["EXACT", "SEMANTIC"] as const).map((matcher) => toVariantId(mode, matcher))
            )
        );
        assert.equal(ids.size, 4);
    });
});

describe("isMatcher", () => {
    it("accepts the two matchers", () => {
        assert.ok(isMatcher("EXACT"));
        assert.ok(isMatcher("SEMANTIC"));
    });

    it("rejects anything else", () => {
        assert.ok(!isMatcher("exact"));
        assert.ok(!isMatcher("FUZZY"));
        assert.ok(!isMatcher(""));
    });
});