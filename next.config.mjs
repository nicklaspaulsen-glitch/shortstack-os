/** @type {import('next').NextConfig} */
const nextConfig = {
  // Stop ESLint from failing Vercel builds on cosmetic warnings
  // (unused imports, prefer-const, alt-text, exhaustive-deps).
  // Lint still runs in CI / dev — just not as a deploy gate. Type
  // errors WILL still fail builds since typescript.ignoreBuildErrors
  // is left at its default of false.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Belt-and-suspenders against electron (~300MB) sneaking into serverless
  // function bundles. The browser-worker imports `playwright-core` (lean,
  // no electron dep) — but if any other transitive path touches electron,
  // these excludes keep the function under Vercel's 250MB ceiling.
  // Affected functions (per Apr 27 build log): api/cron/run-browser-tasks
  // and 2 others. Globs match all routes so we're safe across the whole tree.
  experimental: {
    outputFileTracingExcludes: {
      "*": [
        "node_modules/electron/**",
        "node_modules/electron-builder/**",
        "node_modules/playwright/**",
        "node_modules/@playwright/**",
        "node_modules/puppeteer/**",
      ],
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      // Security headers for all routes
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Cache static assets aggressively (fonts, images, icons)
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      // Cache public API endpoints that don't change often
      {
        source: "/api/app/version",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" },
        ],
      },
    ];
  },
};

export default nextConfig;
