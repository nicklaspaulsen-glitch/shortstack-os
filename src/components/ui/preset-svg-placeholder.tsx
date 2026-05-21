"use client";

/**
 * Category-themed gradient SVG placeholder shown when a preset has no
 * preview_url / thumbnail_url. Renders intentionally rather than as a
 * broken-image icon.
 *
 * Gradient pairs are chosen per category so each library section has
 * a distinctive feel.
 */

const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  // Video editor presets
  hooks: ["#7C3AED", "#EC4899"],
  content: ["#CC1A1A", "#FF5252"],
  captions: ["#CC1A1A", "#D4FF00"],
  effects: ["#DC2626", "#F97316"],
  ads: ["#CA8A04", "#FACC15"],
  social: ["#DB2777", "#F43F5E"],
  agency: ["#1E40AF", "#D4FF00"],
  // Thumbnail presets
  youtube: ["#EF4444", "#F97316"],
  podcast: ["#7C3AED", "#A855F7"],
  education: ["#E02020", "#D4FF00"],
  business: ["#AACC00", "#D4FF00"],
  personal: ["#BE185D", "#F472B6"],
  // Telegram presets
  onboarding: ["#CC1A1A", "#D4FF00"],
  nurture: ["#E02020", "#FF8080"],
  reactivation: ["#B45309", "#FBBF24"],
  default: ["#4B5563", "#9CA3AF"],
};

function getCategoryGradient(category: string): [string, string] {
  const key = category.toLowerCase().replace(/-/g, "");
  const match = Object.entries(CATEGORY_GRADIENTS).find(([k]) =>
    key.includes(k) || k.includes(key)
  );
  return match ? match[1] : CATEGORY_GRADIENTS.default;
}

interface PresetSvgPlaceholderProps {
  name: string;
  category: string;
  /** Width/height of the SVG element. Defaults fill the container via 100%/auto. */
  className?: string;
}

export function PresetSvgPlaceholder({
  name,
  category,
  className = "w-full h-full",
}: PresetSvgPlaceholderProps) {
  const [from, to] = getCategoryGradient(category);
  const gradId = `pg-${category.replace(/[^a-z0-9]/gi, "")}-${name.slice(0, 4).replace(/[^a-z0-9]/gi, "")}`;

  // Truncate name to fit the tile
  const displayName = name.length > 18 ? name.slice(0, 16) + "…" : name;
  const catLabel = category.replace(/-/g, " ").toUpperCase();

  return (
    <svg
      viewBox="0 0 320 180"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={`${name} preset preview`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="320" height="180" fill={`url(#${gradId})`} />

      {/* Subtle noise texture overlay */}
      <rect width="320" height="180" fill="black" opacity="0.12" />

      {/* Decorative circles */}
      <circle cx="280" cy="20" r="60" fill="white" opacity="0.06" />
      <circle cx="40" cy="160" r="80" fill="white" opacity="0.04" />

      {/* Category label */}
      <text
        x="16"
        y="26"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="10"
        fontWeight="600"
        letterSpacing="2"
        fill="white"
        opacity="0.6"
      >
        {catLabel}
      </text>

      {/* Preset name — big white type */}
      <text
        x="16"
        y="110"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="26"
        fontWeight="700"
        fill="white"
        opacity="0.95"
      >
        {displayName}
      </text>

      {/* Decorative bottom accent line */}
      <rect x="16" y="130" width="40" height="3" rx="1.5" fill="white" opacity="0.5" />
    </svg>
  );
}

export default PresetSvgPlaceholder;
