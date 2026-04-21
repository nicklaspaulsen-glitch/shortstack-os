import type { Metadata } from "next";

/**
 * Parent layout for the client portal. Sets default metadata for all
 * /portal/* routes. The inner `[clientId]/layout.tsx` is a client
 * component (it owns the sidebar + white-label wiring), so it cannot
 * export metadata directly — this server layout handles it instead.
 *
 * Portals are tokenized, per-client URLs. They should NOT be indexed,
 * but we still emit an OG preview so links shared in Slack/email
 * render cleanly.
 */
export const metadata: Metadata = {
  title: "Client portal — ShortStack",
  description: "Your self-service client portal. Projects, reports, messages, deliverables, and documents — all in one branded workspace powered by Trinity.",
  openGraph: {
    title: "Client portal — ShortStack",
    description: "Your self-service client portal — projects, reports, messages, and deliverables in one place.",
    siteName: "ShortStack",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ShortStack client portal" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Client portal — ShortStack",
    description: "Your self-service client portal.",
    images: ["/og-image.png"],
  },
  // Tokenized / per-client URLs — keep out of search indices.
  robots: { index: false, follow: false },
};

export default function PortalRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
