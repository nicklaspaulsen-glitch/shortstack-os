import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog",
  description: "See what's new in Trinity. Latest features, improvements, and updates to the agency operating system.",
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
