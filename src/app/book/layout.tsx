import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

export const metadata: Metadata = {
  title: "Book a strategy call — ShortStack",
  description: "Schedule a free 30-minute strategy call with the ShortStack team. See how Trinity's AI automation can grow your agency's leads, outreach, and revenue.",
  alternates: { canonical: `${SITE_URL}/book` },
  openGraph: {
    title: "Book a strategy call — ShortStack",
    description: "Schedule a free 30-minute strategy call with the ShortStack team — see Trinity in action.",
    url: `${SITE_URL}/book`,
    siteName: "ShortStack",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Book a call with ShortStack" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Book a strategy call — ShortStack",
    description: "Schedule a free 30-minute strategy call with the ShortStack team.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
