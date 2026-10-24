"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import OnboardingSteps from "@/components/OnboardingSteps";
import {
  FormSection,
  FormSkeleton,
  PillChoice,
  TermsField,
  splitTerms,
  useOnboarding,
} from "@/components/FormBits";

interface Context {
  goal: string;
  need: string[];
  activity: string;
  availability: string;
  situation: string;
  interactionPreference: string;
  validUntil?: string;
}

interface ContextResponse {
  success: boolean;
  data: {
    context: Context | null;
  };
}

const INTERACTION_OPTIONS = [
  { value: "Online", label: "Online" },
  { value: "In-person", label: "In person" },
  { value: "Either", label: "Either" },
] as const;

const WEIGHTS = [
  { label: "Covering each other’s needs", value: 45, className: "bg-signal" },
  { label: "Profile similarity", value: 30, className: "bg-brand" },
  { label: "Shared needs", value: 10, className: "bg-brand/60" },
  {
    label: "Activity, availability, meeting preference",
    value: 15,
    className: "bg-ink",
  },
];

const toDateInputValue = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const endOfDayIso = (dateValue: string): string =>
  new Date(`${dateValue}T23:59:59`).toISOString();

export default function ContextPage() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [goal, setGoal] = useState("");
  const [need, setNeed] = useState("");
  const [activity, setActivity] = useState("");
  const [availability, setAvailability] = useState("");
  const [situation, setSituation] = useState("");
  const [interactionPreference, setInteractionPreference] = useState("");
  const [validUntil, setValidUntil] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContext = async () => {
      const token = getToken();

      if (!token) {
        setMessage("Please log in first.");
        setLoading(false);
        return;
      }

      try {
        const response = await api<ContextResponse>("/context", {
          token,
        });

        const context = response.data.context;

        if (context) {
          setGoal(context.goal);
          setNeed(context.need.join(", "));
          setActivity(context.activity);
          setAvailability(context.availability);
          setSituation(context.situation);
          setInteractionPreference(context.interactionPreference);
          setValidUntil(
            context.validUntil
              ? toDateInputValue(new Date(context.validUntil))
              : "",
          );
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Unable to load context.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadContext();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    setMessage("");

    const token = getToken();

    if (!token) {
      setMessage("Please log in first.");
      return;
    }

    setSaving(true);

    try {
      await api("/context", {
        method: "POST",
        token,
        body: JSON.stringify({
          goal,
          need: splitTerms(need),
          activity,
          availability,
          situation,
          interactionPreference,
          ...(validUntil ? { validUntil: endOfDayIso(validUntil) } : {}),
        }),
      });

      if (onboarding) {
        router.push("/recommendations");
        return;
      }

      setSaved(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save context.",
      );
    } finally {
      setSaving(false);
    }
  };

  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setSaved(false);
      setter(value);
    };

  return (
    <main className="page">
      {onboarding && <OnboardingSteps current={2} />}

      <header>
        <h1 className="page-title">What you need right now</h1>
        <p className="page-lede">
          Your context changes from week to week. Context-aware matching uses it
          to find people who can help with what you’re doing now, and whom you
          can help back.
        </p>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_340px] lg:gap-8">
        {loading ? (
          <FormSkeleton />
        ) : (
          <form
            onSubmit={handleSubmit}
            className="panel grid animate-rise gap-7 sm:p-9"
          >
            <FormSection title="Right now">
              <div>
                <label htmlFor="goal" className="label">
                  Your current goal
                </label>
                <input
                  id="goal"
                  value={goal}
                  onChange={(event) => edit(setGoal)(event.target.value)}
                  className="field"
                  placeholder="Find a project partner"
                  required
                />
              </div>
              <div>
                <label htmlFor="activity" className="label">
                  What you’re doing
                </label>
                <input
                  id="activity"
                  value={activity}
                  onChange={(event) => edit(setActivity)(event.target.value)}
                  className="field"
                  placeholder="Working on a university project"
                  required
                />
              </div>
              <div>
                <label htmlFor="situation" className="label">
                  Your situation
                </label>
                <textarea
                  id="situation"
                  value={situation}
                  onChange={(event) => edit(setSituation)(event.target.value)}
                  className="field min-h-28 resize-y"
                  rows={4}
                  placeholder="I need someone to collaborate with..."
                  required
                />
              </div>
            </FormSection>

            <FormSection
              title="What you need"
              description="The skills or help you’re looking for. People whose skills cover these rank higher."
            >
              <TermsField
                id="need"
                label="Needs"
                value={need}
                onChange={edit(setNeed)}
                placeholder="React developer, UI designer"
                tone="signal"
              />
            </FormSection>

            <FormSection title="When and how">
              <div>
                <label htmlFor="availability" className="label">
                  When you’re free
                </label>
                <input
                  id="availability"
                  value={availability}
                  onChange={(event) =>
                    edit(setAvailability)(event.target.value)
                  }
                  className="field"
                  placeholder="Weekends"
                  required
                />
              </div>

              <PillChoice
                name="interaction"
                label="How you’d like to meet"
                options={INTERACTION_OPTIONS}
                value={interactionPreference}
                onChange={edit(setInteractionPreference)}
                required
              />

              <div>
                <label htmlFor="valid-until" className="label">
                  Valid until{" "}
                  <span className="font-normal text-faint">(optional)</span>
                </label>
                <input
                  id="valid-until"
                  type="date"
                  value={validUntil}
                  min={toDateInputValue(new Date())}
                  onChange={(event) => edit(setValidUntil)(event.target.value)}
                  className="field sm:max-w-xs"
                  aria-describedby="valid-until-hint"
                />
                <p id="valid-until-hint" className="hint">
                  After this day you stop appearing in matches until you update
                  your context. Leave empty for no expiry.
                </p>
              </div>
            </FormSection>

            <div className="grid gap-3 border-t border-line pt-7">
              {message && (
                <p role="alert" className="alert-error">
                  {message}
                </p>
              )}
              {saved && (
                <p role="status" className="alert-ok animate-fade">
                  Context saved.{" "}
                  <Link
                    href="/recommendations"
                    className="font-semibold underline"
                  >
                    See your matches
                  </Link>
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary w-full py-3 sm:w-fit sm:px-7"
              >
                {saving
                  ? "Saving"
                  : onboarding
                    ? "Save and find matches"
                    : "Save context"}
              </button>
            </div>
          </form>
        )}

        <aside className="panel animate-rise [animation-delay:100ms] lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">How your context counts</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            A context-aware score is built from these parts. Most of it comes
            from how well you and the other person cover each other’s needs.
          </p>
          <div
            className="mt-5 flex h-3 overflow-hidden rounded-full"
            aria-hidden="true"
          >
            {WEIGHTS.map((weight, index) => (
              <span
                key={weight.label}
                className={`${weight.className} h-full origin-left [animation:bar-fill_0.9s_var(--ease-out-quint)_both]`}
                style={{
                  width: `${weight.value}%`,
                  animationDelay: `${200 + index * 120}ms`,
                }}
              />
            ))}
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {WEIGHTS.map((weight) => (
              <li key={weight.label} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 shrink-0 rounded-sm ${weight.className}`}
                />
                <span className="flex-1 text-ink-soft">{weight.label}</span>
                <span className="font-semibold tabular-nums">
                  {weight.value}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-faint">
            Profile-only matching ignores everything on this page.
          </p>
        </aside>
      </div>
    </main>
  );
}
