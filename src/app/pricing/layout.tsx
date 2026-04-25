import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

export const metadata: Metadata = {
  title: "Pricing — ShortStack",
  description: "Simple, transparent pricing for Trinity. Starter, Growth, and Enterprise plans — AI lead generation, outreach, CRM, and client portals built in.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Pricing — ShortStack",
    description: "Simple, transparent pricing for Trinity. Starter, Growth, and Enterprise plans for modern agencies.",
    url: `${SITE_URL}/pricing`,
    siteName: "ShortStack",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ShortStack pricing" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — ShortStack",
    description: "Simple, transparent pricing for Trinity. Starter, Growth, Enterprise.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
