import type { Metadata } from "next";

/**
 * Survey pages are tokenized client-feedback links. They should NOT be
 * indexed (one-off URLs), but we still want a clean OG preview in case
 * the link is shared in Slack/email.
 */
export const metadata: Metadata = {
  title: "Share your feedback — ShortStack",
  description: "Quickly rate your experience and share feedback with your account team. Takes less than a minute — your response helps us improve the service.",
  openGraph: {
    title: "Share your feedback — ShortStack",
    description: "Quickly rate your experience and share feedback with your account team.",
    siteName: "ShortStack",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ShortStack feedback survey" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Share your feedback — ShortStack",
    description: "Quickly rate your experience and share feedback with your account team.",
    images: ["/og-image.png"],
  },
  // Tokenized / one-off URL — keep out of search indices.
  robots: { index: false, follow: false },
};

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
