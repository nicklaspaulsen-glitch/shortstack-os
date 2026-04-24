/**
 * Favicon — ShortStack mandala mark at 32x32.
 *
 * Next.js renders this React component at build time and serves it
 * as the site favicon. See src/components/logo.tsx for the full
 * brand guide.
 *
 * At 32×32 we drop the outer rim + 32-notch ring (they'd compress to
 * a single blurry gold circle anyway) and keep just the mid wedges,
 * starburst, and central monogram — still unmistakably the mandala.
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E4C876";
const WEDGE_ANGLES = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5];
const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#06080c",
          borderRadius: 6,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(128 128)">
            {/* 16 mid-ring wedges */}
            {WEDGE_ANGLES.map(a => (
              <path
                key={`w${a}`}
                d="M -6 -102 L 6 -102 L 8 -92 L 4 -86 L 4 -78 L -4 -78 L -4 -86 L -8 -92 Z"
                fill={GOLD_LIGHT}
                transform={`rotate(${a})`}
              />
            ))}
            {/* 8 starburst rays */}
            {RAY_ANGLES.map(a => (
              <path
                key={`r${a}`}
                d="M 0 -70 L 7 -44 L 0 -48 L -7 -44 Z"
                fill={GOLD}
                transform={`rotate(${a})`}
              />
            ))}
            {/* Central dark hub */}
            <circle r="42" fill="#06080c" stroke={GOLD} strokeOpacity="0.7" strokeWidth="1.5" />
            {/* Stacked bars */}
            <g transform="translate(-28 -22)">
              <rect x="0" y="30" width="56" height="11" rx="3" fill={GOLD} fillOpacity="0.55" />
              <rect x="4" y="15" width="48" height="11" rx="3" fill={GOLD} fillOpacity="0.8" />
              <rect x="8" y="0" width="40" height="11" rx="3" fill={GOLD} />
            </g>
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
