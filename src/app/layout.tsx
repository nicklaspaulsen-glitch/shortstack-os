import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "react-hot-toast";
import PWARegister from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "ShortStack OS",
  description: "Internal operating system for ShortStack digital marketing agency",
  icons: { icon: "/icons/shortstack-logo.png", apple: "/icons/shortstack-logo.png" },
  manifest: "/manifest.json",
  themeColor: "#C9A84C",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ShortStack OS",
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-background text-white min-h-screen">
        <AuthProvider>
          {children}
          <PWARegister />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#111111",
                color: "#fff",
                border: "1px solid #2a2a2a",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
