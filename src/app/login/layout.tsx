import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

export const metadata: Metadata = {
  title: "Sign in to Trinity — ShortStack",
  description: "Sign in to your Trinity agency dashboard. Manage leads, clients, outreach, analytics, and content from one AI-powered operating system.",
  alternates: { canonical: `${SITE_URL}/login` },
  openGraph: {
    title: "Sign in to Trinity — ShortStack",
    description: "Sign in to your Trinity agency dashboard. Leads, CRM, outreach, and content in one place.",
    url: `${SITE_URL}/login`,
    siteName: "ShortStack",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ShortStack login" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign in to Trinity — ShortStack",
    description: "Sign in to your Trinity agency dashboard.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
