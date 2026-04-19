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

export const metadata: Metadata = {
  title: {
    default: "Trinity · by ShortStack",
    template: "%s | Trinity",
  },
  description: "The all-in-one operating system for digital marketing agencies. Scrape leads, automate outreach, manage clients, create content, and scale revenue — all powered by AI.",
  keywords: ["agency management", "marketing automation", "lead generation", "CRM", "AI outreach", "digital marketing", "client portal", "agency OS"],
  icons: { icon: "/trinity-logo.svg", apple: "/trinity-logo.svg" },
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
    siteName: "Trinity",
    title: "Trinity · by ShortStack",
    description: "The all-in-one operating system for digital marketing agencies. Scrape leads, automate outreach, manage clients, and scale revenue.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trinity · by ShortStack",
    description: "The all-in-one operating system for digital marketing agencies.",
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
