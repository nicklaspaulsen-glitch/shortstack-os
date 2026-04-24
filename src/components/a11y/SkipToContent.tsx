"use client";

/**
 * Skip-to-content link — WCAG 2.1 AA bypass block (2.4.1).
 *
 * Hidden off-screen by default; becomes visible when focused via keyboard
 * (Tab as first interaction). Clicking or pressing Enter jumps to the
 * element with id="main" so keyboard/screen-reader users can skip the
 * sidebar + header nav.
 *
 * Mount once in the root dashboard layout (or app layout) BEFORE the
 * sidebar. Pair with `<main id="main">` on the page content region.
 */
export function SkipToContent() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      Skip to main content
    </a>
  );
}

export default SkipToContent;
