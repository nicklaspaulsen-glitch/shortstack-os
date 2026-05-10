"use client";

interface LogoMarkProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = { sm: 32, md: 64, lg: 128, xl: 240 };

export function LogoMark({ size = "md", className = "" }: LogoMarkProps) {
  const px = SIZES[size];
  const id = `lm-grad-${size}`;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ShortStack logo"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>

      {/* Rounded flat-top hexagon */}
      <path
        d="M 65.5 25.3 Q 57 10.6 40 10.6 Q 23 10.6 14.5 25.3 Q 6 40 14.5 54.7 Q 23 69.4 40 69.4 Q 57 69.4 65.5 54.7 Q 74 40 65.5 25.3 Z"
        fill={`url(#${id})`}
      />

      {/* S-bolt lightning cutout in white */}
      <path
        d="M 52 16 L 20 46 L 38 46 L 26 64 L 60 34 L 42 34 Z"
        fill="white"
        fillOpacity="0.95"
      />
    </svg>
  );
}
