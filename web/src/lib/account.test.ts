import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkDeleteRequest, DELETE_CONFIRMATION } from "./account";

describe("checkDeleteRequest", () => {
    it("asks a password account to check its password", () => {
        assert.deepEqual(checkDeleteRequest(true, { password: "secret123" }), {
            ok: true,
            needsPasswordCheck: true
        });
    });

    it("refuses a password account with no password", () => {
        const result = checkDeleteRequest(true, { confirm: DELETE_CONFIRMATION });
        assert.equal(result.ok, false);
        assert.equal(!result.ok && result.code, "PASSWORD_REQUIRED");
    });

    it("accepts a Google-only account that typed the confirmation", () => {
        assert.deepEqual(checkDeleteRequest(false, { confirm: DELETE_CONFIRMATION }), {
            ok: true,
            needsPasswordCheck: false
        });
    });

    it("refuses a Google-only account with the wrong confirmation", () => {
        for (const confirm of [undefined, "", "delete", "DELETE "]) {
            const result = checkDeleteRequest(false, { confirm });
            assert.equal(result.ok, false);
            assert.equal(!result.ok && result.code, "CONFIRMATION_REQUIRED");
        }
    });
});