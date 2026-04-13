import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client Survey",
  description: "Share your feedback about our services. Your response helps us improve.",
  robots: { index: false, follow: false },
};

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
