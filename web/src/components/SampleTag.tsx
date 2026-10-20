export default function SampleTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`chip-outline ${className}`}
      title="Added to show how matching works. Sample profiles don’t reply."
    >
      Sample profile
    </span>
  );
}
