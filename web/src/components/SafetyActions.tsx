"use client";

import { useId, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { refreshNotifications } from "@/lib/notifications";
import {
  REPORT_DETAILS_MAX,
  REPORT_MESSAGES_KEPT,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  ReportReason,
} from "@/lib/safety";

type Step = "closed" | "choose" | "block" | "report";

export default function SafetyActions({
  userId,
  name,
  onDone,
  className = "",
  panelClassName = className,
}: {
  userId: string;
  name: string;
  onDone: () => void;
  className?: string;
  panelClassName?: string;
}) {
  const [step, setStep] = useState<Step>("closed");
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formId = useId();

  const close = () => {
    setStep("closed");
    setReason("");
    setDetails("");
    setError("");
  };

  const submit = async (endpoint: "/blocks" | "/reports", body: object) => {
    setBusy(true);
    setError("");

    try {
      await api(endpoint, {
        method: "POST",
        token: getToken() ?? undefined,
        body: JSON.stringify(body),
      });
      close();
      refreshNotifications();
      onDone();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (step === "closed") {
    return (
      <button
        type="button"
        onClick={() => setStep("choose")}
        className={`text-sm font-medium text-muted underline-offset-4 hover:text-danger hover:underline ${className}`}
      >
        Block or report
      </button>
    );
  }

  const cancel = (
    <button
      type="button"
      onClick={close}
      disabled={busy}
      className="btn btn-quiet"
    >
      Cancel
    </button>
  );

  return (
    <div
      className={`animate-fade rounded-2xl bg-danger-soft p-3 text-left ${panelClassName}`}
    >
      {step === "choose" && (
        <>
          <p className="text-sm text-ink">
            What would you like to do about {name}?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep("block")}
              className="btn btn-quiet"
            >
              Block
            </button>
            <button
              type="button"
              onClick={() => setStep("report")}
              className="btn btn-quiet"
            >
              Report
            </button>
            {cancel}
          </div>
        </>
      )}

      {step === "block" && (
        <>
          <p className="text-sm text-danger">
            Block {name}? You won&apos;t see each other in matches, neither of
            you can send a request, and any connection and messages between you
            are removed. They aren&apos;t told.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => submit("/blocks", { userId })}
              className="btn bg-danger text-white hover:bg-danger/90"
            >
              {busy ? "Blocking" : "Block"}
            </button>
            {cancel}
          </div>
        </>
      )}

      {step === "report" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (reason) {
              void submit("/reports", {
                userId,
                reason,
                details: details.trim() || undefined,
              });
            }
          }}
        >
          <fieldset>
            <legend className="text-sm font-semibold text-ink">
              Why are you reporting {name}?
            </legend>
            <div className="mt-2 grid gap-1.5">
              {REPORT_REASONS.map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`${formId}-reason`}
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="accent-danger"
                  />
                  {REPORT_REASON_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>

          <label
            htmlFor={`${formId}-details`}
            className="mt-3 block text-sm font-semibold text-ink"
          >
            Details <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id={`${formId}-details`}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={REPORT_DETAILS_MAX}
            rows={3}
            className="mt-1 w-full rounded-xl bg-surface p-2.5 text-sm ring-1 ring-line focus:ring-2 focus:ring-brand focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted">
            Reporting also blocks them. If you&apos;ve been messaging, your last{" "}
            {REPORT_MESSAGES_KEPT} messages with them are included for review.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !reason}
              className="btn bg-danger text-white hover:bg-danger/90 disabled:opacity-50"
            >
              {busy ? "Sending" : "Report and block"}
            </button>
            {cancel}
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="alert-error mt-3">
          {error}
        </p>
      )}
    </div>
  );
}
