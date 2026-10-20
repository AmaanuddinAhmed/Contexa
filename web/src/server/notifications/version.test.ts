/**
 * Unit tests for the connections version (positive and negative cases).
 * Run from web/:  npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toConnectionsVersion } from "./version";

describe("toConnectionsVersion", () => {
    const at = new Date("2026-10-20T10:00:00Z");

    it("is stable when nothing changed", () => {
        assert.equal(toConnectionsVersion(3, at), toConnectionsVersion(3, new Date(at)));
    });

    it("changes when a request is accepted or declined (newer update)", () => {
        assert.notEqual(toConnectionsVersion(3, at), toConnectionsVersion(3, new Date(at.getTime() + 1)));
    });

    it("changes when a connection is added or removed", () => {
        assert.notEqual(toConnectionsVersion(3, at), toConnectionsVersion(4, at));
        assert.notEqual(toConnectionsVersion(3, at), toConnectionsVersion(2, at));
    });

    it("handles a user with no connections", () => {
        assert.equal(toConnectionsVersion(0, null), "0:0");
    });
});