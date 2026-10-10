/**
 * Unit tests for the connection rules (positive and negative cases).
 * Run from web/:  npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    checkNewRequest,
    checkRemove,
    checkRespond,
    ConnectionState,
    RuleResult,
    toPairKey
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

describe("toPairKey", () => {
    it("is the same whichever user sent the request", () => {
        assert.equal(toPairKey(A, B), toPairKey(B, A));
    });

    it("differs for different pairs", () => {
        assert.notEqual(toPairKey(A, B), toPairKey(A, C));
    });
});

describe("checkNewRequest", () => {
    it("allows a first request", () => {
        assert.deepEqual(checkNewRequest(A, B, null), { ok: true });
    });

    it("allows a new request after a decline, from either person", () => {
        assert.deepEqual(checkNewRequest(A, B, record("declined")), { ok: true });
        assert.deepEqual(checkNewRequest(B, A, record("declined")), { ok: true });
    });

    it("rejects connecting with yourself", () => {
        denied(checkNewRequest(A, A, null), 400, "CANNOT_CONNECT_TO_SELF");
    });

    it("rejects a duplicate request", () => {
        denied(checkNewRequest(A, B, record("pending")), 409, "REQUEST_ALREADY_SENT");
    });

    it("rejects a request when the other person already sent one", () => {
        denied(checkNewRequest(B, A, record("pending")), 409, "INCOMING_REQUEST_EXISTS");
    });

    it("rejects a request between connected people", () => {
        denied(checkNewRequest(A, B, record("accepted")), 409, "ALREADY_CONNECTED");
        denied(checkNewRequest(B, A, record("accepted")), 409, "ALREADY_CONNECTED");
    });
});

describe("checkRespond", () => {
    it("lets the recipient answer a pending request", () => {
        assert.deepEqual(checkRespond(record("pending"), B), { ok: true });
    });

    it("does not let the requester answer their own request", () => {
        denied(checkRespond(record("pending"), A), 403, "NOT_RECIPIENT");
    });

    it("hides the request from anyone else", () => {
        denied(checkRespond(record("pending"), C), 404, "CONNECTION_NOT_FOUND");
    });

    it("rejects answering twice", () => {
        denied(checkRespond(record("accepted"), B), 409, "NOT_PENDING");
        denied(checkRespond(record("declined"), B), 409, "NOT_PENDING");
    });
});

describe("checkRemove", () => {
    it("lets the requester cancel a pending request", () => {
        assert.deepEqual(checkRemove(record("pending"), A), { ok: true });
    });

    it("lets either person remove an accepted connection", () => {
        assert.deepEqual(checkRemove(record("accepted"), A), { ok: true });
        assert.deepEqual(checkRemove(record("accepted"), B), { ok: true });
    });

    it("makes the recipient decline instead of deleting", () => {
        denied(checkRemove(record("pending"), B), 403, "NOT_REQUESTER");
    });

    it("hides the record from anyone else", () => {
        denied(checkRemove(record("accepted"), C), 404, "CONNECTION_NOT_FOUND");
    });

    it("treats declined records as not found", () => {
        denied(checkRemove(record("declined"), A), 404, "CONNECTION_NOT_FOUND");
    });
});