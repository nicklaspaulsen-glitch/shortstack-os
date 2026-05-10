import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { PostHogProvider } from "./providers";
import { WhiteLabelProvider } from "@/lib/white-label-context";
import { Toaster } from "react-hot-toast";
import PWARegister from "@/components/pwa-register";
import ElectronBannerCleanup from "@/components/electron-banner-cleanup";
import SFXProvider from "@/components/sfx-provider";
import ThemeProvider from "@/components/theme-provider";
import { CookieConsent } from "@/components/cookie-consent";
import FeedbackButton from "@/components/feedback-button";
import GrainOverlay from "@/components/brand/grain-overlay";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
const OG_IMAGE = "/og-image.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Trinity — the AI operating system for agencies — ShortStack",
    template: "%s — ShortStack",
  },
  description: "Trinity is the all-in-one AI operating system for modern agencies. Scrape leads, automate outreach, manage clients, and scale revenue from one place.",
  keywords: ["agency management", "marketing automation", "lead generation", "CRM", "AI outreach", "digital marketing", "client portal", "agency OS"],
  icons: {
    // ?v=3 cache-buster — bumped when the favicon source changed (gold
    // mandala → 3-tier stack mark). Browsers aggressively cache favicons
    // across deploys, so the version query string forces a fresh fetch.
    icon: [
      { url: "/icons/shortstack-logo.svg?v=3", type: "image/svg+xml" },
      { url: "/icons/shortstack-logo.ico?v=3", sizes: "any" },
      { url: "/icons/shortstack-logo-192.png?v=3", sizes: "192x192", type: "image/png" },
      { url: "/icons/shortstack-logo-512.png?v=3", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/shortstack-logo-180.png?v=3",
    shortcut: "/icons/shortstack-logo.ico?v=3",
  },
  manifest: "/manifest.json",
  themeColor: "#2563EB",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Trinity",
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  openGraph: {
    type: "website",
    siteName: "ShortStack",
    title: "Trinity — the AI operating system for agencies — ShortStack",
    description: "The all-in-one AI operating system for modern agencies. Scrape leads, automate outreach, manage clients, and scale revenue from one place.",
    url: SITE_URL,
    locale: "en_US",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "ShortStack — Agency Operating System" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trinity — the AI operating system for agencies — ShortStack",
    description: "The all-in-one AI operating system for modern agencies.",
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.setAttribute("data-theme","light");document.documentElement.style.backgroundColor="#FFFFFF";`,
          }}
        />
        {/* Apr 28 v5: non-blocking font loading.
            - <link rel="preconnect"> warms the font origin connections
              so the stylesheet GET handshake is already done by the
              time the URL is fetched.
            - <link rel="preload" as="style"> downloads the CSS without
              blocking render.
            - The inline script swaps `rel="preload"` to `rel="stylesheet"`
              once it loads, which is the modern non-blocking pattern.
              Falls back to a plain stylesheet inside <noscript>.
            - Inter trimmed from 7 weights to 3 (400/500/700) and
              Bodoni Moda dropped entirely (CLAUDE.md retired it). */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="preload"
          as="style"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap"
        />
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var ls=document.querySelectorAll('link[rel="preload"][as="style"]');ls.forEach(function(l){l.rel='stylesheet';});})();`,
          }}
        />
        <noscript>
          <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap" />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" />
        </noscript>
      </head>
      <body className="antialiased bg-background min-h-screen prism-ambient">
        {/* Apr 28: hidden SVG <defs> with the volumetric "3D nav icon"
            filter. Positioned absolute and 0×0 so it occupies no layout
            space; referenced by `filter: url(#nav-icon-3d)` from
            globals.css for every sidebar icon. The filter chains:
              1. feMorphology dilate — thickens the lucide stroke.
              2. feSpecularLighting + fePointLight — adds top-left
                 specular highlight, gives the icon a "shiny extruded
                 surface" feel.
              3. feComposite — masks the highlight to icon shape only.
              4. feMerge — stacks: thickened-base under highlight on top.
            The result combines with the existing CSS drop-shadow
            extrusion stack for a genuinely 3D-looking icon. */}
        <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden" }} aria-hidden="true">
          <defs>
            <filter id="nav-icon-3d" x="-30%" y="-30%" width="160%" height="160%">
              <feMorphology operator="dilate" radius="0.45" in="SourceGraphic" result="thick" />
              <feSpecularLighting
                surfaceScale="3"
                specularConstant="0.85"
                specularExponent="22"
                lightingColor="#FFFFFF"
                in="thick"
                result="specular"
              >
                <fePointLight x="-150" y="-150" z="100" />
              </feSpecularLighting>
              <feComposite in="specular" in2="thick" operator="in" result="lit" />
              <feMerge>
                <feMergeNode in="thick" />
                <feMergeNode in="lit" />
              </feMerge>
            </filter>
          </defs>
        </svg>
        <Suspense>
        <PostHogProvider>
        <AuthProvider>
          <WhiteLabelProvider>
          <ThemeProvider>
          <SFXProvider>
          {children}
          </SFXProvider>
          </ThemeProvider>
          <PWARegister />
          <ElectronBannerCleanup />
          <CookieConsent />
          <FeedbackButton />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--color-surface, #111111)",
                color: "var(--color-text, #fff)",
                border: "1px solid var(--color-border, #2a2a2a)",
                fontSize: "12px",
              },
            }}
          />
          </WhiteLabelProvider>
        </AuthProvider>
        </PostHogProvider>
        </Suspense>
        <GrainOverlay />
      </body>
    </html>
  );
}
