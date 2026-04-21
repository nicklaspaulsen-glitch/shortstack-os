/**
 * Favicon — ShortStack brand mark at 32x32.
 *
 * Next.js will render this React component at build time and serve it
 * as the site's favicon (takes precedence over /src/app/favicon.ico).
 * Uses the 2026 geometric-stack refresh. See src/components/logo.tsx
 * for the brand guide.
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

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
        {/* SVG mark inlined — same geometry as /public/icons/shortstack-logo.svg */}
        <svg
          width="26"
          height="26"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="10" y="42" width="44" height="10" rx="3" fill="#C9A84C" fillOpacity="0.55" />
          <rect x="14" y="27" width="38" height="10" rx="3" fill="#C9A84C" fillOpacity="0.78" />
          <rect x="18" y="12" width="32" height="10" rx="3" fill="#C9A84C" />
        </svg>
      </div>
    ),
    size,
  );
}
