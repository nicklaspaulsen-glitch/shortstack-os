import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
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
    // ?v=2 cache-buster — browsers aggressively cache favicons across deploys.
    // Bump this when the mandala source changes so users get the new icon
    // without needing to clear cache manually.
    icon: [
      { url: "/icons/shortstack-logo.ico?v=2", sizes: "any" },
      { url: "/icons/shortstack-logo.svg?v=2", type: "image/svg+xml" },
    ],
    apple: "/icons/shortstack-logo.png?v=2",
    shortcut: "/icons/shortstack-logo.ico?v=2",
  },
  manifest: "/manifest.json",
  themeColor: "#0b0d12",
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
            __html: `(function(){try{var t=localStorage.getItem("ss-theme")||"nordic";var l=(t==="nordic"||t==="light");document.documentElement.setAttribute("data-theme",l?"light":"dark");if(!l){document.documentElement.style.backgroundColor="#0f0f0f";}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased bg-background min-h-screen">
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
        <GrainOverlay />
      </body>
    </html>
  );
}
