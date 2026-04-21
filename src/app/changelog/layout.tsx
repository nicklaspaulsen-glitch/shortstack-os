import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

export const metadata: Metadata = {
  title: "Changelog — ShortStack",
  description: "See what's new in Trinity. The latest features, improvements, and fixes to the AI operating system for modern digital marketing agencies.",
  alternates: { canonical: `${SITE_URL}/changelog` },
  openGraph: {
    title: "Changelog — ShortStack",
    description: "See what's new in Trinity. The latest features, improvements, and fixes.",
    url: `${SITE_URL}/changelog`,
    siteName: "ShortStack",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ShortStack changelog" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Changelog — ShortStack",
    description: "See what's new in Trinity.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
