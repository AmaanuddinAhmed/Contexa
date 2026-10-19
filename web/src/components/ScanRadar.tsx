/**
 * A radar sweep over a field of people (dots). Each dot lights up amber at
 * the moment the sweep passes it, so the animation reads as "looking at
 * everyone, one by one". Pure CSS; positions are fixed (seeded), so server
 * and browser render the same markup.
 */

const SWEEP_SECONDS = 2.6;

interface Dot {
  angle: number; // degrees, clockwise from 12 o'clock
  radius: number; // 0..1 of the radar radius
  size: number; // px
}

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const DOTS: Dot[] = (() => {
  const random = seeded(20261019);
  return Array.from({ length: 34 }, () => ({
    angle: Math.round(random() * 360),
    radius: 0.24 + random() * 0.7,
    size: 4 + Math.round(random() * 3),
  }));
})();

export default function ScanRadar({
  className = "",
  speed = 1,
}: {
  className?: string;
  /** 1 = normal; lower is slower (used as an idle hero). */
  speed?: number;
}) {
  // Rounded so the server and the browser print identical style strings.
  const period = Math.round((SWEEP_SECONDS / speed) * 100) / 100;
  const round = (value: number) => Math.round(value * 1000) / 1000;

  return (
    <div
      className={`relative aspect-square ${className}`}
      role="img"
      aria-label="Scanning the people you could work with"
    >
      {/* Rings and crosshair */}
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <circle cx="100" cy="100" r="99" fill="#ffffff" stroke="#dcdfe9" />
        <circle
          cx="100"
          cy="100"
          r="74"
          fill="none"
          stroke="#dcdfe9"
          strokeDasharray="2 4"
        />
        <circle cx="100" cy="100" r="49" fill="none" stroke="#dcdfe9" />
        <circle
          cx="100"
          cy="100"
          r="24"
          fill="none"
          stroke="#dcdfe9"
          strokeDasharray="2 4"
        />
        <line x1="100" y1="2" x2="100" y2="198" stroke="#eef0f5" />
        <line x1="2" y1="100" x2="198" y2="100" stroke="#eef0f5" />
      </svg>

      {/* The sweep: a conic wedge whose leading edge is the bright one. */}
      <div
        className="absolute inset-[1px] overflow-hidden rounded-full"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg 290deg, rgb(51 82 255 / 0.04) 300deg, rgb(51 82 255 / 0.28) 359deg, rgb(51 82 255 / 0.55) 360deg)",
            animation: `sweep ${period}s linear infinite`,
          }}
        />
      </div>

      {/* People */}
      {DOTS.map((dot, index) => {
        const radians = (dot.angle * Math.PI) / 180;
        const x = round(50 + Math.sin(radians) * dot.radius * 48);
        const y = round(50 - Math.cos(radians) * dot.radius * 48);
        const delay = round((dot.angle / 360) * period);

        return (
          <span
            key={index}
            aria-hidden="true"
            className="absolute rounded-full bg-faint opacity-[0.28]"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              marginLeft: `${-dot.size / 2}px`,
              marginTop: `${-dot.size / 2}px`,
              animation: `blip ${period}s linear ${delay}s infinite`,
            }}
          />
        );
      })}

      {/* You, at the centre */}
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 flex h-[15%] w-[15%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-[0.6rem] font-semibold text-white ring-4 ring-white"
      >
        you
      </span>
    </div>
  );
}
