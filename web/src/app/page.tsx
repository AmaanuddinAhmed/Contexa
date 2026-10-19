import Link from "next/link";
import ScanRadar from "@/components/ScanRadar";

const STEPS = [
  {
    title: "Build your profile",
    body: "Your skills, interests, experience and how you like to collaborate.",
  },
  {
    title: "Say what you need now",
    body: "What you’re working on, the help you need, and when you’re free. This is your context.",
  },
  {
    title: "Meet your matches",
    body: "People ranked for you, each with the reasons: what they can help with and what you can help them with.",
  },
];

export default function Home() {
  return (
    <main className="page pt-10 sm:pt-16">
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="animate-rise">
          <h1 className="font-display text-[2.6rem] leading-[0.98] font-semibold tracking-[-0.035em] sm:text-6xl lg:text-[4.4rem]">
            Find the people your work needs right now.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
            Contexa ranks people by who they are and by what you both need at
            the moment, and shows you why each person made the list.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/recommendations"
              className="btn btn-primary px-6 py-3 text-[0.95rem]"
            >
              See your matches
            </Link>
            <Link
              href="/context"
              className="btn btn-quiet px-6 py-3 text-[0.95rem]"
            >
              Set your context
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[420px] animate-rise [animation-delay:120ms]">
          <ScanRadar
            speed={0.55}
            className="w-full drop-shadow-[0_30px_40px_rgba(34,56,201,0.16)]"
          />

          <div className="absolute top-[8%] -left-2 flex max-w-[15rem] items-center gap-2.5 rounded-2xl bg-surface px-3.5 py-2.5 text-sm shadow-[var(--shadow-float)] ring-1 ring-line/70 sm:-left-10">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-signal"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5 rotate-180"
                fill="none"
              >
                <path
                  d="M3 8h9M8.5 4.5L12 8l-3.5 3.5"
                  stroke="#121530"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="leading-snug">
              They can help with what you need: React
            </span>
          </div>

          <div className="absolute -right-1 bottom-[9%] flex max-w-[14rem] items-center gap-2.5 rounded-2xl bg-surface px-3.5 py-2.5 text-sm shadow-[var(--shadow-float)] ring-1 ring-line/70 sm:-right-8">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"
              aria-hidden="true"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                <circle
                  cx="6"
                  cy="8"
                  r="3.2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle
                  cx="10"
                  cy="8"
                  r="3.2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </span>
            <span className="leading-snug">
              You’re both free on weekday evenings
            </span>
          </div>
        </div>
      </section>

      <section className="mt-24 sm:mt-32" aria-labelledby="how-heading">
        <h2
          id="how-heading"
          className="font-display text-3xl font-semibold sm:text-4xl"
        >
          How matching works
        </h2>

        <ol className="relative mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
          <span
            aria-hidden="true"
            className="absolute top-5 bottom-5 left-5 w-px bg-line-strong md:top-5 md:right-[calc(33.333%-0.75rem)] md:bottom-auto md:left-5 md:h-px md:w-auto"
          />
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative flex gap-5 md:flex-col md:gap-5"
            >
              <span
                className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-base font-semibold ring-4 ring-fog ${
                  index === STEPS.length - 1
                    ? "bg-brand text-white"
                    : "bg-ink text-white"
                }`}
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-xs leading-7 text-muted">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-24 grid gap-8 rounded-[2rem] bg-ink p-7 text-white sm:mt-32 sm:p-12 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            A match goes two ways, and not always equally.
          </h2>
          <p className="mt-4 max-w-lg leading-7 text-white/70">
            Someone can cover everything you need while you cover little of what
            they need. Contexa scores both directions and tells you which is
            which, so you know what to offer when you reach out.
          </p>
        </div>
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[
            { width: "86%", label: "they cover 86% of your needs" },
            { width: "33%", label: "you cover 33% of theirs" },
          ].map((row) => (
            <div
              key={row.label}
              className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10"
            >
              <p className="text-sm text-white/70">Example: {row.label}</p>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-signal"
                  style={{ width: row.width }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
