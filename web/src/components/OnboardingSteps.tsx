const STEPS = ["Profile", "Context", "Matches"];

export default function OnboardingSteps({ current }: { current: 1 | 2 }) {
  return (
    <ol
      aria-label="Setting up your account"
      className="mb-8 flex animate-fade items-center gap-2 text-sm"
    >
      {STEPS.map((step, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;

        return (
          <li key={step} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 rounded-full py-1 pr-3 pl-1 font-medium ${
                active
                  ? "bg-ink text-white"
                  : done
                    ? "bg-brand-soft text-brand-ink"
                    : "text-faint"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  active
                    ? "bg-signal text-ink"
                    : done
                      ? "bg-brand text-white"
                      : "bg-sunk ring-1 ring-line"
                }`}
              >
                {number}
              </span>
              {step}
            </span>
            {number < STEPS.length && (
              <span
                aria-hidden="true"
                className="h-px w-5 bg-line-strong sm:w-10"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
