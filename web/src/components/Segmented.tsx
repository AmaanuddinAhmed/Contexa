"use client";

/**
 * A two-or-more option switch with a sliding indicator. Options share the
 * width equally, so the indicator is a simple translate.
 */
export default function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      role="group"
      aria-label={label}
      className="relative grid w-full rounded-full sm:inline-grid bg-surface p-1 shadow-[var(--shadow-lift)] ring-1 ring-line/80 sm:w-auto"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 rounded-full bg-ink transition-transform duration-500 ease-[var(--ease-spring)]"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled && !selected}
            onClick={() => onChange(option.value)}
            className={`relative z-10 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-300 disabled:cursor-not-allowed ${
              selected ? "text-white" : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
