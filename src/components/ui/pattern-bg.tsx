"use client";

/**
 * Lightweight SVG pattern backgrounds.
 * Use inside a relatively positioned parent — patterns absolutely fill the parent.
 * `className` lets callers set a text color (which becomes the pattern color via currentColor).
 */

interface PatternProps {
  opacity?: number;
  size?: number;
  className?: string;
}

export function DotPattern({ opacity = 0.05, size = 20, className = "text-gold" }: PatternProps) {
  const id = `dot-pattern-${size}`;
  return (
    <svg
      aria-hidden
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ opacity }}
    >
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <circle cx={size / 10} cy={size / 10} r={size / 20} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function GridPattern({ opacity = 0.05, size = 40, className = "text-gold" }: PatternProps) {
  const id = `grid-pattern-${size}`;
  return (
    <svg
      aria-hidden
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ opacity }}
    >
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <path
            d={`M ${size} 0 L 0 0 L 0 ${size}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function DiagonalPattern({ opacity = 0.05, size = 14, className = "text-gold" }: PatternProps) {
  const id = `diag-pattern-${size}`;
  return (
    <svg
      aria-hidden
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ opacity }}
    >
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={size} stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export default DotPattern;
