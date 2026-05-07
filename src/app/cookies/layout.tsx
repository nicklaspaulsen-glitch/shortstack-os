import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

export const metadata: Metadata = {
  title: "Cookie Policy — ShortStack",
  description: "How ShortStack uses cookies and similar technologies, what data they collect, and how to manage your cookie preferences.",
  alternates: { canonical: `${SITE_URL}/cookies` },
  openGraph: {
    title: "Cookie Policy — ShortStack",
    description: "How ShortStack uses cookies and how to manage your preferences.",
    url: `${SITE_URL}/cookies`,
    siteName: "ShortStack",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ShortStack cookie policy" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cookie Policy — ShortStack",
    description: "How ShortStack uses cookies and how to manage your preferences.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function CookiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
