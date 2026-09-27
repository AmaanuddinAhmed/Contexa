"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

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
  breakdown: {
    profile: number;
    need: number;
    activity: number;
    availability: number;
    interactionPreference: number;
    needFulfillmentA: number;
    needFulfillmentB: number;
  };
}

interface RecommendationResponse {
  success: boolean;
  data: {
    recommendations: Recommendation[];
    count: number;
    limit: number;
  };
}

const formatPercentage = (value: number) => `${Math.round(value * 100)}%`;

const formatFactorName = (factor: string) => {
  const names: Record<string, string> = {
    profile: "Profile",
    need: "Need",
    activity: "Activity",
    availability: "Availability",
    interactionPreference: "Interaction Preference",
    needFulfillmentA: "Need Fulfillment A",
    needFulfillmentB: "Need Fulfillment B",
  };

  return names[factor] || factor;
};

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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
      const response = await api<RecommendationResponse>(
        "/recommendations?limit=10",
        {
          token,
        },
      );

      setRecommendations(response.data.recommendations);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load recommendations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 p-6">
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
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
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

            <a
              href="/context"
              className="rounded-xl border border-zinc-200 px-5 py-3 font-medium text-zinc-900 transition hover:bg-zinc-50"
            >
              Update Context
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a href="/" className="text-xl font-bold tracking-tight">
            CONTEXA
          </a>

          <nav className="flex items-center gap-5 text-sm font-medium">
            <a href="/profile" className="text-zinc-600 hover:text-black">
              Profile
            </a>

            <a href="/context" className="text-zinc-600 hover:text-black">
              Context
            </a>

            <a href="/recommendations" className="text-black">
              Recommendations
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Context-aware discovery
            </p>

            <h1 className="text-4xl font-bold tracking-tight text-zinc-950">
              Your Recommendations
            </h1>

            <p className="mt-3 max-w-2xl text-zinc-600">
              People ranked according to your profile and current context.
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

            <a
              href="/context"
              className="mt-6 inline-block rounded-xl bg-black px-5 py-3 font-medium text-white"
            >
              Update Context
            </a>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {recommendations.map((recommendation, index) => {
              const { profile, score, breakdown } = recommendation;

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

                  <button
                    type="button"
                    className="mt-6 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
                  >
                    View Profile
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
