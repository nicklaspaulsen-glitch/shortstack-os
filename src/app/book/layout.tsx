import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a Call",
  description: "Schedule a free strategy call with the ShortStack team. Learn how AI-powered agency automation can help you grow.",
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
