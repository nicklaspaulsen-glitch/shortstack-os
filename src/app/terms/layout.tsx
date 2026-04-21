import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

export const metadata: Metadata = {
  title: "Terms of service — ShortStack",
  description: "The terms of service for Trinity by ShortStack. Acceptable use, subscriptions, billing, liability, and the mutual responsibilities of using the service.",
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    title: "Terms of service — ShortStack",
    description: "Terms of service for Trinity by ShortStack — acceptable use, billing, and liability.",
    url: `${SITE_URL}/terms`,
    siteName: "ShortStack",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ShortStack terms of service" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of service — ShortStack",
    description: "Terms of service for Trinity by ShortStack.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
