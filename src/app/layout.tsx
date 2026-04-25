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
    icon: [
      { url: "/icons/shortstack-logo.ico", sizes: "any" },
      { url: "/icons/shortstack-logo.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/shortstack-logo.png",
    shortcut: "/icons/shortstack-logo.ico",
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
      </body>
    </html>
  );
}
