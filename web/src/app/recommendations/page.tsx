"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  ConnectionState,
  ConnectionsResponse,
  toStateByUserId,
} from "@/lib/connections";

interface Recommendation {
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

type RecommendationMode = "PROFILE_ONLY" | "CONTEXT_AWARE";

const MODE_OPTIONS: {
  value: RecommendationMode;
  label: string;
  description: string;
}[] = [
  {
    value: "CONTEXT_AWARE",
    label: "Context-aware",
    description:
      "People ranked by your profile, your current context, and how well you meet each other's needs.",
  },
  {
    value: "PROFILE_ONLY",
    label: "Profile only",
    description:
      "Baseline: people ranked by profile similarity alone. Your current context is ignored.",
  },
];

interface RecommendationResponse {
  success: boolean;
  data: {
    mode: RecommendationMode;
    recommendations: Recommendation[];
    count: number;
    limit: number;
  };
}

const formatPercentage = (value: number) => `${Math.round(value * 100)}%`;

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
  const base =
    "mt-6 block w-full rounded-xl px-4 py-3 text-center text-sm font-medium transition";

  return (
    <>
      {state === "connected" && (
        <p className={`${base} bg-zinc-100 text-zinc-700`}>✓ Connected</p>
      )}

      {state === "outgoing" && (
        <p className={`${base} border border-zinc-200 text-zinc-500`}>
          Request sent
        </p>
      )}

      {state === "incoming" && (
        <Link
          href="/connections"
          className={`${base} border border-black text-black hover:bg-zinc-50`}
        >
          They sent you a request: respond
        </Link>
      )}

      {state === "none" && (
        <button
          type="button"
          onClick={onConnect}
          disabled={busy}
          className={`${base} bg-black text-white hover:bg-zinc-800 disabled:opacity-50`}
        >
          {busy ? "Sending..." : "Connect"}
        </button>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );
}

const formatFactorName = (factor: string) => {
  const names: Record<string, string> = {
    profile: "Profile",
    need: "Need",
    activity: "Activity",
    availability: "Availability",
    interactionPreference: "Interaction Preference",
    needFulfillmentA: "Need Fulfillment A",
    needFulfillmentB: "Need Fulfillment B",
    skills: "Skills",
    interests: "Interests",
    experience: "Experience",
    collaborationPreferences: "Collaboration Preferences",
  };

  return names[factor] || factor;
};

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [mode, setMode] = useState<RecommendationMode>("CONTEXT_AWARE");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [connectionStates, setConnectionStates] = useState<
    Map<string, ConnectionState>
  >(new Map());
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectErrors, setConnectErrors] = useState<Record<string, string>>(
    {},
  );

  const loadRecommendations = useCallback(async () => {
    const token = localStorage.getItem("contexa_token");

    if (!token) {
      setMessage("Please log in first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const [response, connections] = await Promise.all([
        api<RecommendationResponse>(`/recommendations?limit=10&mode=${mode}`, {
          token,
        }),
        // Connection states only drive the buttons, so a failure here
        // should not hide the recommendations.
        api<ConnectionsResponse>("/connections", { token }).catch(() => null),
      ]);

      setRecommendations(response.data.recommendations);
      setConnectionStates(
        connections ? toStateByUserId(connections.data) : new Map(),
      );
      setConnectErrors({});
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load recommendations.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode]);

  const sendConnectionRequest = async (
    recommendation: Recommendation,
    rank: number,
  ) => {
    const token = localStorage.getItem("contexa_token");

    if (!token) {
      return;
    }

    setConnectingId(recommendation.userId);
    setConnectErrors((errors) => ({ ...errors, [recommendation.userId]: "" }));

    try {
      await api("/connections", {
        method: "POST",
        token,
        body: JSON.stringify({
          recipientId: recommendation.userId,
          // Recorded for evaluation: which mode showed this person, and where.
          source: { mode, rank, score: recommendation.score },
        }),
      });

      setConnectionStates((states) =>
        new Map(states).set(recommendation.userId, "outgoing"),
      );
    } catch (error) {
      setConnectErrors((errors) => ({
        ...errors,
        [recommendation.userId]:
          error instanceof Error ? error.message : "Unable to send request.",
      }));
    } finally {
      setConnectingId(null);
    }
  };

  const activeMode =
    MODE_OPTIONS.find((option) => option.value === mode) ?? MODE_OPTIONS[0];

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  if (loading) {
    return (
      <main className="flex-1 bg-zinc-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <div className="h-9 w-72 animate-pulse rounded bg-zinc-200" />
            <div className="mt-3 h-5 w-96 animate-pulse rounded bg-zinc-200" />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-80 animate-pulse rounded-2xl bg-white p-6 shadow-sm"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (message) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900">
            Recommendations unavailable
          </h1>

          <p className="mt-3 text-zinc-600">{message}</p>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={loadRecommendations}
              className="rounded-xl bg-black px-5 py-3 font-medium text-white transition hover:bg-zinc-800"
            >
              Try Again
            </button>

            <Link
              href="/context"
              className="rounded-xl border border-zinc-200 px-5 py-3 font-medium text-zinc-900 transition hover:bg-zinc-50"
            >
              Update Context
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-zinc-50">
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-950">
              Your Recommendations
            </h1>

            <div
              role="group"
              aria-label="Matching mode"
              className="mt-5 inline-flex rounded-xl border border-zinc-200 bg-white p-1"
            >
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={mode === option.value}
                  onClick={() => setMode(option.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    mode === option.value
                      ? "bg-black text-white"
                      : "text-zinc-600 hover:text-black"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <p className="mt-3 max-w-2xl text-zinc-600">
              {activeMode.description}
            </p>
          </div>

          <button
            onClick={loadRecommendations}
            className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50"
          >
            Refresh
          </button>
        </div>

        {recommendations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
            <h2 className="text-xl font-semibold text-zinc-900">
              No recommendations yet
            </h2>

            <p className="mx-auto mt-3 max-w-md text-zinc-600">
              Make sure your profile is public and that you have an active
              context.
            </p>

            <Link
              href="/context"
              className="mt-6 inline-block rounded-xl bg-black px-5 py-3 font-medium text-white"
            >
              Update Context
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {recommendations.map((recommendation, index) => {
              const { profile, score, breakdown, reasons } = recommendation;

              return (
                <article
                  key={recommendation.userId}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-lg font-bold text-white">
                        {profile.name.charAt(0).toUpperCase()}
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                          #{index + 1} Recommendation
                        </p>

                        <h2 className="mt-1 text-xl font-bold text-zinc-950">
                          {profile.name}
                        </h2>

                        <p className="mt-1 text-sm text-zinc-500">
                          {profile.role || "Role not specified"}
                          {profile.education ? ` · ${profile.education}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold text-zinc-950">
                        {formatPercentage(score)}
                      </p>

                      <p className="text-xs text-zinc-500">compatibility</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-black transition-all"
                        style={{
                          width: `${Math.min(score * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl bg-zinc-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Why this match
                    </p>

                    {reasons.length > 0 ? (
                      <ul className="space-y-1.5">
                        {reasons.map((reason) => (
                          <li
                            key={reason.code}
                            className="flex gap-2 text-sm leading-6 text-zinc-700"
                          >
                            <span aria-hidden="true" className="text-zinc-400">
                              ✓
                            </span>
                            <span>{reason.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-zinc-500">
                        No specific overlap found. Ranked on overall score only.
                      </p>
                    )}
                  </div>

                  {profile.bio && (
                    <p className="mt-5 text-sm leading-6 text-zinc-600">
                      {profile.bio}
                    </p>
                  )}

                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Skills
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Interests
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {profile.interests.map((interest) => (
                        <span
                          key={interest}
                          className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-zinc-100 pt-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Compatibility factors
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(breakdown).map(([factor, value]) => (
                        <div key={factor} className="rounded-xl bg-zinc-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-zinc-500">
                              {formatFactorName(factor)}
                            </span>

                            <span className="text-xs font-semibold text-zinc-900">
                              {formatPercentage(value)}
                            </span>
                          </div>

                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200">
                            <div
                              className="h-full rounded-full bg-zinc-700"
                              style={{
                                width: `${Math.min(value * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <ConnectControl
                    state={
                      connectionStates.get(recommendation.userId) ?? "none"
                    }
                    busy={connectingId === recommendation.userId}
                    error={connectErrors[recommendation.userId]}
                    onConnect={() =>
                      sendConnectionRequest(recommendation, index + 1)
                    }
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
