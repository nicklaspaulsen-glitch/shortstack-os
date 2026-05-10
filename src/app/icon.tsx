/**
 * Favicon — ShortStack 3-tier stack mark at 32x32.
 *
 * Next.js renders this React component at build time and serves it
 * as the site favicon. Uses the current brand mark: three stacked
 * pill shapes rendered in indigo (#2563EB) on a near-black background.
 * Matches the MandalaMark / shortstack-logo.svg geometry.
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const INDIGO = "#2563EB";

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
          background: "#07070E",
          borderRadius: 6,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
          <g fill={INDIGO}>
            {/* Top tier */}
            <path d="M 56 72 Q 56 50 84 50 Q 128 42 172 50 Q 200 50 200 72 Q 200 94 172 94 Q 128 102 84 94 Q 56 94 56 72 Z" />
            {/* Middle tier */}
            <path d="M 56 128 Q 56 106 84 106 Q 128 98 172 106 Q 200 106 200 128 Q 200 150 172 150 Q 128 158 84 150 Q 56 150 56 128 Z" />
            {/* Bottom tier */}
            <path d="M 56 184 Q 56 162 84 162 Q 128 154 172 162 Q 200 162 200 184 Q 200 206 172 206 Q 128 214 84 206 Q 56 206 56 184 Z" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
