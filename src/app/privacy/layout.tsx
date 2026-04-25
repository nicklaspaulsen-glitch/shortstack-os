import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

export const metadata: Metadata = {
  title: "Privacy policy — ShortStack",
  description: "How ShortStack collects, uses, stores, and protects personal and account data across Trinity. Your rights, our responsibilities, and data retention.",
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: "Privacy policy — ShortStack",
    description: "How ShortStack collects, uses, and protects personal and account data across Trinity.",
    url: `${SITE_URL}/privacy`,
    siteName: "ShortStack",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ShortStack privacy policy" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy policy — ShortStack",
    description: "How ShortStack handles personal and account data.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
