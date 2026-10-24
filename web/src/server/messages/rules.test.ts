import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConnectionState, RuleResult } from "@/server/connections/rules";
import {
    checkCanMessage,
    checkRateLimit,
    MESSAGE_RATE_LIMIT,
    otherParticipant
} from "./rules";

const A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const C = "cccccccccccccccccccccccc";

const record = (status: ConnectionState["status"]): ConnectionState => ({
    requesterId: A,
    recipientId: B,
    status
});

const denied = (result: RuleResult, status: number, code: string) => {
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.status, status);
        assert.equal(result.code, code);
    }
};

describe("checkCanMessage", () => {
    it("lets both people in an accepted connection message", () => {
        assert.deepEqual(checkCanMessage(record("accepted"), A), { ok: true });
        assert.deepEqual(checkCanMessage(record("accepted"), B), { ok: true });
    });

    it("rejects messaging before the request is accepted", () => {
        denied(checkCanMessage(record("pending"), A), 403, "NOT_CONNECTED");
        denied(checkCanMessage(record("pending"), B), 403, "NOT_CONNECTED");
    });

    it("hides declined connections", () => {
        denied(checkCanMessage(record("declined"), A), 404, "CONVERSATION_NOT_FOUND");
    });

    it("hides the conversation from anyone else", () => {
        denied(checkCanMessage(record("accepted"), C), 404, "CONVERSATION_NOT_FOUND");
    });

    it("treats a missing or removed connection as not found", () => {
        denied(checkCanMessage(null, A), 404, "CONVERSATION_NOT_FOUND");
    });
});

describe("otherParticipant", () => {
    it("returns the other person from either side", () => {
        assert.equal(otherParticipant(record("accepted"), A), B);
        assert.equal(otherParticipant(record("accepted"), B), A);
    });
});

describe("checkRateLimit", () => {
    it("allows sending under the limit", () => {
        assert.deepEqual(checkRateLimit(0), { ok: true });
        assert.deepEqual(checkRateLimit(MESSAGE_RATE_LIMIT.max - 1), { ok: true });
    });

    it("rejects sending at the limit", () => {
        denied(checkRateLimit(MESSAGE_RATE_LIMIT.max), 429, "TOO_MANY_MESSAGES");
    });
});