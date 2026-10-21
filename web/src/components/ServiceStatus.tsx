"use client";

import { useState } from "react";
import { describeServiceStatus } from "@/lib/warm";

interface Status {
  awake: boolean;
  ms: number;
}

/** Admin card: check (and wake) the recommendation service before a demo. */
export default function ServiceStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const check = async () => {
    setChecking(true);
    setError("");

    try {
      const response = await fetch("/api/v1/warm", { method: "POST" });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error?.message || "Unable to check the service.");
      }

      setStatus(body.data);
    } catch (checkError) {
      setError(
        checkError instanceof Error
          ? checkError.message
          : "Unable to check the service.",
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-lift)] ring-1 ring-line/70">
      <div className="min-w-0">
        <p className="font-semibold">Recommendation service</p>
        <p className="mt-0.5 text-sm text-muted" aria-live="polite">
          {checking ? (
            "Checking (up to a minute if it was asleep)…"
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : status ? (
            <span className={status.awake ? "text-ok" : "text-danger"}>
              {describeServiceStatus(status)}
            </span>
          ) : (
            "Free hosting sleeps after 15 idle minutes. Wake it before a demo."
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={check}
        disabled={checking}
        className="btn btn-quiet shrink-0"
      >
        {checking ? "Checking" : "Check and wake"}
      </button>
    </div>
  );
}
