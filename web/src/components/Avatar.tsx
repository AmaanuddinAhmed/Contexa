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

export default function Avatar({
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
