"use client";

import { useEffect, useState } from "react";
import ScanRadar from "@/components/ScanRadar";

const STEP_STARTS_MS = [0, 650, 1400];
const SLOW_AFTER_MS = 6000;

export default function ScanPanel({ contextAware }: { contextAware: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(
      () => setElapsed(Date.now() - started),
      150,
    );
    return () => window.clearInterval(timer);
  }, []);

  const steps = [
    "Gathering people with public profiles",
    contextAware
      ? "Comparing profiles and what each of you needs now"
      : "Comparing profiles: skills, interests, experience",
    "Ranking and writing the reasons",
  ];

  const current = STEP_STARTS_MS.filter((start) => elapsed >= start).length - 1;

  return (
    <section
      aria-live="polite"
      aria-busy="true"
      className="panel mt-8 grid animate-rise items-center gap-8 overflow-hidden sm:grid-cols-[minmax(0,300px)_1fr] sm:gap-12"
    >
      <ScanRadar className="mx-auto w-full max-w-[260px] sm:max-w-none" />

      <div>
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">
          Looking for your people
        </h2>

        <ol className="mt-6 space-y-4">
          {steps.map((step, index) => {
            const done = index < current;
            const active = index === current;

            return (
              <li key={step} className="flex items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ease-[var(--ease-spring)] ${
                    done
                      ? "scale-100 bg-brand text-white"
                      : active
                        ? "scale-110 bg-signal text-ink [animation:pulse-dot_1.4s_ease-in-out_infinite]"
                        : "bg-sunk text-faint ring-1 ring-line"
                  }`}
                >
                  {done ? (
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3.5 w-3.5"
                      fill="none"
                    >
                      <path
                        d="M3.5 8.5l3 3 6-7"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={`text-[0.95rem] transition-colors duration-300 ${
                    done
                      ? "text-muted"
                      : active
                        ? "font-medium text-ink"
                        : "text-faint"
                  }`}
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ol>

        {elapsed > SLOW_AFTER_MS && (
          <p className="mt-6 max-w-md animate-fade rounded-2xl bg-signal-soft px-4 py-3 text-sm leading-6 text-signal-ink">
            The matching service sleeps when nobody has used it for a while.
            Waking it can take up to a minute; this page will fill in on its
            own.
          </p>
        )}
      </div>
    </section>
  );
}
