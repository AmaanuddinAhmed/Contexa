"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

// ---------- shapes returned by /api/v1/admin/* ----------

interface VariantSummary {
  variant: string;
  rounds: number;
  meanRating: number | null;
  precision: number | null;
  ndcg: number | null;
  ndcgInterval: [number | null, number | null];
}

interface Comparison {
  variant: string;
  baseline: string;
  rounds: number;
  meanDifference: number | null;
  interval: [number | null, number | null];
  wins: number;
  ties: number;
  losses: number;
  verdict:
    | "INSUFFICIENT_DATA"
    | "NO_CLEAR_DIFFERENCE"
    | "VARIANT_BETTER"
    | "BASELINE_BETTER";
}

interface ConnectionOutcome {
  variant: string;
  sent: number;
  accepted: number;
  declined: number;
  pending: number;
  acceptanceRate: number | null;
}

interface Dashboard {
  overview: Record<string, number>;
  feedback: {
    relevantRating: number;
    minRoundsToInterpret: number;
    variants: VariantSummary[];
    comparisons: Comparison[];
  };
  connections: ConnectionOutcome[];
}

interface ExperimentRun {
  _id: string;
  name: string;
  status: "running" | "completed" | "failed";
  params: { k: number; population: string; seed: number; variants: string[] };
  summary?: {
    requesters: number;
    agreement: {
      first: string;
      second: string;
      overlap: number | null;
      rbo: number | null;
    }[];
    behaviour: {
      variant: string;
      sameAfterContextSwap: number | null;
      rboAfterContextSwap: number | null;
      needCoverage: number | null;
    }[];
  };
  notes: string[];
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// ---------- formatting ----------

// NaN becomes null in JSON; both mean "no data".
const isNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const fixed = (value: number | null | undefined, digits = 2) =>
  isNumber(value) ? value.toFixed(digits) : "–";

const percent = (value: number | null | undefined) =>
  isNumber(value) ? `${Math.round(value * 100)}%` : "–";

const signed = (value: number | null | undefined) =>
  isNumber(value) ? `${value > 0 ? "+" : ""}${value.toFixed(3)}` : "–";

const VARIANT_NAMES: Record<string, string> = {
  PROFILE_ONLY: "Profile only · Exact",
  "PROFILE_ONLY:SEMANTIC": "Profile only · Semantic",
  CONTEXT_AWARE: "Context-aware · Exact",
  "CONTEXT_AWARE:SEMANTIC": "Context-aware · Semantic",
};

const variantName = (variant: string) => VARIANT_NAMES[variant] ?? variant;

const OVERVIEW_TILES: { key: string; label: string }[] = [
  { key: "realUsers", label: "Real users" },
  { key: "syntheticUsers", label: "Synthetic users" },
  { key: "currentContexts", label: "Current contexts" },
  { key: "connectionsAccepted", label: "Connections" },
  { key: "connectionsPending", label: "Pending requests" },
  { key: "messages", label: "Messages" },
  { key: "roundsCompleted", label: "Rating rounds done" },
  { key: "raters", label: "People who rated" },
];

// ---------- small pieces ----------

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="mt-14 first:mt-0">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          {description && (
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Table({
  headers,
  rows,
  empty,
}: {
  headers: { label: string; align?: "right" }[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-[1.5rem] border border-dashed border-line-strong px-5 py-6 text-sm text-muted">
        {empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[1.5rem] bg-surface shadow-[var(--shadow-lift)] ring-1 ring-line/70">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-sunk text-xs text-muted">
          <tr>
            {headers.map((header) => (
              <th
                key={header.label}
                scope="col"
                className={`px-4 py-3 font-medium ${header.align === "right" ? "text-right" : ""}`}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex} className="transition-colors hover:bg-sunk/60">
              {cells.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-4 py-3.5 text-ink-soft ${
                    headers[cellIndex]?.align === "right"
                      ? "text-right tabular-nums"
                      : ""
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A 0-1 value as a number with a thin bar behind it (one series, no colour coding). */
function Meter({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="flex items-center justify-end gap-3" title={label}>
      <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-line/70 sm:block">
        {isNumber(value) && (
          <div
            className="h-full origin-left rounded-full bg-brand [animation:bar-fill_0.9s_var(--ease-out-quint)_both]"
            style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
          />
        )}
      </div>
      <span className="w-12 text-right font-medium tabular-nums">
        {fixed(value)}
      </span>
    </div>
  );
}

function Verdict({
  comparison,
  minRounds,
}: {
  comparison: Comparison;
  minRounds: number;
}) {
  const text = {
    INSUFFICIENT_DATA: `Too few rounds (need ${minRounds})`,
    NO_CLEAR_DIFFERENCE: "No clear difference",
    VARIANT_BETTER: `${variantName(comparison.variant)} rated higher`,
    BASELINE_BETTER: `${variantName(comparison.baseline)} rated higher`,
  }[comparison.verdict];

  const icon = {
    INSUFFICIENT_DATA: "…",
    NO_CLEAR_DIFFERENCE: "=",
    VARIANT_BETTER: "▲",
    BASELINE_BETTER: "▼",
  }[comparison.verdict];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
        comparison.verdict === "INSUFFICIENT_DATA"
          ? "bg-sunk text-muted ring-1 ring-line"
          : comparison.verdict === "NO_CLEAR_DIFFERENCE"
            ? "bg-surface text-ink-soft ring-1 ring-line-strong"
            : "bg-brand-soft text-brand-ink"
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      {text}
    </span>
  );
}

function ExperimentDetails({ run }: { run: ExperimentRun }) {
  const { summary } = run;

  if (!summary) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2.5 font-sans text-sm font-semibold tracking-normal text-ink-soft">
          How much the variants agree (top {run.params.k})
        </h3>
        <Table
          headers={[
            { label: "Variant" },
            { label: "Compared with" },
            { label: "Same people", align: "right" },
            { label: "Rank-biased overlap", align: "right" },
          ]}
          rows={summary.agreement.map((pair) => [
            variantName(pair.first),
            variantName(pair.second),
            percent(pair.overlap),
            percent(pair.rbo),
          ])}
          empty="No comparisons."
        />
      </div>

      <div>
        <h3 className="mb-2.5 font-sans text-sm font-semibold tracking-normal text-ink-soft">
          Response to context (same profile, another user&apos;s context)
        </h3>
        <Table
          headers={[
            { label: "Variant" },
            { label: "Unchanged after context swap", align: "right" },
            { label: "Needs covered by top " + run.params.k, align: "right" },
          ]}
          rows={summary.behaviour.map((variant) => [
            variantName(variant.variant),
            percent(variant.sameAfterContextSwap),
            percent(variant.needCoverage),
          ])}
          empty="No variants."
        />
      </div>

      {run.notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-muted">
          {run.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- page ----------

type Loaded =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; dashboard: Dashboard; experiments: ExperimentRun[] };

export default function AdminPage() {
  const [state, setState] = useState<Loaded>({ status: "loading" });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const token = getToken() ?? undefined;

    Promise.all([
      api<{ data: Dashboard }>("/admin/dashboard", { token }),
      api<{ data: { experiments: ExperimentRun[] } }>("/admin/experiments", {
        token,
      }),
    ])
      .then(([dashboard, experiments]) => {
        if (!cancelled) {
          setState({
            status: "ready",
            dashboard: dashboard.data,
            experiments: experiments.data.experiments,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to load the dashboard.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const downloadCsv = async () => {
    setExporting(true);
    setExportError("");

    try {
      // The session cookie authenticates the download.
      const response = await fetch("/api/v1/admin/export", {
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Unable to export feedback.");
      }

      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `contexa-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Unable to export feedback.",
      );
    } finally {
      setExporting(false);
    }
  };

  if (state.status === "loading") {
    return (
      <main className="page">
        <div className="skeleton h-12 w-64" />
        <div
          className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4"
          aria-busy="true"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="skeleton h-28 rounded-[1.5rem]" />
          ))}
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="page flex items-center justify-center">
        <section className="panel w-full max-w-md animate-rise text-center">
          <h1 className="font-display text-2xl font-semibold">
            Dashboard unavailable
          </h1>
          <p className="mt-3 text-muted">{state.message}</p>
        </section>
      </main>
    );
  }

  const { dashboard, experiments } = state;
  const { feedback } = dashboard;
  const latest = experiments.find((run) => run.status === "completed");

  return (
    <main className="page">
      <div>
        <h1 className="page-title">Evaluation</h1>
        <p className="page-lede">
          Does adding context make people recommendations more relevant? Real
          evidence comes from blind ratings; synthetic experiments show how the
          system behaves.
        </p>

        <Section title="Overview">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {OVERVIEW_TILES.map((tile, index) => (
              <div
                key={tile.key}
                style={{ animationDelay: `${index * 40}ms` }}
                className="animate-rise rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-lift)] ring-1 ring-line/70"
              >
                <p className="font-display text-4xl font-semibold tabular-nums">
                  {dashboard.overview[tile.key] ?? 0}
                </p>
                <p className="mt-1 text-sm text-muted">{tile.label}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Blind ratings by variant"
          description={
            <>
              Each round, a user rates a shuffled pool built from every
              variant&apos;s top picks, without knowing which variant chose
              whom. Precision counts ratings of {feedback.relevantRating} or 5
              as relevant; NDCG compares each variant&apos;s order with the best
              possible order from the same pool (1 = best). Brackets show 95%
              bootstrap intervals.
            </>
          }
          action={
            <div className="text-right">
              <button
                type="button"
                onClick={downloadCsv}
                disabled={exporting || dashboard.overview.roundsCompleted === 0}
                className="btn btn-quiet"
              >
                {exporting ? "Exporting…" : "Export ratings (CSV)"}
              </button>
              {exportError && (
                <p role="alert" className="mt-1 text-xs text-danger">
                  {exportError}
                </p>
              )}
            </div>
          }
        >
          <Table
            headers={[
              { label: "Variant" },
              { label: "Rounds", align: "right" },
              { label: "Mean rating (1–5)", align: "right" },
              { label: "Precision", align: "right" },
              { label: "NDCG", align: "right" },
              { label: "95% interval", align: "right" },
            ]}
            rows={
              dashboard.overview.roundsCompleted === 0
                ? []
                : feedback.variants.map((variant) => [
                    variantName(variant.variant),
                    variant.rounds,
                    fixed(variant.meanRating),
                    percent(variant.precision),
                    <Meter
                      key="ndcg"
                      value={variant.ndcg}
                      label={`NDCG ${fixed(variant.ndcg, 3)}`}
                    />,
                    `[${fixed(variant.ndcgInterval[0])}, ${fixed(variant.ndcgInterval[1])}]`,
                  ])
            }
            empty="No completed rating rounds yet. They appear here as people use Rate matches."
          />
        </Section>

        <Section
          title="Paired comparisons"
          description={`NDCG difference on the rounds that contain both variants. A difference is called only when the 95% interval excludes zero and there are at least ${feedback.minRoundsToInterpret} paired rounds.`}
        >
          <Table
            headers={[
              { label: "Variant" },
              { label: "Baseline" },
              { label: "Rounds", align: "right" },
              { label: "Mean difference [95%]", align: "right" },
              { label: "Better / same / worse", align: "right" },
              { label: "Result" },
            ]}
            rows={feedback.comparisons.map((comparison) => [
              variantName(comparison.variant),
              variantName(comparison.baseline),
              comparison.rounds,
              `${signed(comparison.meanDifference)} [${signed(comparison.interval[0])}, ${signed(comparison.interval[1])}]`,
              `${comparison.wins} / ${comparison.ties} / ${comparison.losses}`,
              <Verdict
                key="verdict"
                comparison={comparison}
                minRounds={feedback.minRoundsToInterpret}
              />,
            ])}
            empty="No comparisons."
          />
        </Section>

        <Section
          title="Connection requests by variant"
          description="Requests sent from the Recommendations page, by the variant that showed the person. Acceptance rate counts answered requests only; removed connections and cancelled requests are no longer counted."
        >
          <Table
            headers={[
              { label: "Variant" },
              { label: "Sent", align: "right" },
              { label: "Accepted", align: "right" },
              { label: "Declined", align: "right" },
              { label: "Pending", align: "right" },
              { label: "Acceptance rate", align: "right" },
            ]}
            rows={dashboard.connections.map((outcome) => [
              variantName(outcome.variant),
              outcome.sent,
              outcome.accepted,
              outcome.declined,
              outcome.pending,
              percent(outcome.acceptanceRate),
            ])}
            empty="No connection requests yet."
          />
        </Section>

        <Section
          title="Synthetic experiment"
          description={
            <>
              Every synthetic user ranked under all four variants, with their
              own context and with another user&apos;s. Run from the{" "}
              <code>web</code> folder with{" "}
              <code className="rounded-md bg-sunk px-1.5 py-0.5 text-ink ring-1 ring-line">
                npm run experiment
              </code>
              .
            </>
          }
        >
          {latest ? (
            <div className="panel">
              <p className="mb-6 text-sm text-muted">
                <span className="font-semibold text-ink">{latest.name}</span> ·{" "}
                {latest.summary?.requesters ?? 0} requesters · K ={" "}
                {latest.params.k} · seed {latest.params.seed} ·{" "}
                {new Date(
                  latest.completedAt ?? latest.startedAt,
                ).toLocaleString()}
              </p>
              <ExperimentDetails run={latest} />
            </div>
          ) : (
            <Table
              headers={[]}
              rows={[]}
              empty="No completed experiment yet."
            />
          )}

          {experiments.length > 1 && (
            <div className="mt-6">
              <h3 className="mb-2.5 font-sans text-sm font-semibold tracking-normal text-ink-soft">
                All runs
              </h3>
              <Table
                headers={[
                  { label: "Name" },
                  { label: "Status" },
                  { label: "K", align: "right" },
                  { label: "Requesters", align: "right" },
                  { label: "Started" },
                ]}
                rows={experiments.map((run) => [
                  run.name,
                  run.status === "failed"
                    ? `failed: ${run.error ?? "unknown error"}`
                    : run.status,
                  run.params.k,
                  run.summary?.requesters ?? "–",
                  new Date(run.startedAt).toLocaleString(),
                ])}
                empty="No runs."
              />
            </div>
          )}
        </Section>
      </div>
    </main>
  );
}
