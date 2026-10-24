"use client";

import { useSyncExternalStore } from "react";

export const splitTerms = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const useOnboarding = (): boolean =>
  useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("onboarding") === "1",
    () => false,
  );

export function TermsField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  tone = "brand",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  tone?: "brand" | "signal" | "plain";
}) {
  const terms = splitTerms(value);
  const chip =
    tone === "signal"
      ? "bg-signal-soft text-signal-ink"
      : tone === "plain"
        ? "bg-sunk text-ink-soft ring-1 ring-line"
        : "bg-brand-soft text-brand-ink";

  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field"
        placeholder={placeholder}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="hint">
        {hint ?? "Separate items with commas."}
      </p>
      {terms.length > 0 && (
        <ul
          className="mt-2.5 flex flex-wrap gap-1.5"
          aria-label={`${label}: ${terms.length} items`}
        >
          {terms.map((term, index) => (
            <li
              key={`${term}-${index}`}
              className={`animate-fade rounded-lg px-2.5 py-1 text-xs font-medium ${chip}`}
            >
              {term}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PillChoice<T extends string>({
  name,
  label,
  options,
  value,
  onChange,
  required,
}: {
  name: string;
  label: string;
  options: readonly { value: T; label: string }[];
  value: string;
  onChange: (value: T) => void;
  required?: boolean;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option, index) => {
          const selected = option.value === value;

          return (
            <label
              key={option.value}
              className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ease-[var(--ease-spring)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand active:scale-[0.97] ${
                selected
                  ? "bg-ink text-white shadow-[var(--shadow-lift)]"
                  : "bg-sunk text-muted ring-1 ring-line hover:text-ink hover:ring-line-strong"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                required={required && index === 0}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 border-t border-line pt-7 first:border-t-0 first:pt-0">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function FormSkeleton() {
  return (
    <div className="panel space-y-6" aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="space-y-2">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-12 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
}
