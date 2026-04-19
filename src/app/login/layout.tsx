import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Trinity dashboard. Manage leads, clients, outreach, and content from one place.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
