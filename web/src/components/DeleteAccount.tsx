"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { DELETE_CONFIRMATION } from "@/lib/account";
import { clearToken, getToken } from "@/lib/auth";
import { clearNotifications } from "@/lib/notifications";

interface AccountResponse {
  data: { email: string; hasPassword: boolean };
}

/** "Delete account" section: asks for the password (or DELETE for Google-only accounts). */
export default function DeleteAccount() {
  const [account, setAccount] = useState<AccountResponse["data"] | null>(null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fieldId = useId();

  useEffect(() => {
    let cancelled = false;

    api<AccountResponse>("/account", { token: getToken() ?? undefined })
      .then((response) => {
        if (!cancelled) setAccount(response.data);
      })
      .catch(() => {
        // Without it the section stays hidden; nothing else depends on it.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!account) {
    return null;
  }

  const ready = account.hasPassword
    ? password.length > 0
    : confirm === DELETE_CONFIRMATION;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api("/account", {
        method: "DELETE",
        token: getToken() ?? undefined,
        body: JSON.stringify(account.hasPassword ? { password } : { confirm }),
      });
      // Full page load: clears all page state, and leaves this protected
      // page before the logged-out guard can send us to /login.
      window.location.replace("/");
      clearNotifications();
      clearToken();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete your account.",
      );
      setBusy(false);
    }
  };

  const close = () => {
    setOpen(false);
    setPassword("");
    setConfirm("");
    setError("");
  };

  return (
    <section
      className="panel mt-6 animate-rise ring-1 ring-danger/30 sm:p-9"
      aria-labelledby="delete-heading"
    >
      <h2 id="delete-heading" className="text-xl font-semibold">
        Delete account
      </h2>
      <p className="mt-1 text-sm text-muted">
        Permanently deletes {account.email}: your profile, context, picture, map
        area, connections, messages and blocks. Ratings you already gave are
        kept without your name so the study results stay complete. This
        can&apos;t be undone.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-quiet mt-5 text-danger"
        >
          Delete my account
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-5 animate-fade rounded-2xl bg-danger-soft p-4"
        >
          {account.hasPassword ? (
            <>
              <label htmlFor={fieldId} className="label">
                Enter your password to confirm
              </label>
              <input
                id={fieldId}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field"
              />
            </>
          ) : (
            <>
              <label htmlFor={fieldId} className="label">
                Type {DELETE_CONFIRMATION} to confirm
              </label>
              <input
                id={fieldId}
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="field"
              />
            </>
          )}

          {error && (
            <p role="alert" className="alert-error mt-3">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !ready}
              className="btn bg-danger text-white hover:bg-danger/90 disabled:opacity-50"
            >
              {busy ? "Deleting" : "Delete permanently"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="btn btn-quiet"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
