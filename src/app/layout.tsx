import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "react-hot-toast";
import PWARegister from "@/components/pwa-register";
import ElectronBannerCleanup from "@/components/electron-banner-cleanup";
import SFXProvider from "@/components/sfx-provider";
import ThemeProvider from "@/components/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "ShortStack OS — AI-Powered Agency Operating System",
    template: "%s | ShortStack OS",
  },
  description: "The all-in-one operating system for digital marketing agencies. Scrape leads, automate outreach, manage clients, create content, and scale revenue — all powered by AI.",
  keywords: ["agency management", "marketing automation", "lead generation", "CRM", "AI outreach", "digital marketing", "client portal", "agency OS"],
  icons: { icon: "/icons/shortstack-logo.png", apple: "/icons/shortstack-logo.png" },
  manifest: "/manifest.json",
  themeColor: "#0b0d12",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ShortStack OS",
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  openGraph: {
    type: "website",
    siteName: "ShortStack OS",
    title: "ShortStack OS — AI-Powered Agency Operating System",
    description: "The all-in-one operating system for digital marketing agencies. Scrape leads, automate outreach, manage clients, and scale revenue.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShortStack OS — AI-Powered Agency Operating System",
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
    <html lang="en">
      <body className="antialiased bg-background min-h-screen">
        <AuthProvider>
          <ThemeProvider>
          <SFXProvider>
          {children}
          </SFXProvider>
          </ThemeProvider>
          <PWARegister />
          <ElectronBannerCleanup />
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
        </AuthProvider>
      </body>
    </html>
  );
}
