const SWEEP_SECONDS = 2.6;

interface Dot {
  angle: number;
  radius: number;
  size: number;
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
  speed?: number;
}) {
  const period = Math.round((SWEEP_SECONDS / speed) * 100) / 100;
  const round = (value: number) => Math.round(value * 1000) / 1000;

  return (
    <div
      className={`relative aspect-square ${className}`}
      role="img"
      aria-label="Scanning the people you could work with"
    >
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

      <span
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 flex h-[15%] w-[15%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-[0.6rem] font-semibold text-white ring-4 ring-white"
      >
        you
      </span>
    </div>
  );
}
