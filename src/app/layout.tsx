import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "react-hot-toast";
import PWARegister from "@/components/pwa-register";
import SFXProvider from "@/components/sfx-provider";
import ThemeProvider from "@/components/theme-provider";

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('mousemove', function(e) {
            var cards = document.querySelectorAll('.card-hover');
            for (var i = 0; i < cards.length; i++) {
              var r = cards[i].getBoundingClientRect();
              cards[i].style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
              cards[i].style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
            }
          });
        `}} />
      </head>
      <body className="antialiased bg-background text-white min-h-screen">
        <AuthProvider>
          <ThemeProvider>
          <SFXProvider>
          {children}
          </SFXProvider>
          </ThemeProvider>
          <PWARegister />
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
