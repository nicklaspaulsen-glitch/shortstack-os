import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

export const metadata: Metadata = {
  title: "Product demo — ShortStack",
  description: "Tour Trinity's AI operating system — 20 AI agents, lead generation, CRM, outreach, content, analytics, and client portals. See every feature at a glance.",
  alternates: { canonical: `${SITE_URL}/demo` },
  openGraph: {
    title: "Product demo — ShortStack",
    description: "Tour Trinity's AI operating system — 20 AI agents, CRM, outreach, content, and client portals.",
    url: `${SITE_URL}/demo`,
    siteName: "ShortStack",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ShortStack product demo" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Product demo — ShortStack",
    description: "Tour Trinity's AI operating system.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
