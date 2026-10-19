/**
 * Contexa mark: two people (one filled, one outlined) overlapping where
 * they match, plus the amber dot of context.
 */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="10" fill="#121530" />
      <circle cx="12.5" cy="17" r="6" fill="#3352ff" />
      <circle
        cx="19.5"
        cy="17"
        r="6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
      />
      <circle cx="23.5" cy="8.5" r="2.6" fill="#ffb21f" />
    </svg>
  );
}
