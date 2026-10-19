"use client";

import Link from "next/link";
import type { ConnectionState } from "@/lib/connections";

export interface Recommendation {
  userId: string;
  profile: {
    name: string;
    bio?: string;
    education?: string;
    role?: string;
    experienceLevel?: string;
    skills: string[];
    interests: string[];
    collaborationPreferences?: string[];
  };
  score: number;
  // PROFILE_ONLY returns skills/interests/experience/collaborationPreferences;
  // CONTEXT_AWARE returns profile/need/activity/availability/... factors.
  breakdown: Record<string, number>;
  // Why this person was recommended, strongest factor first.
  reasons: { code: string; text: string; items: string[] }[];
}

const FACTOR_NAMES: Record<string, string> = {
  profile: "Profile",
  need: "Shared needs",
  activity: "Activity",
  availability: "Availability",
  interactionPreference: "Meeting preference",
  needFulfillmentA: "They cover your needs",
  needFulfillmentB: "You cover their needs",
  complementarity: "Complementarity",
  skills: "Skills",
  interests: "Interests",
  experience: "Experience",
  collaborationPreferences: "Collaboration style",
};

const formatFactorName = (factor: string) => FACTOR_NAMES[factor] || factor;
const percent = (value: number) =>
  Math.round(Math.min(Math.max(value, 0), 1) * 100);

/** Avatar tints, picked from the name so a person keeps theirs. */
const TINTS = [
  "bg-brand-soft text-brand-ink",
  "bg-signal-soft text-signal-ink",
  "bg-ok-soft text-ok",
  "bg-ink text-white",
  "bg-[#ffe4ec] text-[#9b1c47]",
];

const tintFor = (name: string) => {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-9 w-9 rounded-xl text-xs",
    md: "h-12 w-12 rounded-2xl text-sm",
    lg: "h-16 w-16 rounded-[1.35rem] text-lg",
  };

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center font-display font-semibold ${sizes[size]} ${tintFor(name)}`}
    >
      {initials(name) || "?"}
    </span>
  );
}

function ScoreRing({
  score,
  delayMs,
  large,
}: {
  score: number;
  delayMs: number;
  large?: boolean;
}) {
  const radius = 26;
  const length = 2 * Math.PI * radius;
  const value = percent(score);

  return (
    <div
      className={`relative shrink-0 ${large ? "h-[4.5rem] w-[4.5rem] md:h-24 md:w-24" : "h-[4.5rem] w-[4.5rem]"}`}
    >
      <svg
        viewBox="0 0 64 64"
        className="h-full w-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#e7e9f1"
          strokeWidth="6"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#3352ff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - value / 100)}
          style={
            {
              "--ring-length": length,
              animation: `ring-fill 1.1s var(--ease-out-quint) ${delayMs + 200}ms both`,
            } as React.CSSProperties
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className={`font-display font-semibold tabular-nums ${large ? "text-lg md:text-2xl" : "text-lg"}`}
        >
          {value}
          <span className="text-[0.6em] text-muted">%</span>
        </span>
        <span className="mt-0.5 text-[0.65rem] text-faint">match</span>
      </div>
    </div>
  );
}

/** Need reasons are directional: who helps whom. */
function ReasonIcon({ code }: { code: string }) {
  if (code === "THEY_MEET_YOUR_NEEDS" || code === "YOU_MEET_THEIR_NEEDS") {
    const towardYou = code === "THEY_MEET_YOUR_NEEDS";

    return (
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-signal text-ink"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 ${towardYou ? "rotate-180" : ""}`}
          fill="none"
        >
          <path
            d="M3 8h9M8.5 4.5L12 8l-3.5 3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
        <circle cx="6" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
        <circle
          cx="10"
          cy="8"
          r="3.2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}

function ConnectControl({
  state,
  busy,
  error,
  onConnect,
}: {
  state: ConnectionState;
  busy: boolean;
  error?: string;
  onConnect: () => void;
}) {
  return (
    <div className="mt-6">
      {state === "connected" && (
        <Link href="/messages" className="btn btn-quiet w-full">
          <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
          Connected: send a message
        </Link>
      )}

      {state === "outgoing" && (
        <p className="btn w-full cursor-default bg-sunk text-muted ring-1 ring-line">
          Request sent
        </p>
      )}

      {state === "incoming" && (
        <Link href="/connections" className="btn btn-ink w-full">
          They asked to connect: respond
        </Link>
      )}

      {state === "none" && (
        <button
          type="button"
          onClick={onConnect}
          disabled={busy}
          className="btn btn-primary w-full"
        >
          {busy ? "Sending request" : "Connect"}
        </button>
      )}

      {error && (
        <p role="alert" className="alert-error mt-2">
          {error}
        </p>
      )}
    </div>
  );
}

export default function MatchCard({
  recommendation,
  rank,
  featured,
  connectionState,
  busy,
  error,
  onConnect,
}: {
  recommendation: Recommendation;
  rank: number;
  featured: boolean;
  connectionState: ConnectionState;
  busy: boolean;
  error?: string;
  onConnect: () => void;
}) {
  const { profile, score, breakdown, reasons } = recommendation;
  const delayMs = Math.min(rank - 1, 8) * 70;
  const subtitle = [profile.role, profile.education].filter(Boolean).join(", ");

  const identity = (
    <div className="flex items-start gap-4">
      <Avatar name={profile.name} size={featured ? "lg" : "md"} />
      <div className="min-w-0 flex-1">
        <h2
          className={`font-display leading-tight font-semibold ${featured ? "text-2xl sm:text-3xl" : "text-xl"}`}
        >
          {profile.name}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {subtitle || "Role not given"}
        </p>
        {profile.experienceLevel && (
          <p className="mt-2 inline-flex rounded-md bg-sunk px-2 py-0.5 text-xs text-muted">
            {profile.experienceLevel}
          </p>
        )}
      </div>
      <ScoreRing score={score} delayMs={delayMs} large={featured} />
    </div>
  );

  const why = (
    <div className={featured ? "" : "mt-5"}>
      <h3 className="mb-3 font-sans text-sm font-semibold tracking-normal text-ink-soft">
        Why you two
      </h3>
      {reasons.length > 0 ? (
        <ul className="space-y-2.5">
          {reasons.map((reason) => (
            <li
              key={reason.code}
              className="flex gap-3 text-sm leading-6 text-ink-soft"
            >
              <ReasonIcon code={reason.code} />
              <span>{reason.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-muted">
          Nothing specific overlaps; this person is ranked on their overall
          score.
        </p>
      )}
    </div>
  );

  const details = (
    <>
      {profile.bio && (
        <p className={`text-sm leading-6 text-muted ${featured ? "" : "mt-5"}`}>
          {profile.bio}
        </p>
      )}

      {profile.skills.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 font-sans text-xs font-medium tracking-normal text-faint">
            Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <span key={skill} className="chip">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.interests.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-sans text-xs font-medium tracking-normal text-faint">
            Interests
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {profile.interests.map((interest) => (
              <span key={interest} className="chip-outline">
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      <details className="group mt-5 rounded-2xl bg-sunk open:pb-4">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-ink-soft transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
          How the score adds up
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4 text-faint transition-transform duration-300 group-open:rotate-180"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <dl className="grid gap-x-5 gap-y-3 px-4 sm:grid-cols-2">
          {Object.entries(breakdown).map(([factor, value]) => (
            <div key={factor}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <dt className="text-muted">{formatFactorName(factor)}</dt>
                <dd className="font-semibold tabular-nums">
                  {percent(value)}%
                </dd>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/70">
                <div
                  className={`h-full origin-left rounded-full group-open:[animation:bar-fill_0.8s_var(--ease-out-quint)_both] ${
                    factor.startsWith("needFulfillment")
                      ? "bg-signal"
                      : "bg-brand"
                  }`}
                  style={{ width: `${percent(value)}%` }}
                />
              </div>
            </div>
          ))}
        </dl>
      </details>
    </>
  );

  return (
    <article
      style={{ animationDelay: `${delayMs}ms` }}
      className={`relative flex animate-rise flex-col rounded-[1.75rem] bg-surface p-5 shadow-[var(--shadow-lift)] ring-1 ring-line/70 transition-shadow duration-300 hover:shadow-[var(--shadow-float)] sm:p-6 ${
        featured ? "md:col-span-2 md:p-8" : ""
      }`}
    >
      <span
        className={`mb-4 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
          featured ? "bg-ink text-white" : "bg-sunk text-muted"
        }`}
      >
        {featured && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-signal"
            aria-hidden="true"
          />
        )}
        {featured ? "Top match" : `No. ${rank}`}
      </span>

      {featured ? (
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <div className="flex flex-col gap-7">
            {identity}
            {why}
          </div>
          <div className="flex flex-col">
            {details}
            <div className="mt-auto">
              <ConnectControl
                state={connectionState}
                busy={busy}
                error={error}
                onConnect={onConnect}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          {identity}
          {why}
          {details}
          <div className="mt-auto">
            <ConnectControl
              state={connectionState}
              busy={busy}
              error={error}
              onConnect={onConnect}
            />
          </div>
        </>
      )}
    </article>
  );
}
