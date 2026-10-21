/**
 * Delete-account rules. Pure functions only (no database), so they can be
 * unit tested and shared with the browser.
 *
 * Accounts with a password must re-enter it. Google-only accounts have no
 * password, so they type DELETE_CONFIRMATION instead.
 */

export const DELETE_CONFIRMATION = "DELETE";

export type DeleteCheck =
    | { ok: true; needsPasswordCheck: boolean }
    | { ok: false; status: number; code: string; message: string };

export const checkDeleteRequest = (
    hasPassword: boolean,
    input: { password?: string; confirm?: string }
): DeleteCheck => {
    if (hasPassword) {
        return input.password
            ? { ok: true, needsPasswordCheck: true }
            : { ok: false, status: 400, code: "PASSWORD_REQUIRED", message: "Enter your password to delete your account." };
    }

    return input.confirm === DELETE_CONFIRMATION
        ? { ok: true, needsPasswordCheck: false }
        : {
            ok: false,
            status: 400,
            code: "CONFIRMATION_REQUIRED",
            message: `Type ${DELETE_CONFIRMATION} to delete your account.`
        };
};