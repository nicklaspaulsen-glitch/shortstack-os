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
  // Two Vercel build issues to dodge:
  //
  // 1) webpack can't parse playwright-core's internal Vite recorder dir
  //    (.ttf and .html assets). Marking these packages as server-external
  //    tells Next to leave them as runtime require()s instead of bundling.
  //    Note: this option is `experimental.serverComponentsExternalPackages`
  //    in Next.js 14 — the top-level `serverExternalPackages` form is Next 15.
  //
  // 2) Belt-and-suspenders against electron (~300MB) sneaking into
  //    serverless function bundles via desktop app transitive deps.
  //    outputFileTracingExcludes drops these directories from every
  //    function bundle regardless of import chain, keeping us under
  //    Vercel's 250MB function ceiling.
  experimental: {
    serverComponentsExternalPackages: ["playwright-core", "puppeteer-core", "jsdom"],
    outputFileTracingExcludes: {
      "*": [
        "node_modules/electron/**",
        "node_modules/electron-builder/**",
        "node_modules/playwright/**",
        "node_modules/@playwright/**",
        "node_modules/puppeteer/**",
      ],
    },
    // Tree-shake heavy packages that are imported everywhere via barrel
    // files. Without this, importing { Sparkles } from "lucide-react"
    // pulls in all ~1500 icons. With it, Next rewrites the import to a
    // direct path so only the icons used ship. Same for date-fns.
    // Ref: https://nextjs.org/docs/app/api-reference/next-config-js/optimizePackageImports
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "framer-motion",
      "@radix-ui/react-icons",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/dashboard/integrations",
        destination: "/dashboard/integrations-hub",
        permanent: true,
      },
      {
        source: "/dashboard/integrations-marketplace",
        destination: "/dashboard/integrations-hub",
        permanent: true,
      },
      {
        source: "/dashboard/workspaces",
        destination: "/dashboard/settings",
        permanent: true,
      },
      {
        source: "/dashboard/workspaces/:path*",
        destination: "/dashboard/settings",
        permanent: true,
      },
    ];
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
          // HSTS — forces HTTPS for 1 year, all subdomains, preload-eligible.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // CSP — Next.js 14 App Router needs unsafe-inline for inline scripts.
          // Primary value here is locking connect-src (exfil prevention) and
          // frame-src (clickjacking). Tighten to nonces in Next 15 migration.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js inline scripts + Stripe + Vercel Analytics
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com",
              // Tailwind/global CSS inline styles
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              // Images: R2 public bucket, Supabase storage, Unsplash, data URIs
              "img-src 'self' data: blob: https:",
              // API connections: Supabase (REST + Realtime), Stripe, Anthropic, AI providers,
              // Telegram notifications, Vercel Insights
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.anthropic.com https://api.openai.com https://api.elevenlabs.io https://api.telegram.org https://vitals.vercel-insights.com",
              // Audio/video for Voice Studio previews
              "media-src 'self' blob: https:",
              // Workers for Next.js background tasks
              "worker-src 'self' blob:",
              // Stripe.js payment iframe
              "frame-src https://js.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
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
