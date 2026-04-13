import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose the right ShortStack OS plan for your agency. Starter, Growth, and Enterprise tiers with AI-powered lead generation, outreach, and client management.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
